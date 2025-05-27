// 전역 변수
let recognition = null;
let isActive = false; // 하나의 상태로 통합
let autoStopTimer = null;

// DOM 요소
const micButton = document.getElementById("mic-btn");
const suggestionsList = document.getElementById("suggestions");

// 상태 메시지 요소들
let statusElement = null;
let guideElement = null;

// 디버그 로그 (개발용)
function log(message) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] ${message}`);
}

// iOS Safari 지원 체크
function isSpeechRecognitionSupported() {
  return 'webkitSpeechRecognition' in window;
}

// 권한 초기화 (한 번만 실행)
let permissionInitialized = false;
function initializePermission() {
  if (permissionInitialized || !isSpeechRecognitionSupported()) return;
  
  try {
    const tempRecognition = new webkitSpeechRecognition();
    tempRecognition.start();
    setTimeout(() => tempRecognition.abort(), 50);
    permissionInitialized = true;
    log('권한 초기화 완료');
  } catch (error) {
    log('권한 초기화 실패: ' + error.message);
  }
}

// 상태 UI 업데이트
function updateUI(state) {
  // 기존 상태 메시지 제거
  if (statusElement) {
    statusElement.remove();
    statusElement = null;
  }
  if (guideElement) {
    guideElement.remove();
    guideElement = null;
  }

  switch(state) {
    case 'listening':
      micButton.textContent = "🎙️ 듣는 중...";
      micButton.style.backgroundColor = "#ff9800";
      
      statusElement = document.createElement("p");
      statusElement.textContent = "🎤 말하세요 (7초 후 자동 종료)";
      statusElement.style.cssText = "text-align: center; color: #ff9800; font-weight: bold; margin: 10px 0;";
      document.body.insertBefore(statusElement, micButton);
      break;
      
    case 'processing':
      micButton.textContent = "⏳ 처리 중...";
      micButton.style.backgroundColor = "#2196f3";
      
      statusElement = document.createElement("p");
      statusElement.textContent = "💭 응답을 기다리는 중...";
      statusElement.style.cssText = "text-align: center; color: #2196f3; font-weight: bold; margin: 10px 0;";
      document.body.insertBefore(statusElement, micButton);
      break;
      
    case 'idle':
    default:
      micButton.textContent = "🎤 탭하여 말하기";
      micButton.style.backgroundColor = "#4caf50";
      break;
  }
}

// 결과 표시
function displayResults(suggestions) {
  suggestionsList.innerHTML = '';
  
  if (!suggestions || suggestions.length === 0) {
    suggestions = ['응답을 받지 못했습니다.'];
  }
  
  suggestions.forEach(text => {
    if (text && text.trim()) {
      const li = document.createElement("li");
      li.textContent = text.trim();
      li.onclick = () => speakText(text.trim());
      suggestionsList.appendChild(li);
    }
  });
  
  // 안내 메시지
  guideElement = document.createElement("p");
  guideElement.textContent = "원하는 답변을 탭하면 소리로 들을 수 있습니다.";
  guideElement.style.cssText = "text-align: center; color: #666; font-style: italic; margin: 15px 0;";
  suggestionsList.parentNode.insertBefore(guideElement, suggestionsList.nextSibling);
}

// 음성 재생
function speakText(text) {
  try {
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.rate = 0.8;
    utterance.pitch = 1.0;
    
    speechSynthesis.speak(utterance);
    log('음성 재생: ' + text.substring(0, 20) + '...');
  } catch (error) {
    log('음성 재생 실패: ' + error.message);
  }
}

// API 호출
async function fetchSuggestions(inputText) {
  log('API 호출 시작: ' + inputText);
  
  try {
    const response = await fetch("https://voice-assist-backend.onrender.com/ask-gpt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: inputText }),
      signal: AbortSignal.timeout(15000) // 15초 타임아웃
    });
    
    if (!response.ok) {
      throw new Error(`서버 오류: ${response.status}`);
    }
    
    const data = await response.json();
    log('API 응답 받음');
    
    return data.suggestions || ['응답을 받지 못했습니다.'];
    
  } catch (error) {
    log('API 호출 실패: ' + error.message);
    
    if (error.name === 'TimeoutError') {
      return ['요청 시간이 초과되었습니다.', '서버가 응답하지 않습니다.'];
    } else if (error.message.includes('Failed to fetch')) {
      return ['네트워크 연결을 확인해주세요.'];
    } else {
      return ['서버 오류가 발생했습니다.', '잠시 후 다시 시도해주세요.'];
    }
  }
}

// 음성 인식 처리
async function processRecognitionResult(text) {
  log('음성 인식 결과: ' + text);
  
  if (!text || !text.trim()) {
    displayResults(['음성이 명확하게 인식되지 않았습니다.', '다시 시도해주세요.']);
    return;
  }
  
  updateUI('processing');
  
  try {
    const suggestions = await fetchSuggestions(text.trim());
    displayResults(suggestions);
  } catch (error) {
    log('처리 중 오류: ' + error.message);
    displayResults(['처리 중 오류가 발생했습니다.']);
  }
}

// 음성 인식 정리
function cleanup() {
  log('정리 시작');
  
  if (autoStopTimer) {
    clearTimeout(autoStopTimer);
    autoStopTimer = null;
  }
  
  if (recognition) {
    try {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    } catch (error) {
      log('정리 중 오류: ' + error.message);
    }
    recognition = null;
  }
  
  isActive = false;
  updateUI('idle');
  log('정리 완료');
}

// 음성 인식 시작
function startVoiceRecognition() {
  log('음성 인식 시작 요청');
  
  // 중복 실행 방지
  if (isActive) {
    log('이미 실행 중 - 무시');
    return;
  }
  
  if (!isSpeechRecognitionSupported()) {
    alert('이 브라우저는 음성 인식을 지원하지 않습니다.');
    return;
  }
  
  // 이전 상태 정리
  cleanup();
  
  isActive = true;
  updateUI('listening');
  
  try {
    recognition = new webkitSpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;
    
    // 이벤트 핸들러 설정
    recognition.onstart = function() {
      log('음성 인식 시작됨');
    };
    
    recognition.onresult = function(event) {
      log('음성 인식 결과 받음');
      
      if (event.results && event.results[0] && event.results[0][0]) {
        const transcript = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        
        log(`인식된 텍스트: "${transcript}" (신뢰도: ${confidence})`);
        
        // 신뢰도가 너무 낮으면 재시도 요청
        if (confidence < 0.3) {
          displayResults(['음성 인식 품질이 낮습니다.', '조용한 곳에서 다시 시도해주세요.']);
        } else {
          processRecognitionResult(transcript);
        }
      } else {
        log('유효한 결과 없음');
        displayResults(['음성이 인식되지 않았습니다.', '다시 시도해주세요.']);
      }
      
      cleanup();
    };
    
    recognition.onerror = function(event) {
      log('음성 인식 오류: ' + event.error);
      
      let errorMessage = '음성 인식 오류가 발생했습니다.';
      
      switch(event.error) {
        case 'not-allowed':
          errorMessage = '마이크 권한이 거부되었습니다.';
          alert('설정 > Safari > 마이크에서 권한을 허용해주세요.');
          break;
        case 'no-speech':
          errorMessage = '음성이 감지되지 않았습니다.';
          break;
        case 'audio-capture':
          errorMessage = '마이크에 접근할 수 없습니다.';
          break;
        case 'network':
          errorMessage = '네트워크 오류가 발생했습니다.';
          break;
      }
      
      displayResults([errorMessage, '다시 시도해주세요.']);
      cleanup();
    };
    
    recognition.onend = function() {
      log('음성 인식 종료됨');
      // onresult나 onerror에서 이미 처리하므로 여기서는 정리만
      if (isActive) {
        cleanup();
      }
    };
    
    // 음성 인식 시작
    recognition.start();
    log('음성 인식 객체 시작됨');
    
    // 3초 후 자동 종료
    autoStopTimer = setTimeout(() => {
      if (recognition && isActive) {
        log('자동 종료 타이머 실행');
        try {
          recognition.stop();
        } catch (error) {
          log('자동 종료 실패: ' + error.message);
          cleanup();
        }
      }
    }, 7000);
    
  } catch (error) {
    log('음성 인식 시작 실패: ' + error.message);
    displayResults(['음성 인식을 시작할 수 없습니다.', '브라우저를 새로고침 후 다시 시도해주세요.']);
    cleanup();
  }
}

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', function() {
  log('DOM 로드 완료');
  
  if (!micButton) {
    log('마이크 버튼을 찾을 수 없습니다.');
    return;
  }
  
  // 터치 이벤트 (iOS Safari)
  micButton.addEventListener('touchend', function(e) {
    e.preventDefault();
    e.stopPropagation();
    log('터치 이벤트');
    
    // 짧은 지연으로 중복 이벤트 방지
    setTimeout(() => {
      startVoiceRecognition();
    }, 100);
  });
  
  // 클릭 이벤트 (데스크톱)
  micButton.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    log('클릭 이벤트');
    startVoiceRecognition();
  });
  
  // 터치 시작 시 권한 초기화
  micButton.addEventListener('touchstart', function(e) {
    e.preventDefault();
    initializePermission();
  }, { once: true });
  
  // 클릭 시 권한 초기화 (데스크톱)
  micButton.addEventListener('click', initializePermission, { once: true });
});

// 페이지 생명주기 이벤트
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup); // iOS Safari 전용

document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    log('페이지 숨김 - 정리 실행');
    cleanup();
  }
});

// 초기화 로그
log('Voice Assist 스크립트 로드됨');
log('브라우저: ' + navigator.userAgent);
log('음성 인식 지원: ' + isSpeechRecognitionSupported());