let recognition = null;
let isListening = false;

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

// iOS 첫 터치에서 권한 팝업 유도
window.addEventListener("touchstart", () => {
  try {
    const temp = new webkitSpeechRecognition();
    temp.start();
    temp.abort();
  } catch (e) {
    console.warn("🔐 권한 요청 실패:", e);
  }
}, { once: true });

function startListening() {
  if (isListening) return;
  isListening = true;

  micButton.textContent = "🎙 듣는 중...";
  document.body.insertBefore(statusText, micButton);
  statusText.textContent = "🎤 듣고 있어요... 손을 떼면 멈춰요.";

  recognition = new webkitSpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.interimResults = false;

  recognition.onresult = async function (event) {
    if (!event.results || !event.results[0] || !event.results[0][0]) {
      console.warn("❌ 결과 없음");
      return;
    }
    const text = event.results[0][0].transcript;
    console.log("🧠 인식:", text);

    list.innerHTML = "";
    const suggestions = await getSuggestions(text);
    suggestions.forEach(msg => {
      const li = document.createElement("li");
      li.textContent = msg;
      li.onclick = () => speak(msg);
      list.appendChild(li);
    });

    showGuidanceMessage();
  };

  recognition.onerror = function (event) {
    console.warn("❗ 오류:", event.error);
    if (event.error === "not-allowed") {
      alert("마이크 권한이 차단되었습니다.\n설정에서 허용해 주세요.");
    }
    stopListening();
  };

  recognition.onend = function () {
    console.log("🛑 인식 종료");
    stopListening();
  };

  try {
    recognition.start();
    console.log("🎙 마이크 시작됨");
  } catch (e) {
    console.warn("❌ 시작 실패:", e);
    stopListening();
  }
}

function stopListening() {
  if (!isListening) return;
  isListening = false;

  micButton.textContent = "🎤 누르고 말하세요";
  try {
    recognition && recognition.stop();
  } catch (e) {
    console.warn("🧨 종료 실패:", e);
  }

  if (statusText.parentNode) {
    statusText.parentNode.removeChild(statusText);
  }

  const guide = document.getElementById("guide");
  if (guide && guide.parentNode) {
    guide.parentNode.removeChild(guide);
  }

  recognition = null;
}

async function getSuggestions(input) {
  try {
    const response = await fetch("https://voice-assist-backend.onrender.com/ask-gpt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input })
    });

    const data = await response.json();
    return data.suggestions || [];
  } catch (err) {
    console.error("GPT 오류:", err);
    return ["죄송합니다. 응답에 실패했습니다."];
  }
}

function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "ko-KR";
  speechSynthesis.speak(msg);
}

function showGuidanceMessage() {
  guideText.textContent = "원하는 말이 없으면 다시 말씀해주세요.";
  if (!document.getElementById("guide")) {
    list.parentNode.insertBefore(guideText, list.nextSibling);
  }
}

// 안전한 세션 종료 처리
window.addEventListener("beforeunload", stopListening);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopListening();
});

// 모바일 및 PC 대응 이벤트 등록
micButton.addEventListener("touchstart", (e) => {
  e.preventDefault();
  startListening();
});
micButton.addEventListener("touchend", stopListening);
micButton.addEventListener("touchcancel", stopListening);
micButton.addEventListener("mousedown", (e) => {
  e.preventDefault();
  startListening();
});
micButton.addEventListener("mouseup", stopListening);
