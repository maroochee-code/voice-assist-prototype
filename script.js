const recognition = new webkitSpeechRecognition() || new SpeechRecognition();
recognition.lang = "ko-KR";
recognition.interimResults = false;

// 버튼, 상태 텍스트, 리스트 참조
const listenButton = document.querySelector("button");
const list = document.getElementById("suggestions");

// 상태 텍스트 (듣는 중 메시지)
const statusText = document.createElement("p");
statusText.id = "status";
statusText.style.textAlign = "center";
statusText.style.fontWeight = "bold";
statusText.style.marginTop = "10px";
statusText.style.fontSize = "16px";

// 안내 텍스트 (리스트 밑)
const guideText = document.createElement("p");
guideText.id = "guide";
guideText.style.fontSize = "14px";
guideText.style.textAlign = "center";
guideText.style.marginTop = "12px";
guideText.style.color = "#666";

// 🔘 듣기 버튼 누르면 실행
function startListening() {
  listenButton.textContent = "🎙 듣는 중...";
  listenButton.disabled = true;

  statusText.textContent = "🎤 듣고 있어요... 말해보세요.";
  document.body.insertBefore(statusText, listenButton);

  // UI 반영을 위해 약간의 대기 (모바일 대응)
  setTimeout(() => {
    recognition.start();
  }, 1000); // 1초 대기
}

// 🎤 음성 인식 결과 수신
recognition.onresult = async function (event) {
  const text = event.results[0][0].transcript;
  list.innerHTML = ""; // 리스트 초기화

  const suggestions = await getSuggestions(text);

  suggestions.forEach(msg => {
    const li = document.createElement("li");
    li.textContent = msg;
    li.onclick = () => speak(msg);
    list.appendChild(li);
  });

  // 안내 메시지 삽입
  showGuidanceMessage();

  resetUI(); // 버튼 복원
};

// 🛠 음성 인식 종료 시
recognition.onend = function () {
  resetUI();
};

// 🔁 UI 복구
function resetUI() {
  listenButton.textContent = "🎤 듣기 시작";
  listenButton.disabled = false;

  if (statusText && statusText.parentNode) {
    statusText.parentNode.removeChild(statusText);
  }
  const guide = document.getElementById("guide");
  if (guide && guide.parentNode) {
    guide.parentNode.removeChild(guide);
  }
}

// 📡 GPT 문장 추천 요청
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
    console.error("GPT 요청 실패:", err);
    return ["죄송합니다. 응답에 실패했습니다."];
  }
}

// 🗣️ 음성 출력
function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "ko-KR";
  speechSynthesis.speak(msg);
}

// 📄 안내 메시지 삽입
function showGuidanceMessage() {
    guideText.textContent = "원하는 말이 없으면 다시 말씀해주세요.";
    if (!document.getElementById("guide")) {
        list.parentNode.insertBefore(guideText, list.nextSibling);
    }
}
