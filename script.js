// =============================
// Endroid AI — Wikipedia + Gemini (UI merged)
// =============================

// ---------------- CONFIG ----------------
let API_KEYS = [];
let currentKeyIndex = 0;
let failedKeys = new Set();

const MODEL_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const SYSTEM_PROMPT = `You are Endroid AI — an intelligent, friendly assistant powered by Gemini.
Use the given Wikipedia context as the main truth source.
If context is empty, respond from your own knowledge.`;

// ---------------- LOAD KEYS ----------------
fetch('keys.txt?t=' + Date.now())
  .then(r => r.ok ? r.text() : Promise.reject())
  .then(text => {
    API_KEYS = text.split("\n").map(k => k.trim()).filter(k => k.startsWith("AIzaSy"));
    console.log(`✅ Loaded ${API_KEYS.length} Gemini keys`);
  })
  .catch(() => {
    API_KEYS = ["AIzaSyBdNZDgXeZmRuMOPdsAE0kVAgVyePnqD0U"];
    console.error("⚠️ Failed to load keys.txt — fallback key used");
  });

// ---------------- ROTATION ----------------
function getNextKey() {
  if (API_KEYS.length === 0) return "no-key";
  while (failedKeys.has(currentKeyIndex % API_KEYS.length)) {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  }
  const key = API_KEYS[currentKeyIndex % API_KEYS.length];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

// ---------------- WIKIPEDIA ----------------
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

// ---------------- GEMINI ----------------
async function geminiReply(prompt, wikiContext) {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT + "\n\nWikipedia context:\n" + wikiContext + "\n\nUser: " + prompt }]
      }
    ]
  };

  for (let i = 0; i < API_KEYS.length; i++) {
    const key = getNextKey();

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

// ---------------- UI ----------------
const welcomeMessages = [
  "Hey there! What can I help with?",
  "Ready when you are.",
  "Ask me anything — I'm all ears.",
  "What's on your mind?",
  "Hello! How can I assist you today?"
];

let chatHistory = [];

window.onload = () => {
  loadChat();
  showRandomWelcome();
  document.getElementById('messageInput').focus();
};

function showRandomWelcome() {
  const msg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  document.getElementById('welcomeMessage').textContent = msg;
}

function renderMarkdown(text) {
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code style="background:#e0e0e0;padding:2px 6px;border-radius:4px;">$1</code>');
  text = text.replace(/\n/g, '<br>');
  return text;
}

function addMessage(role, text) {
  const container = document.getElementById('chatContainer');
  if (document.getElementById('welcomeMessage')) document.getElementById('welcomeMessage').remove();
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = renderMarkdown(text);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ---------------- TYPING ----------------
function showTyping() {
  const container = document.getElementById('chatContainer');
  let typing = document.getElementById('typing');
  if (!typing) {
    typing = document.createElement('div');
    typing.id = 'typing';
    typing.className = 'message bot typing';
    typing.innerHTML = '<span>.</span><span>.</span><span>.</span>';
    container.appendChild(typing);
  }
  container.scrollTop = container.scrollHeight;
}

function hideTyping() {
  const t = document.getElementById('typing');
  if (t) t.remove();
}

// Typing animation CSS
document.head.insertAdjacentHTML('beforeend', `
<style>
.message.bot.typing span {
  display:inline-block;
  animation: blink 1.2s infinite;
  font-size: 20px;
  color:#999;
}
.message.bot.typing span:nth-child(2){animation-delay:0.2s;}
.message.bot.typing span:nth-child(3){animation-delay:0.4s;}
@keyframes blink {0%,80%,100%{opacity:0;}40%{opacity:1;}}
</style>
`);

// ---------------- MAIN ----------------
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  if (!message) return;

  addMessage('user', message);
  input.value = '';
  document.getElementById('sendBtn').disabled = true;
  showTyping();

  try {
    addMessage('system', "_🔎 Fetching Wikipedia data..._");
    const wiki = await wikipediaSearch(message);

    addMessage('system', "_🤖 Querying Gemini..._");
    const reply = await geminiReply(message, wiki);

    hideTyping();
    addMessage('bot', reply);
    addMessage('system', "_📚 Source: Wikipedia + Gemini._");

    chatHistory.push({ role: 'user', text: message });
    chatHistory.push({ role: 'model', text: reply });
    saveChat();

  } catch (err) {
    hideTyping();
    console.error(err);
    addMessage('bot', "⚠️ Failed to get a response. Try again later.");
  } finally {
    document.getElementById('sendBtn').disabled = false;
  }
}

// ---------------- LOCAL STORAGE ----------------
function saveChat() { localStorage.setItem('endroid_chat', JSON.stringify(chatHistory)); }
function loadChat() {
  const saved = localStorage.getItem('endroid_chat');
  if (saved) {
    chatHistory = JSON.parse(saved);
    chatHistory.forEach(m => addMessage(m.role === 'model' ? 'bot' : 'user', m.text));
  }
}

// ---------------- EVENT ----------------
document.getElementById('messageInput').addEventListener('keypress', e => {
  if (e.key === 'Enter') sendMessage();
});
