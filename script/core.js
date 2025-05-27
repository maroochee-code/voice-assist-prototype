// core.js

let recognition;
let isListening = false;
let isProcessing = false;

function log(...args) {
  const timestamp = new Date().toLocaleTimeString("ko-KR", { hour12: false });
  const entry = `[${timestamp}] ` + args.join(" ");
  console.log(entry);
  const debug = document.getElementById("debug");
  if (debug) debug.innerText += entry + "\n";
}

function updateUI(state) {
  const micButton = document.getElementById("mic-btn");
  if (!micButton) return;

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

function startListening() {
  const transcriptDisplay = document.getElementById("transcript");
  const suggestionList = document.getElementById("suggestions");
  const guide = document.getElementById("guide");

  if (!window.webkitSpeechRecognition) {
    alert("이 브라우저에서는 음성 인식을 지원하지 않습니다.");
    return;
  }

  if (isListening || isProcessing) return;

  log("🚀 startListening called");
  isListening = true;
  isProcessing = false;
  updateUI("listening");
  if (guide) guide.style.display = "none";
  if (transcriptDisplay) transcriptDisplay.textContent = "";

  if (recognition) {
    try {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.abort();
      log("🗑️ 이전 recognition 인스턴스 정리 완료");
    } catch (e) {
      log("❌ 이전 인스턴스 정리 중 오류:", e);
    }
  }

  recognition = new webkitSpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.interimResults = false;

  recognition.onstart = () => log("🎤 onstart event");
  recognition.onend = () => {
    log("🏁 onend event");
    isListening = false;
  
    if (isProcessing) {
      log("⌛ GPT 응답 대기 중이라 UI 유지");
      // 여기선 UI 복구 안 함 → script.js의 handleRecognizedText에서 함
    } else {
      log("🔁 인식 종료 후 UI 복구");
      updateUI("idle");
    }
  };

  recognition.onerror = (e) => {
    log("🚫 onerror:", e.error);
    updateUI("idle");
    isListening = false;
    if (transcriptDisplay) transcriptDisplay.textContent = "";
  };

  recognition.onresult = async (event) => {
    const text = event.results[0][0].transcript;
    log("🤖 onresult:", text);
    isProcessing = true;
    updateUI("thinking");
    if (transcriptDisplay) transcriptDisplay.textContent = `"${text}"`;
    await handleRecognizedText(text); // script.js에 정의됨
  };

  recognition.start();

  setTimeout(() => {
    if (isListening && recognition) {
      log("⏰ timeout reached, stopping manually");
      recognition.stop();
    }
  }, 4000);
}
