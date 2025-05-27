let recognition = null;
let isListening = false;
let recognitionTimeout = null;
let isProcessing = false; // API 처리 중 플래그

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

// iOS Safari 호환성 체크
function checkSpeechRecognitionSupport() {
  if (!('webkitSpeechRecognition' in window)) {
    alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
    return false;
  }
  return true;
}

// 권한 요청을 위한 더미 recognition 생성
let isPermissionInitialized = false;
function initializeSpeechRecognition() {
  if (isPermissionInitialized || !checkSpeechRecognitionSupport()) return;
  
  try {
    const dummyRecognition = new webkitSpeechRecognition();
    dummyRecognition.lang = "ko-KR";
    
    // 즉시 중단하여 권한만 요청
    dummyRecognition.start();
    setTimeout(() => {
      try {
        dummyRecognition.abort();
      } catch (e) {}
    }, 10);
    
    isPermissionInitialized = true;
    console.log('🎤 음성 인식 권한 초기화 완료');
  } catch (error) {
    console.error('권한 초기화 실패:', error);
  }
}

// 사용자 첫 번째 터치/클릭에서 권한 초기화
document.addEventListener('touchstart', initializeSpeechRecognition, { once: true });
document.addEventListener('click', initializeSpeechRecognition, { once: true });

function startListening() {
  // 중복 실행 방지
  if (isListening || isProcessing) {
    console.log('이미 실행 중입니다. isListening:', isListening, 'isProcessing:', isProcessing);
    return;
  }
  
  if (!checkSpeechRecognitionSupport()) return;
  
  // 이전 recognition 완전히 정리
  cleanup();
  
  isListening = true;
  updateUI('listening');
  
  try {
    recognition = new webkitSpeechRecognition();
    
    // iOS Safari 최적화 설정
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    
    // iOS에서 중요: 서비스 타입 명시
    if (recognition.serviceURI !== undefined) {
      recognition.serviceURI = 'wss://www.google.com/speech-api/full-duplex/v1/up';
    }
    
    recognition.onstart = function() {
      console.log('🎙️ 음성 인식 시작');
    };

    recognition.onresult = async function(event) {
      console.log('🎯 음성 인식 결과 수신');
      
      if (!event.results?.[0]?.[0]) {
        console.log('결과 없음');
        stopListening();
        return;
      }
      
      const text = event.results[0][0].transcript.trim();
      console.log('인식된 텍스트:', text);
      
      if (!text) {
        stopListening();
        return;
      }
      
      // API 호출 전 UI 업데이트
      updateUI('processing');
      await handleRecognizedText(text);
    };

    recognition.onerror = function(event) {
      console.error('🚨 음성 인식 오류:', event.error);
      handleRecognitionError(event.error);
      stopListening();
    };

    recognition.onend = function() {
      console.log('🏁 음성 인식 종료');
      if (isListening) {
        stopListening();
      }
    };

    // 인식 시작
    recognition.start();
    
    // iOS Safari에서 3초 후 강제 종료
    recognitionTimeout = setTimeout(() => {
      if (recognition && isListening) {
        console.log('⏰ 타임아웃으로 인식 종료');
        try {
          recognition.stop();
        } catch (e) {
          console.log('stop() 호출 실패:', e);
        }
      }
    }, 3000);
    
  } catch (error) {
    console.error('❌ 음성 인식 시작 실패:', error);
    handleRecognitionError('start-failed');
    stopListening();
  }
}

async function handleRecognizedText(text) {
  if (isProcessing) return;
  
  isProcessing = true;
  list.innerHTML = '<li style="color: #666;">응답을 기다리는 중...</li>';
  
  try {
    const suggestions = await getSuggestions(text);
    displaySuggestions(suggestions);
    showGuidanceMessage();
  } catch (error) {
    console.error('텍스트 처리 실패:', error);
    displaySuggestions(['응답을 가져오는데 실패했습니다. 다시 시도해주세요.']);
  } finally {
    isProcessing = false;
    stopListening();
  }
}

function displaySuggestions(suggestions) {
  list.innerHTML = '';
  
  if (!suggestions || suggestions.length === 0) {
    suggestions = ['응답을 받지 못했습니다.'];
  }
  
  suggestions.forEach(msg => {
    if (msg && msg.trim()) {
      const li = document.createElement("li");
      li.textContent = msg.trim();
      li.onclick = () => speak(msg.trim());
      li.style.cursor = 'pointer';
      list.appendChild(li);
    }
  });
}

function handleRecognitionError(errorType) {
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
  } else {
    console.log(message);
    // 네트워크 오류가 아닌 경우 자동으로 재시도하지 않음
  }
}

function stopListening() {
  if (!isListening) return;
  
  console.log('🛑 음성 인식 중지 시작');
  isListening = false;
  
  // 타이머 정리
  if (recognitionTimeout) {
    clearTimeout(recognitionTimeout);
    recognitionTimeout = null;
  }
  
  // recognition 정리
  if (recognition) {
    try {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    } catch (e) {
      console.log('recognition 정리 중 오류:', e);
    }
    recognition = null;
  }

  updateUI('idle');
}

function cleanup() {
  if (recognitionTimeout) {
    clearTimeout(recognitionTimeout);
    recognitionTimeout = null;
  }
  
  if (recognition) {
    try {
      recognition.abort();
    } catch (e) {}
    recognition = null;
  }
  
  isListening = false;
  isProcessing = false;
}

function updateUI(state) {
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log('⏰ API 요청 타임아웃');
    controller.abort();
  }, 15000); // 15초 타임아웃 (Render 무료 계정 고려)
  
  try {
    console.log('🌐 API 요청 시작:', input);
    
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
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('✅ API 응답 수신:', data);
    
    return Array.isArray(data.suggestions) ? data.suggestions : [data.suggestions || "응답을 받지 못했습니다."];
    
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('❌ API 호출 실패:', error);
    
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
  
  try {
    // 기존 음성 중지
    speechSynthesis.cancel();
    
    // iOS Safari에서 음성 합성을 위한 지연
    setTimeout(() => {
      const msg = new SpeechSynthesisUtterance(text.trim());
      msg.lang = "ko-KR";
      msg.rate = 0.8;
      msg.pitch = 1.0;
      msg.volume = 0.8;
      
      msg.onstart = () => console.log('🔊 음성 재생 시작');
      msg.onend = () => console.log('🔇 음성 재생 완료');
      msg.onerror = (event) => console.error('🚨 음성 재생 오류:', event.error);
      
      speechSynthesis.speak(msg);
    }, 100);
    
  } catch (error) {
    console.error('음성 재생 실패:', error);
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
window.addEventListener("pagehide", cleanup); // iOS Safari 전용

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cleanup();
  }
});

// 버튼 이벤트 (iOS Safari 호환성 강화)
micButton.addEventListener("touchstart", (e) => {
  e.preventDefault();
});

micButton.addEventListener("touchend", (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  // 짧은 지연 후 실행 (iOS Safari 터치 이벤트 최적화)
  setTimeout(() => {
    startListening();
  }, 50);
});

micButton.addEventListener("click", (e) => {
  e.preventDefault();
  startListening();
});

// 초기화 로그
console.log('🚀 Voice Assist 스크립트 로드 완료');
console.log('📱 User Agent:', navigator.userAgent);
console.log('🎤 Speech Recognition 지원:', 'webkitSpeechRecognition' in window);