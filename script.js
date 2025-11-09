// ENDROID AI — GEMINI + WIKIPEDIA + TYPING ANIMATION (FINAL)

let API_KEYS = [];
let currentKey = 0;
let failedKeys = new Set();

const MODEL_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const SYSTEM_PROMPT = `You are Endroid AI — an intelligent, friendly assistant powered by Gemini.
Use the given Wikipedia context as the main truth source.
If context is empty, respond from your own knowledge.
Do NOT use Wikipedia for simple greetings like "hi" or "hello".`;

// Load API keys
fetch("keys.txt?t=" + Date.now())
  .then(r => r.text())
  .then(text => {
    API_KEYS = text.split("\n").map(k => k.trim()).filter(k => k.startsWith("AIzaSy"));
    console.log(`✅ Loaded ${API_KEYS.length} Gemini keys`);
  })
  .catch(() => {
    API_KEYS = [];
    console.error("⚠️ Failed to load keys.txt");
  });

// ---------- WIKIPEDIA ----------
async function wikipediaSearch(query) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    const results = data.query.search.slice(0, 3);
    let out = [];

    for (let r of results) {
      const page = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&format=json&pageids=${r.pageid}&origin=*`);
      const pdata = await page.json();
      const txt = pdata.query.pages[r.pageid].extract;
      out.push(`📘 ${r.title}\n${txt}`);
    }

    return out.length ? out.join("\n\n") : "No Wikipedia data found.";
  } catch {
    return "No Wikipedia data available (fetch failed).";
  }
}

// ---------- GEMINI ----------
async function geminiReply(prompt, wikiContext) {
  const context = `Wikipedia context:\n${wikiContext}`;
  const body = {
    contents: [
      { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + context + "\n\nUser: " + prompt }] }
    ]
  };

  for (let i = 0; i < API_KEYS.length; i++) {
    const key = API_KEYS[currentKey];
    currentKey = (currentKey + 1) % API_KEYS.length;

    try {
      const res = await fetch(`${MODEL_URL}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.text();
        console.warn(`❌ Key ${i + 1} failed: ${err}`);
        failedKeys.add(key);
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;

    } catch (err) {
      console.warn(`⚠️ Key ${i + 1} error:`, err.message);
      failedKeys.add(key);
    }
  }

  throw new Error("All keys failed or returned empty.");
}

// ---------- UI ----------
function renderMarkdown(t) {
  return t
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<i>$1</i>")
    .replace(/\n/g, "<br>");
}

function addMessage(role, text, typing = false) {
  const chat = document.getElementById("chatContainer");

  // Remove welcome message if chat is not empty
  const welcomeEl = document.getElementById("welcomeMessage");
  if (welcomeEl) welcomeEl.remove();

  const msg = document.createElement("div");
  msg.className = `message ${role}`;
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;

  if (typing && role === "bot") {
    let i = 0;
    const interval = setInterval(() => {
      msg.innerHTML = renderMarkdown(text.slice(0, i + 1));
      i++;
      chat.scrollTop = chat.scrollHeight;
      if (i >= text.length) clearInterval(interval);
    }, 20); // typing speed: 20ms per character
  } else {
    msg.innerHTML = renderMarkdown(text);
  }
}

// ---------- MAIN ----------
async function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  if (!message) return;

  addMessage("user", message);
  input.value = "";
  document.getElementById("sendBtn").disabled = true;

  try {
    addMessage("system", "Fetching Wikipedia data...");
    const wiki = await wikipediaSearch(message);

    addMessage("system", "_🤖 Querying Gemini..._");
    const reply = await geminiReply(message, wiki);

    addMessage("bot", reply, true); // typing animation
    addMessage("system", "📚 Source: Wikipedia + Gemini.");
  } catch (e) {
    console.error(e);
    addMessage("bot", "⚠️ Failed to get a response. Try again later.", true);
  } finally {
    document.getElementById("sendBtn").disabled = false;
  }
}

// ---------- CLEAR HISTORY ----------
function clearHistory() {
  if (confirm("Clear chat history?")) {
    chatHistory = [];
    saveChat();
    document.getElementById("chatContainer").innerHTML = '<div class="welcome" id="welcomeMessage"></div>';
    showRandomWelcome();
  }
}

// ---------- EVENTS ----------
document.getElementById("messageInput").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});

// ---------- LOCAL STORAGE ----------
function saveChat() { localStorage.setItem('endroid_chat', JSON.stringify(chatHistory)); }
function loadChat() {
  const saved = localStorage.getItem('endroid_chat');
  if (saved) {
    chatHistory = JSON.parse(saved);
    chatHistory.forEach(m => addMessage(m.role === 'model' ? 'bot' : 'user', m.text));
  }
}

// ---------- WELCOME ----------
const welcomeMessages = [
  "Hey there! What can I help with?",
  "Ready when you are.",
  "Ask me anything — I'm all ears.",
  "What's on your mind?",
  "Hello! How can I assist you today?"
];

function showRandomWelcome() {
  const msg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  const el = document.getElementById('welcomeMessage');
  if (el) el.textContent = msg;
}

window.onload = () => {
  loadChat();
  showRandomWelcome();
  document.getElementById("messageInput").focus();
};
