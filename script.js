const recognition = new webkitSpeechRecognition() || new SpeechRecognition();
recognition.lang = "ko-KR";
recognition.interimResults = false;

function startListening() {
  recognition.start();
}

recognition.onresult = async function(event) {
  const text = event.results[0][0].transcript;
  const list = document.getElementById("suggestions");
  list.innerHTML = ""; // 기존 리스트 초기화

  const suggestions = await getSuggestions(text);  // 🔁 GPT 호출
  suggestions.forEach(msg => {
    const li = document.createElement("li");
    li.textContent = msg;
    li.onclick = () => speak(msg);
    list.appendChild(li);
  });
};

// 🔁 이 함수가 이제 GPT에게 실제로 문장을 추천받음
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

function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "ko-KR";
  speechSynthesis.speak(msg);
}
