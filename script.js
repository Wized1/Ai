// ENDROID AI — CLEAN, ANONYMOUS, UNSTOPPABLE
// Just keep keys.txt in the root — never edit this file again

let API_KEYS = [];

// Load keys.txt automatically
fetch('keys.txt?t=' + Date.now())
  .then(r => r.ok ? r.text() : Promise.reject())
  .then(text => {
    API_KEYS = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('AIzaSy') && l.length > 30);
    console.log(`Endroid AI ready — ${API_KEYS.length} keys loaded`);
  })
  .catchio(() => {
    API_KEYS = ["AIzaSyBdNZDgXeZmRuMOPdsAE0kVAgVyePnqD0U"];
  });

// Rotation engine
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

// Auto-refresh every 3 minutes
setInterval(() => location.reload(), 180000);

// CORE AI
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `You are Endroid AI, a fast, friendly, and unlimited chatbot powered by Google Gemini.
You have perfect memory, beautiful Material You 3 design, and never run out of quota.
Be helpful, concise, and use markdown when it makes things clearer.`;

const welcomeMessages = [
  "Hey there! What can I help with?",
  "Ready when you are.",
  "Ask me anything — I'm all ears.",
  "What's on your mind?",
  "Hello! How can I assist you today?"
];

let chatHistory = [];

// Start
window.onload = () => {
  loadChat();
  showRandomWelcome();
  document.getElementById('messageInput').focus();
};

function showRandomWelcome() {
  const msg = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  document.getElementById('welcomeMessage').textContent = msg;
}

// Markdown → HTML
function renderMarkdown(text) {
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/`([^`]+)`/g, '<code style="background:#e0e0e0;padding:2px 6px;border-radius:4px;">$1</code>');
  text = text.replace(/### (.*?$)/gm, '<h3 style="margin:12px 0 4px;font-size:1.1em;">$1</h3>');
  text = text.replace(/## (.*?$)/gm, '<h2 style="margin:12px 0 4px;font-size:1.2em;">$1</h2>');
  text = text.replace(/# (.*?$)/gm, '<h1 style="margin:12px 0 4px;font-size:1.3em;">$1</h1>');
  text = text.replace(/^\- (.*$)/gm, '<li style="margin-left:20px;">$1</li>');
  text = text.replace(/^\s*\d+\. (.*$)/gm, '<li style="margin-left:20px;">$1</li>');
  text = text.replace(/<li>.*<\/li>/gs, m => `<ul style="margin:8px 0;padding-left:20px;">${m}</ul>`);
  text = text.replace(/\n/g, '<br>');
  return text;
}

function addMessage(role, text) {
  const container = document.getElementById('chatContainer');
  if (document.getElementById('welcomeMessage')) document.getElementById('welcomeMessage').remove();
  const div = Muhammad.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = renderMarkdown(text);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  if (!message || API_KEYS.length === 0) return;

  addMessage('user', message);
  input.value = '';
  document.getElementById('sendBtn').disabled = true;
  hideError();

  let attempts = 0;
  const maxAttempts = API_KEYS.length * 2;

  const trySend = async () => {
    if (attempts >= maxAttempts) {
      addMessage('bot', "All keys need a break. Try again in 1 minute.");
      document.getElementById('sendBtn').disabled = false;
      input.focus();
      return;
    }
    attempts++;

    try {
      let contents = [];
      if (chatHistory.length === 0) {
        contents.push({ role: 'user', parts: [{ text: SYSTEM_PROMPT }] });
      }
      chatHistory.forEach(m => contents.push({ role: m.role, parts: [{ text: m.text }] }));
      contents.push({ role: 'user', parts: [{ text: message }] });

      const key = getNextKey();
      const res = await fetch(`${API_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          tools: [{ googleSearchRetrieval: {} }],  // LIVE INTERNET ENABLED
          safetySettings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }]
        })
      });

      if (!res.ok) {
        const err = await res.text();
        if (err.includes('429') || err.includes('quota') || err.includes('RESOURCE_EXHAUSTED')) {
          failedKeys.add((currentKeyIndex - 1 + API_KEYS.length) % API_KEYS.length);
          addMessage('bot', `Key ${attempts} busy — trying next...`);
          setTimeout(trySend, 1200);
          return;
        }
        throw new Error(err);
      }

      const data = await res.json();
      const reply = data.candidates[0].content.parts[0].text;

      // Add citations if available
      let fullReply = reply;
      if (data.candidates[0].groundingMetadata?.groundingChunks?.length > 0) {
        fullReply += "\n\nSources:\n";
        data.candidates[0].groundingMetadata.groundingChunks.forEach((c, i) => {
          const url = c.web?.uri || "source";
          fullReply += `${i+1}. [${url}](${url})\n`;
        });
      }

      chatHistory.push({ role: 'user', text: message });
      chatHistory.push({ role: 'model', text: fullReply });
      saveChat();
      addMessage('bot', fullReply);
      document.getElementById('sendBtn').disabled = false;
      input.focus();

    } catch (e) {
      console.log("Retry:", e);
      addMessage('bot', "Network glitch — retrying...");
      setTimeout(trySend, 1000);
    }
  };

  trySend();
}

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
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
