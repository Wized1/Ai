// ENDROID AI — WIKIPEDIA POWERED (FINAL BUILD)
// No auto refresh — stable Gemini + Wikipedia combo

let API_KEYS = [];

// Load API keys from keys.txt
fetch('keys.txt?t=' + Date.now())
  .then(r => r.ok ? r.text() : Promise.reject())
  .then(text => {
    API_KEYS = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('AIzaSy') && l.length > 30);
    console.log(`Endroid AI ready — ${API_KEYS.length} keys loaded`);
  })
  .catch(() => {
    API_KEYS = ["AIzaSyBdNZDgXeZmRuMOPdsAE0kVAgVyePnqD0U"]; // fallback
  });

// ---------- KEY ROTATION ----------
let currentKeyIndex = 0;
let failedKeys = new Set();

function getNextKey() {
  if (API_KEYS.length === 0) return "no-key";
  while (failedKeys.has(currentKeyIndex % API_KEYS.length)) {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  }
  const key = API_KEYS[currentKeyIndex % API_KEYS.length];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

// ---------- CONSTANTS ----------
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const SYSTEM_PROMPT = `You are Endroid AI, a fast, friendly, and up-to-date assistant powered by Google Gemini.
You use the Wikipedia context as accurate live information.
Never doubt or ignore the context. If context is empty, use your own knowledge.`;

// ---------- WIKIPEDIA SEARCH ----------
async function wikipediaSearch(query) {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`;
    const res = await fetch(searchUrl);
    const data = await res.json();
    const results = data.query.search.slice(0, 5);

    let sources = [];
    for (let r of results) {
      const pageRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&format=json&pageids=${r.pageid}&origin=*`);
      const pageData = await pageRes.json();
      const pageExtract = pageData.query.pages[r.pageid].extract;
      sources.push(`📘 ${r.title}\n${pageExtract}`);
    }

    if (sources.length === 0) sources = ["No live data available from Wikipedia."];
    return sources;
  } catch (err) {
    console.warn("Wikipedia fetch failed:", err);
    return Array(5).fill("No live data available.");
  }
}

// ---------- UI ----------
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
  text = text.replace(/### (.*?$)/gm, '<h3>$1</h3>');
  text = text.replace(/## (.*?$)/gm, '<h2>$1</h2>');
  text = text.replace(/# (.*?$)/gm, '<h1>$1</h1>');
  text = text.replace(/^\- (.*$)/gm, '<li>$1</li>');
  text = text.replace(/^\s*\d+\. (.*$)/gm, '<li>$1</li>');
  text = text.replace(/<li>.*<\/li>/gs, m => `<ul>${m}</ul>`);
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

// ---------- MAIN SEND FUNCTION ----------
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  if (!message) return;
  if (API_KEYS.length === 0) {
    addMessage('bot', "⚠️ No API keys loaded. Check keys.txt.");
    return;
  }

  addMessage('user', message);
  input.value = '';
  document.getElementById('sendBtn').disabled = true;
  hideError();

  try {
    // STEP 1 — Wikipedia
    addMessage('system', "_🔍 Gathering live Wikipedia data..._");
    const wikiSources = await wikipediaSearch(message);
    const wikiContext = wikiSources.join("\n\n");

    // STEP 2 — Build prompt
    const contents = [
      { role: "system", parts: [{ text: SYSTEM_PROMPT }] },
      { role: "system", parts: [{ text: "Wikipedia Context:\n" + wikiContext }] },
      { role: "user", parts: [{ text: message }] }
    ];

    // STEP 3 — Try keys sequentially
    let reply = "";
    let success = false;

    for (let i = 0; i < API_KEYS.length; i++) {
      const key = getNextKey();
      addMessage("system", `_Using API key #${i + 1} of ${API_KEYS.length}..._`);

      try {
        const res = await fetch(`${API_URL}?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents, tools: [] })
        });

        if (!res.ok) {
          const errText = await res.text();
          if (res.status === 429 || errText.includes("quota")) {
            console.warn(`Key ${i + 1} quota exceeded.`);
            failedKeys.add(i);
            continue;
          }
          throw new Error(errText);
        }

        const data = await res.json();
        reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "(No reply)";
        success = true;
        break;

      } catch (err) {
        console.warn(`Key ${i + 1} failed:`, err.message);
        failedKeys.add(i);
      }
    }

    if (!success) {
      addMessage('bot', "⚠️ All API keys failed or quota exceeded. Please update keys.txt.");
    } else {
      chatHistory.push({ role: 'user', text: message });
      chatHistory.push({ role: 'model', text: reply });
      saveChat();
      addMessage('bot', reply);
      addMessage('system', "_📚 Data based on live Wikipedia context._");
    }

  } catch (err) {
    console.error("Unexpected error:", err);
    addMessage('bot', "⚠️ Something went wrong while processing your request.");
  } finally {
    document.getElementById('sendBtn').disabled = false;
    input.focus();
  }
}

// ---------- UTILITIES ----------
function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function hideError() { document.getElementById('error').classList.add('hidden'); }

function clearHistory() {
  if (confirm("Clear chat history?")) {
    chatHistory = [];
    saveChat();
    document.getElementById('chatContainer').innerHTML = '<div class="welcome" id="welcomeMessage"></div>';
    showRandomWelcome();
  }
}

function saveChat() { localStorage.setItem('endroid_chat', JSON.stringify(chatHistory)); }

function loadChat() {
  const saved = localStorage.getItem('endroid_chat');
  if (saved) {
    chatHistory = JSON.parse(saved);
    chatHistory.forEach(m => addMessage(m.role === 'model' ? 'bot' : 'user', m.text));
  }
}

document.getElementById('messageInput').addEventListener('keypress', e => {
  if (e.key === 'Enter') sendMessage();
});
