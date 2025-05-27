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

// iOS 권한 요청 트리거
window.addEventListener("touchstart", () => {
  try {
    const temp = new webkitSpeechRecognition();
    temp.start();
    temp.abort();
  } catch (e) {}
}, { once: true });

function startListening() {
  if (isListening) return;
  isListening = true;

  micButton.textContent = "🎙 듣는 중...";
  document.body.insertBefore(statusText, micButton);
  statusText.textContent = "🎤 말하세요... 3초 후 인식이 종료됩니다.";

  recognition = new webkitSpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.interimResults = false;

  recognition.onresult = async function (event) {
    if (!event.results?.[0]?.[0]) return;
    const text = event.results[0][0].transcript;
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
    if (event.error === "not-allowed") {
      alert("마이크 권한이 차단되었습니다. 설정에서 허용해주세요.");
    }
    stopListening();
  };

  recognition.onend = function () {
    stopListening();
  };

  try {
    recognition.start();
    console.log("🎙 인식 시작됨");
  } catch (e) {
    stopListening();
  }

  setTimeout(() => {
    try {
      recognition.stop();
    } catch (e) {}
  }, 3000); // 자동 종료
}

function stopListening() {
  if (!isListening) return;
  isListening = false;

  micButton.textContent = "🎤 탭하여 말하기";

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
  } catch {
    return ["죄송합니다. 응답에 실패했습니다."];
  }
}

function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "ko-KR";
  speechSynthesis.speak(msg);
}

function showGuidanceMessage() {
  guideText.textContent = "원하는 말이 없으면 다시 탭해 주세요.";
  if (!document.getElementById("guide")) {
    list.parentNode.insertBefore(guideText, list.nextSibling);
  }
}

window.addEventListener("beforeunload", stopListening);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopListening();
});

micButton.addEventListener("click", startListening);
