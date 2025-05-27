// 최적화된 script.js (2025.05.27 기준, iOS Safari/Chrome 대응 포함)

let recognition;
let isListening = false;
let isProcessing = false;
let micButtonListenerAttached = false;

const micButton = document.getElementById("mic-btn");
const suggestionList = document.getElementById("suggestions");
const guide = document.getElementById("guide");
const debug = document.getElementById("debug");

// 로그 유틸
function log(...args) {
  const timestamp = new Date().toLocaleTimeString("ko-KR", { hour12: false });
  const entry = `[${timestamp}] ` + args.join(" ");
  console.log(entry);
  if (debug) debug.innerText += entry + "\n";
}

// UI 상태 업데이트
function updateUI(state) {
  if (state === "idle") {
    micButton.textContent = "🎤 탭하여 말하기";
    micButton.disabled = false;
  } else if (state === "listening") {
    micButton.textContent = "🟢 듣는 중...";
    micButton.disabled = true;
  } else if (state === "thinking") {
    micButton.textContent = "🤖 답변 생성 중...";
    micButton.disabled = true;
  }
}

// 제안 렌더링
function displaySuggestions(lines) {
  suggestionList.innerHTML = "";
  lines.forEach(msg => {
    const li = document.createElement("li");
    li.textContent = msg;
    li.onclick = () => speak(msg);
    suggestionList.appendChild(li);
  });
  if (guide) guide.style.display = "block";
}

// 음성 출력
function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "ko-KR";
  speechSynthesis.speak(msg);
}

// 음성 인식 시작
function startListening() {
  if (!window.webkitSpeechRecognition) {
    alert("이 브라우저에서는 음성 인식을 지원하지 않습니다.");
    return;
  }

  if (isListening || isProcessing) return;

  log("\u{1F680} startListening called");
  isListening = true;
  isProcessing = false;
  updateUI("listening");
  if (guide) guide.style.display = "none";

  // 이전 인스턴스가 있다면 정리
  if (recognition) {
    try {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.abort();
      log("\u{1F6AE} 이전 recognition 인스턴스 정리 완료");
    } catch (e) {
      log("\u{274C} 이전 인스턴스 정리 중 오류:", e);
    }
  }

  recognition = new webkitSpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.interimResults = false;

  recognition.onstart = () => log("\u{1F3A4} onstart event");
  recognition.onend = () => {
    log("\u{1F6A9} onend event");
    if (!isProcessing) {
      displaySuggestions(["음성이 인식되지 않았습니다. 다시 시도해주세요."]);
      updateUI("idle");
    }
    isListening = false;
  };

  recognition.onerror = (e) => {
    log("\u{1F6AB} onerror:", e.error);
    updateUI("idle");
    isListening = false;
  };

  recognition.onresult = async (event) => {
    const text = event.results[0][0].transcript;
    log("\u{1F916} onresult:", text);
    isProcessing = true;
    updateUI("thinking");
    await handleRecognizedText(text);
  };

  recognition.start();

  // 타임아웃: 4초 뒤 강제 종료
  setTimeout(() => {
    if (isListening && recognition) {
      log("\u{23F0} timeout reached, stopping manually");
      recognition.stop();
    }
  }, 4000);
}

// GPT 처리
async function handleRecognizedText(input) {
  log("\u{1F4E1} API 호출 시작");
  try {
    const response = await fetch("https://voice-assist-backend.onrender.com/ask-gpt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input })
    });
    const data = await response.json();
    displaySuggestions(data.suggestions || ["추천 문장을 가져오지 못했습니다."]);
  } catch (err) {
    console.error(err);
    displaySuggestions(["GPT 응답 실패. 잠시 후 다시 시도해 주세요."]);
  }
  updateUI("idle");
  isProcessing = false;
}

// 초기화
window.addEventListener("DOMContentLoaded", () => {
  log("\u{1F680} Voice Assist loaded");
  updateUI("idle");
  if (guide) guide.style.display = "none";

  if (!micButtonListenerAttached) {
    micButton.addEventListener("click", startListening);
    micButtonListenerAttached = true;
    log("\u{1F3A7} Mic button listener attached");
  }
});
