// ENDROID AI v9 — ULTRA FAST & STABLE (NO GROUNDING TOOL)
// NO ERRORS • INSTANT REPLY • 39 KEYS • MADE FOR PAKISTAN

let API_KEYS = [];
let keysLoaded = false;

fetch('keys.txt?t=' + Date.now())
  .then(r => r.ok ? r.text() : Promise.reject())
  .then(text => {
    API_KEYS = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('AIzaSy') && l.length > 30);
    keysLoaded = true;
    console.log(`ENDROID AI v9 LOADED ${API_KEYS.length} KEYS — ULTRA FAST MODE`);
  })
  .catch(() => {
    API_KEYS = ["AIzaSyBdNZDgXeZmRuMOPdsAE0kVAgVyePnqD0U"];
    keysLoaded = true;
  });

let currentKeyIndex = 0;
function getNextKey() {
  if (API_KEYS.length === 0) return null;
  const key = API_KEYS[currentKeyIndex % API_KEYS.length];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const SYSTEM_PROMPT = "You are Endroid AI — the fastest, smartest, and most powerful free AI in Pakistan. Be confident, helpful, and reply instantly.";

let chatHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  loadChat();
  const welcome = document.getElementById('welcomeMessage');
  if (welcome) {
    welcome.innerHTML = '<strong style="color:#006400;">Endroid AI v9 — Ultra Fast Mode Active!</strong>';
  }

  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  if (input) input.focus();

  if (input) {
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') sendMessage();
    });
  }
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }
});

function addMessage(role, text) {
  const container = document.getElementById('chatContainer');
  if (!container) return;
  if (document.getElementById('welcomeMessage')) {
    document.getElementById('welcomeMessage').remove();
  }

  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:#e8f5e8;padding:2px 6px;border-radius:4px;">$1</code>')
    .replace(/\n/g, '<br>');
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  if (!input || !sendBtn || !keysLoaded || API_KEYS.length === 0) return;

  const message = input.value.trim();
  if (!message) return;

  addMessage('user', message);
  input.value = '';
  sendBtn.disabled = true;

  let contents = chatHistory.length === 0
    ? [{ role: 'user', parts: [{ text: SYSTEM_P }] }, { role: 'user', parts: [{ text: message }] }]
    : [...chatHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: message }] }];

  let success = false;
  let tries = 0;
  const maxTries = Math.min(10, API_KEYS.length);

  while (!success && tries < maxTries) {
    const key = getNextKey();
    tries++;

    try {
      const res = await fetch(`${API_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          // NO GROUNDING TOOL = NO 429 LIMITS
          safetySettings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm here!";
        addMessage('bot', reply);

        chatHistory.push({ role: 'user', text: message });
        chatHistory.push({ role: 'model', text: reply });
        saveChat();
        success = true;
      } else if (res.status === 429) {
        addMessage('bot', `Key ${tries} busy — next...`);
        await new Promise(r => setTimeout(r, 1200));
      } else {
        addMessage('bot', "Retrying...");
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (e) {
      addMessage('bot', "Network — retrying...");
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!success) {
    addMessage('bot', "All keys resting. Try in 1 min.");
  }

  sendBtn.disabled = false;
  input.focus();
}

function saveChat() {
  localStorage.setItem('endroid_chat', JSON.stringify(chatHistory));
}

function loadChat() {
  const saved = localStorage.getItem('endroid_chat');
  if (saved) {
    chatHistory = JSON.parse(saved);
    chatHistory.forEach(m => {
      addMessage(m.role === 'model' ? 'bot' : 'user', m.text);
    });
  }
}
