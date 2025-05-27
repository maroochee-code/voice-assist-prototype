// script.js

const micButton = document.getElementById("mic-btn");
const suggestionList = document.getElementById("suggestions");
const transcriptDisplay = document.getElementById("transcript");
const guide = document.getElementById("guide");

// 초기화
window.addEventListener("DOMContentLoaded", () => {
  log("🚀 Voice Assist loaded");
  updateUI("idle");
  if (guide) guide.style.display = "none";

  micButton.addEventListener("click", startListening);
  log("🎧 Mic button listener attached");
});

// 추천 문장 클릭 시 음성 출력
function speak(text) {
  const msg = new SpeechSynthesisUtterance(text);
  msg.lang = "ko-KR";
  speechSynthesis.speak(msg);
}

// 추천 문장 표시
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

// GPT 호출
async function handleRecognizedText(input) {
  const userId = localStorage.getItem("voice-user-id") || "anonymous";

  try {
    const response = await fetch("https://voice-assist-backend.onrender.com/ask-gpt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input, userId })
    });

    const data = await response.json();
    displaySuggestions(data.suggestions || ["추천 문장을 가져오지 못했습니다."]);
  } catch (err) {
    console.error(err);
    displaySuggestions(["GPT 응답 실패. 잠시 후 다시 시도해 주세요."]);
  }

  updateUI("idle");
  isProcessing = false; // ← 이거 꼭 있어야 됨!
  if (transcriptDisplay) transcriptDisplay.textContent = "";
}
