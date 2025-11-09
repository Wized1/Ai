// ENDROID AI — FINAL SCRIPT.JS
// Clean, Smart, Bug-Free Build
// Author: Endroid Project (wized1)

let API_KEYS = [];
let currentKeyIndex = 0;
let chatHistory = [];
let typingTimeout;
const SYSTEM_PROMPT = `
You are Endroid AI — a clean, helpful, offline-friendly assistant.
Rules:
- Be natural and conversational.
- Never open or use Wikipedia or dictionary unless the user explicitly asks (e.g., "search", "wiki", "definition", "who is", "what is").
- Keep responses short and useful in casual chat like "hi", "hello", or "how are you".
- You are part of the Endroid ecosystem — friendly, fast, and private.
`;

document.addEventListener("DOMContentLoaded", () => {
  loadKeys();
  loadChat();
  showRandomWelcome();
});

function loadKeys() {
  fetch("keys.txt?t=" + Date.now())
    .then(r => r.ok ? r.text() : Promise.reject())
    .then(text => {
      API_KEYS = text.split(/\r?\n/).filter(Boolean);
      if (API_KEYS.length === 0) throw new Error("No keys found.");
    })
    .catch(() => showError("Failed to load API keys."));
}

function saveChat() {
  localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
}

function loadChat() {
  const saved = localStorage.getItem("chatHistory");
  if (saved) {
    chatHistory = JSON.parse(saved);
    const chatContainer = document.getElementById("chatContainer");
    chatContainer.innerHTML = "";
    chatHistory.forEach(msg => addMessage(msg.text, msg.type, false));
  }
}

function addMessage(text, type, save = true) {
  const chatContainer = document.getElementById("chatContainer");
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${type}`;
  messageDiv.innerHTML = text;
  chatContainer.appendChild(messageDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;

  if (save) {
    chatHistory.push({ text, type });
    saveChat();
  }
}

function showError(text) {
  addMessage(`<b>Error:</b> ${text}`, "error");
}

function showTyping() {
  const chatContainer = document.getElementById("chatContainer");
  const typingDiv = document.createElement("div");
  typingDiv.className = "message ai typing";
  typingDiv.id = "typing";
  typingDiv.textContent = "Endroid AI is typing...";
  chatContainer.appendChild(typingDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideTyping() {
  const typingDiv = document.getElementById("typing");
  if (typingDiv) typingDiv.remove();
}

function showRandomWelcome() {
  const welcomes = [
    "👋 Hi! I’m Endroid AI — ready to chat!",
    "🌟 Welcome back to Endroid AI!",
    "💬 Ask me anything — smart, private, and free.",
    "⚡ I’m here to help. What’s up?"
  ];
  const welcomeDiv = document.getElementById("welcomeMessage");
  if (welcomeDiv) welcomeDiv.innerHTML = welcomes[Math.floor(Math.random() * welcomes.length)];
}

function clearHistory() {
  if (confirm("Clear chat history?")) {
    chatHistory = [];
    saveChat();
    document.getElementById('chatContainer').innerHTML = '<div class="welcome" id="welcomeMessage"></div>';
    showRandomWelcome();
  }
}

function removeWelcomeIfChatExists() {
  const welcome = document.getElementById("welcomeMessage");
  if (welcome && chatHistory.length > 0) welcome.remove();
}

// === POWERFUL DECISION LOGIC ===
function shouldUseWikipedia(message) {
  const keywords = ["who is", "what is", "wiki", "search", "definition", "tell me about"];
  return keywords.some(k => message.toLowerCase().includes(k));
}

// === MAIN SEND FUNCTION ===
async function sendMessage() {
  const input = document.getElementById("userInput");
  const userText = input.value.trim();
  if (!userText) return;

  removeWelcomeIfChatExists();
  addMessage(userText, "user");
  input.value = "";

  showTyping();
  await callGeminiAPI(userText);
}

async function callGeminiAPI(userText) {
  if (API_KEYS.length === 0) return showError("No API keys available.");

  const key = API_KEYS[currentKeyIndex];
  const useWiki = shouldUseWikipedia(userText);

  const systemMessage = useWiki
    ? SYSTEM_PROMPT + "\nUser may want factual info, feel free to explain clearly."
    : SYSTEM_PROMPT + "\nKeep it friendly and simple.";

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + key, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: systemMessage + "\nUser: " + userText }]
        }]
      })
    });

    const data = await res.json();
    hideTyping();

    if (data.error) {
      console.warn("Error:", data.error);
      currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
      addMessage("Switching key or retrying...", "ai");
      setTimeout(() => callGeminiAPI(userText), 1200);
      return;
    }

    let aiText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!aiText) aiText = "Hmm... I didn’t catch that.";

    addMessage(aiText, "ai");
  } catch (err) {
    hideTyping();
    console.error(err);
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    showError("Network or API error, retrying...");
    setTimeout(() => callGeminiAPI(userText), 1500);
  }
}
