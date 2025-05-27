let recognition = null;
let isListening = false;
let recognitionTimeout = null;
let isProcessing = false;
let sessionId = Date.now(); // 디버깅용 세션 ID

const micButton = document.getElementById("mic-btn");
const list = document.getElementById("suggestions");

const statusText = document.createElement("p");
statusText.id = "status";
statusText.style.textAlign = "center";
statusText.style.fontWeight = "bold";
statusText.style.marginTop = "10px";
statusText.style.fontSize = "16px";

const guideText = document.createElement("p");
guideText.id = "guide";
guideText.style.fontSize = "14px";
guideText.style.textAlign = "center";
guideText.style.marginTop = "12px";
guideText.style.color = "#666";
guideText.style.fontStyle = "italic";
guideText.style.animation = "fadein 0.8s ease-in";

// 디버그 로그 함수
function debugLog(message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const logMessage = `[${timestamp}][${sessionId}] ${message}`;
  console.log(logMessage, data || '');
  
  // iOS Safari에서 화면에도 표시 (개발용)
  if (window.location.search.includes('debug=1')) {
    const debugDiv = document.getElementById('debug-info') || createDebugDiv();
    debugDiv.innerHTML += `<div>${logMessage}</div>`;
    debugDiv.scrollTop = debugDiv.scrollHeight;
  }
}

function createDebugDiv() {
  const debugDiv = document.createElement('div');
  debugDiv.id = 'debug-info';
  debugDiv.style.cssText = `
    position: fixed; top: 10px; right: 10px; width: 300px; height: 200px;
    background: rgba(0,0,0,0.8); color: white; font-size: 10px;
    overflow-y: auto; padding: 5px; z-index: 9999; border-radius: 5px;
  `;
  document.body.appendChild(debugDiv);
  return debugDiv;
}

// iOS Safari 호환성 체크
function checkSpeechRecognitionSupport() {
  const isSupported = 'webkitSpeechRecognition' in window;
  debugLog('음성 인식 지원 여부:', isSupported);
  
  if (!isSupported) {
    alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
    return false;
  }
  return true;
}

// 권한 초기화
let isPermissionInitialized = false;
function initializeSpeechRecognition() {
  if (isPermissionInitialized || !checkSpeechRecognitionSupport()) return;
  
  debugLog('권한 초기화 시작');
  
  try {
    const dummyRecognition = new webkitSpeechRecognition();
    dummyRecognition.lang = "ko-KR";
    
    dummyRecognition.onerror = function(event) {
      debugLog('권한 초기화 에러:', event.error);
    };
    
    dummyRecognition.start();
    setTimeout(() => {
      try {
        dummyRecognition.abort();
        debugLog('권한 초기화 완료');
      } catch (e) {
        debugLog('권한 초기화 중단 실패', e.message);
      }
    }, 10);
    
    isPermissionInitialized = true;
  } catch (error) {
    debugLog('권한 초기화 실패:', error.message);
  }
}

// 사용자 첫 번째 터치/클릭에서 권한 초기화
document.addEventListener('touchstart', initializeSpeechRecognition, { once: true });
document.addEventListener('click', initializeSpeechRecognition, { once: true });

function startListening() {
  debugLog('startListening 호출됨', { isListening, isProcessing });
  
  // 중복 실행 방지
  if (isListening || isProcessing) {
    debugLog('이미 실행 중이므로 중단');
    return;
  }
  
  if (!checkSpeechRecognitionSupport()) return;
  
  // 이전 recognition 완전히 정리
  cleanup();
  
  isListening = true;
  updateUI('listening');
  debugLog('음성 인식 시작 준비');
  
  try {
    recognition = new webkitSpeechRecognition();
    
    // iOS Safari 최적화 설정
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    
    debugLog('Recognition 객체 생성 완료');
    
    recognition.onstart = function() {
      debugLog('🎙️ onstart 이벤트 발생');
    };

    recognition.onresult = async function(event) {
      debugLog('🎯 onresult 이벤트 발생');
      
      if (!event.results?.[0]?.[0]) {
        debugLog('결과 없음');
        stopListening();
        return;
      }
      
      const text = event.results[0][0].transcript.trim();
      const confidence = event.results[0][0].confidence;
      debugLog('인식된 텍스트:', { text, confidence });
      
      if (!text) {
        debugLog('빈 텍스트로 인해 중단');
        stopListening();
        return;
      }
      
      // API 호출 전 UI 업데이트
      updateUI('processing');
      await handleRecognizedText(text);
    };

    recognition.onerror = function(event) {
      debugLog('🚨 onerror 이벤트:', event.error);
      handleRecognitionError(event.error);
      stopListening();
    };

    recognition.onend = function() {
      debugLog('🏁 onend 이벤트 발생');
      if (isListening) {
        stopListening();
      }
    };

    // 인식 시작
    debugLog('recognition.start() 호출');
    recognition.start();
    
    // iOS Safari에서 3초 후 강제 종료
    recognitionTimeout = setTimeout(() => {
      if (recognition && isListening) {
        debugLog('⏰ 타임아웃으로 인식 종료');
        try {
          recognition.stop();
        } catch (e) {
          debugLog('stop() 호출 실패:', e.message);
        }
      }
    }, 3000);
    
  } catch (error) {
    debugLog('❌ 음성 인식 시작 실패:', error.message);
    handleRecognitionError('start-failed');
    stopListening();
  }
}

async function handleRecognizedText(text) {
  if (isProcessing) {
    debugLog('이미 처리 중이므로 중단');
    return;
  }
  
  debugLog('API 호출 시작:', text);
  isProcessing = true;
  list.innerHTML = '<li style="color: #666;">응답을 기다리는 중...</li>';
  
  try {
    const suggestions = await getSuggestions(text);
    debugLog('API 응답 받음:', suggestions.length + '개');
    displaySuggestions(suggestions);
    showGuidanceMessage();
  } catch (error) {
    debugLog('텍스트 처리 실패:', error.message);
    displaySuggestions(['응답을 가져오는데 실패했습니다. 다시 시도해주세요.']);
  } finally {
    isProcessing = false;
    stopListening();
    debugLog('handleRecognizedText 완료');
  }
}

function displaySuggestions(suggestions) {
  list.innerHTML = '';
  
  if (!suggestions || suggestions.length === 0) {
    suggestions = ['응답을 받지 못했습니다.'];
  }
  
  suggestions.forEach((msg, index) => {
    if (msg && msg.trim()) {
      const li = document.createElement("li");
      li.textContent = msg.trim();
      li.onclick = () => speak(msg.trim());
      li.style.cursor = 'pointer';
      list.appendChild(li);
      debugLog(`제안 ${index + 1}:`, msg.trim());
    }
  });
}

function handleRecognitionError(errorType) {
  debugLog('음성 인식 에러 처리:', errorType);
  
  const errorMessages = {
    'not-allowed': '마이크 권한이 거부되었습니다.\n설정 > Safari > 마이크에서 허용해주세요.',
    'no-speech': '음성이 감지되지 않았습니다.',
    'audio-capture': '마이크에 접근할 수 없습니다.',
    'network': '네트워크 연결을 확인해주세요.',
    'service-not-allowed': '음성 인식 서비스에 접근할 수 없습니다.',
    'start-failed': '음성 인식을 시작할 수 없습니다.'
  };
  
  const message = errorMessages[errorType] || `음성 인식 오류: ${errorType}`;
  
  if (errorType === 'not-allowed' || errorType === 'audio-capture') {
    alert(message);
  }
  
  // 에러 메시지를 화면에 표시
  displaySuggestions([`오류: ${message}`]);
}

function stopListening() {
  if (!isListening) return;
  
  debugLog('🛑 stopListening 시작');
  isListening = false;
  
  // 타이머 정리
  if (recognitionTimeout) {
    clearTimeout(recognitionTimeout);
    recognitionTimeout = null;
    debugLog('타이머 정리 완료');
  }
  
  // recognition 정리
  if (recognition) {
    try {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
      debugLog('Recognition 객체 정리 완료');
    } catch (e) {
      debugLog('Recognition 정리 중 오류:', e.message);
    }
    recognition = null;
  }

  updateUI('idle');
  debugLog('stopListening 완료');
}

function cleanup() {
  debugLog('cleanup 시작');
  
  if (recognitionTimeout) {
    clearTimeout(recognitionTimeout);
    recognitionTimeout = null;
  }
  
  if (recognition) {
    try {
      recognition.abort();
    } catch (e) {
      debugLog('cleanup 중 abort 실패:', e.message);
    }
    recognition = null;
  }
  
  isListening = false;
  isProcessing = false;
  debugLog('cleanup 완료');
}

function updateUI(state) {
  debugLog('UI 상태 변경:', state);
  
  // 기존 상태 텍스트 제거
  const existingStatus = document.getElementById("status");
  if (existingStatus && existingStatus.parentNode) {
    existingStatus.parentNode.removeChild(existingStatus);
  }
  
  const existingGuide = document.getElementById("guide");
  if (existingGuide && existingGuide.parentNode) {
    existingGuide.parentNode.removeChild(existingGuide);
  }
  
  switch(state) {
    case 'listening':
      micButton.textContent = "🎙️ 듣는 중...";
      statusText.textContent = "🎤 말하세요... (3초 후 자동 종료)";
      statusText.style.color = "#4caf50";
      document.body.insertBefore(statusText, micButton);
      break;
      
    case 'processing':
      micButton.textContent = "⏳ 처리 중...";
      statusText.textContent = "💭 응답을 생성하고 있습니다...";
      statusText.style.color = "#ff9800";
      if (!document.getElementById("status")) {
        document.body.insertBefore(statusText, micButton);
      }
      break;
      
    case 'idle':
    default:
      micButton.textContent = "🎤 탭하여 말하기";
      break;
  }
}

async function getSuggestions(input) {
  const requestId = Date.now();
  debugLog(`API 요청 시작 [${requestId}]:`, input);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    debugLog(`API 요청 타임아웃 [${requestId}]`);
    controller.abort();
  }, 15000);
  
  try {
    const response = await fetch("https://voice-assist-backend.onrender.com/ask-gpt", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ text: input }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    debugLog(`API 응답 상태 [${requestId}]:`, response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    debugLog(`API 응답 데이터 [${requestId}]:`, data);
    
    return Array.isArray(data.suggestions) ? data.suggestions : [data.suggestions || "응답을 받지 못했습니다."];
    
  } catch (error) {
    clearTimeout(timeoutId);
    debugLog(`API 호출 실패 [${requestId}]:`, error.message);
    
    if (error.name === 'AbortError') {
      return ["요청 시간이 초과되었습니다.\n서버가 잠시 느릴 수 있습니다."];
    } else if (error.message.includes('Failed to fetch')) {
      return ["네트워크 연결을 확인해주세요."];
    } else {
      return ["서버 오류가 발생했습니다.\n잠시 후 다시 시도해주세요."];
    }
  }
}

function speak(text) {
  if (!text || !text.trim()) return;
  
  debugLog('음성 재생 시작:', text.substring(0, 20) + '...');
  
  try {
    speechSynthesis.cancel();
    
    setTimeout(() => {
      const msg = new SpeechSynthesisUtterance(text.trim());
      msg.lang = "ko-KR";
      msg.rate = 0.8;
      msg.pitch = 1.0;
      msg.volume = 0.8;
      
      msg.onstart = () => debugLog('🔊 음성 재생 시작됨');
      msg.onend = () => debugLog('🔇 음성 재생 완료됨');
      msg.onerror = (event) => debugLog('🚨 음성 재생 오류:', event.error);
      
      speechSynthesis.speak(msg);
    }, 100);
    
  } catch (error) {
    debugLog('음성 재생 실패:', error.message);
  }
}

function showGuidanceMessage() {
  guideText.textContent = "원하는 답변을 탭하면 소리로 들을 수 있습니다.";
  if (!document.getElementById("guide")) {
    list.parentNode.insertBefore(guideText, list.nextSibling);
  }
}

// 페이지 생명주기 이벤트
window.addEventListener("beforeunload", cleanup);
window.addEventListener("pagehide", cleanup);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    debugLog('페이지가 숨겨짐 - cleanup 실행');
    cleanup();
  }
});

// 버튼 이벤트
micButton.addEventListener("touchstart", (e) => {
  e.preventDefault();
  debugLog('touchstart 이벤트');
});

micButton.addEventListener("touchend", (e) => {
  e.preventDefault();
  e.stopPropagation();
  debugLog('touchend 이벤트');
  
  setTimeout(() => {
    startListening();
  }, 50);
});

micButton.addEventListener("click", (e) => {
  e.preventDefault();
  debugLog('click 이벤트');
  startListening();
});

// 초기화 로그
debugLog('🚀 Voice Assist 스크립트 로드 완료');
debugLog('📱 User Agent:', navigator.userAgent);
debugLog('🎤 Speech Recognition 지원:', 'webkitSpeechRecognition' in window);

// 디버그 모드 안내
if (window.location.search.includes('debug=1')) {
  debugLog('🔍 디버그 모드 활성화됨');
} else {
  console.log('💡 디버그 모드를 보려면 URL에 ?debug=1 을 추가하세요');
}