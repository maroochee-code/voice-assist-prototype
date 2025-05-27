const recognition = new webkitSpeechRecognition() || new SpeechRecognition();
recognition.lang = "ko-KR";
recognition.interimResults = false;

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

let isListening = false;

function startListening() {
  if (isListening) return;
  isListening = true;

  micButton.textContent = "🎙 듣는 중...";
  document.body.insertBefore(statusText, micButton);
  statusText.textContent = "🎤 듣고 있어요... 손을 떼면 멈춰요.";

  recognition.start();
  console.log("🎙 마이크 시작됨");
}

function stopListening() {
  if (!isListening) return;
  isListening = false;

  micButton.textContent = "🎤 누르고 말하세요";
  recognition.stop(); // ❗ 반드시 stop 사용

  console.log("🛑 마이크 정지 요청됨");

  if (statusText && statusText.parentNode) {
    statusText.parentNode.removeChild(statusText);
  }
  const guide = document.getElementById("guide");
  if (guide && guide.parentNode) {
    guide.parentNode.removeChild(guide);
  }
}

// 🎯 result 1개만 남김
recognition.onresult = async function (event) {
  if (!event.results || !event.results[0] || !event.results[0][0]) {
    console.warn("❌ 결과 없음");
    return;
  }

  const text = event.results[0][0].transcript;
  console.log("🧠 인식된 텍스트:", text);

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
  console.warn("🎤 Speech error:", event.error);
  stopListening();
};

recognition.onend = function () {
  console.log("🛑 마이크 종료됨");
  stopListening();
};

async function getSuggestions(input) {
  console.log("📨 GPT 요청:", input);
  try {
    const response = await fetch("https://voice-assist-backend.onrender.com/ask-gpt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input })
    });

    const data = await response.json();
    return data.suggestions || [];
  } catch (err) {
    console.error("GPT 요청 실패:", err);
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

window.addEventListener("beforeunload", stopListening);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopListening();
});

// ✅ 이벤트 중복 없이 1세트만 등록
micButton.addEventListener("mousedown", startListening);
micButton.addEventListener("mouseup", stopListening);
micButton.addEventListener("touchstart", startListening);
micButton.addEventListener("touchend", stopListening);
