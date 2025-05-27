const recognition = new webkitSpeechRecognition() || new SpeechRecognition();
recognition.lang = "ko-KR";
recognition.interimResults = false;

// 🎯 상태 텍스트 요소 준비
const listenButton = document.querySelector("button");
const statusText = document.createElement("p");
statusText.id = "status";
statusText.style.textAlign = "center";
statusText.style.fontWeight = "bold";
statusText.style.marginTop = "10px";
statusText.style.fontSize = "16px";

// 🎧 듣기 시작
function startListening() {
  recognition.start();

  // UI 업데이트
  listenButton.textContent = "🎙 듣는 중...";
  listenButton.disabled = true;
  document.body.insertBefore(statusText, listenButton);
  statusText.textContent = "🎤 듣고 있어요... 말해보세요.";
}

// 🎤 음성 인식 결과 수신
recognition.onresult = async function(event) {
  const text = event.results[0][0].transcript;
  const list = document.getElementById("suggestions");
  list.innerHTML = ""; // 기존 리스트 초기화

  const suggestions = await getSuggestions(text); // GPT 호출
  suggestions.forEach(msg => {
    const li = document.createElement("li");
    li.textContent = msg;
    li.onclick = () => speak(msg);
    list.appendChild(li);
  });

  resetUI(); // 종료 시 버튼 복원
};

// 🔁 음성 인식 종료 시에도 UI 복원
recognition.onend = function() {
  resetUI();
};

function resetUI() {
  listenButton.textContent = "🎤 듣기 시작";
  listenButton.disabled = false;
  if (statusText && statusText.parentNode) {
    statusText.parentNode.removeChild(statusText);
  }
}

// 📡 GPT 호출 함수
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

// 🔊 음성 출력
function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "ko-KR";
  speechSynthesis.speak(msg);
}
