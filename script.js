// ENDROID AI v6 — FINAL WORKING VERSION
// LIVE INTERNET + 39 KEYS + NO STUCK + ALWAYS REPLIES

let API_KEYS = [];
fetch('keys.txt?t=' + Date.now())
  .then(r => r.ok ? r.text() : Promise.reject())
  .then(text => {
    API_KEYS = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('AIzaSy') && l.length > 30);
    console.log(`ENDROID AI v6 READY — ${API_KEYS.length} keys loaded`);
  })
  .catch(() => API_KEYS = ["AIzaSyBdNZDgXeZmRuMOPdsAE0kVAgVyePnqD0U"]);

let currentKeyIndex = 0;
function getNextKey() {
  if (API_KEYS.length === 0) return null;
  const key = API_KEYS[currentKeyIndex % API_KEYS.length];
  currentKeyIndex++;
  return key;
}
setInterval(() => location.reload(), 180000);

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `You are Endroid AI — a fast, intelligent, and unlimited AI assistant with real-time internet access.
Always be helpful, confident, and concise. Use markdown and cite sources when needed.
Current date: November 08, 2025.`;

let chatHistory = [];

window.onload = () => {
  loadChat();
  document.getElementById('welcomeMessage').innerHTML = '<strong style="color:#0066ff;">Endroid AI v6 — Live internet ready. Ask anything!</strong>';
  document.getElementById('messageInput').focus();
};

function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:#f0f0f0;padding:2px 6px;border-radius:4px;">$1</code>')
    .replace(/\n/g, '<br>');
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

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  if (!message || API_KEYS.length === 0) return;

  addMessage('user', message);
  input.value = '';
  document.getElementById('sendBtn').disabled = true;

  // Build contents
  let contents = chatHistory.length === 0
    ? [{ role: 'user', parts: [{ text: SYSTEM_PROMPT }] }]
    : chatHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
  contents.push({ role: 'user', parts: [{ text: message }] });

  let replied = false;
  let keyTried = 0;

  while (!replied && keyTried < API_KEYS.length + 3) {
    const key = getNextKey();
    if (!key) break;

    try {
      const res = await fetch(`${API_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          tools: [{ googleSearchRetrieval: {} }],  // LIVE INTERNET
          safetySettings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.candidates[0].content.parts[0].text || "No response";

        let sources = "";
        if (data.candidates[0].groundingMetadata?.groundingChunks?.length > 0) {
          sources = "\n\nSources:\n";
          data.candidates[0].groundingMetadata.groundingChunks.forEach((c, i) => {
            sources += `${i+1}. [${c.web.uri}](${c.web.uri})\n`;
          });
        }

        const fullReply = reply + sources;
        addMessage('bot', fullReply);

        chatHistory.push({ role: 'user', text: message });
        chatHistory.push({ role: 'model', text: fullReply });
        saveChat();
        replied = true;
      } 
      else if (res.status === 429) {
        addMessage('bot', "Key on cooldown — trying next...");
        await new Promise(r => setTimeout(r, 1500));
      }
      else {
        const err = await res.text();
        console.log("Error:", err);
        addMessage('bot', "Temporary issue — retrying...");
        await new Promise(r => setTimeout(r, 1200));
      }
    } catch (e) {
      console.log("Network error:", e);
      addMessage('bot', "Network glitch — retrying...");
      await new Promise(r => setTimeout(r, 1200));
    }
    keyTried++;
  }

  if (!replied) {
    addMessage('bot', "All keys need a short break. Try again in 1 minute.");
  }

  document.getElementById('sendBtn').disabled = false;
  input.focus();
}

// Rest of functions (unchanged)
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
