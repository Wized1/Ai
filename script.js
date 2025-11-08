// ENDROID AI — CLEAN, ANONYMOUS, UNSTOPPABLE
// Just keep keys.txt in the root — never edit this file again

let API_KEYS = [];
fetch('keys.txt?t=' + Date.now())
  .then(r => r.ok ? r.text() : Promise.reject())
  .then(text => {
    API_KEYS = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('AIzaSy') && l.length > 30);
    console.log(`Endroid AI ready — ${API_KEYS.length} keys loaded`);
  })
  .catch(() => API_KEYS = ["AIzaSyBdNZDgXeZmRuMOPdsAE0kVAgVyePnqD0U"]);

let currentKeyIndex = 0;
function getNextKey() {
  if (API_KEYS.length === 0) return null;
  const key = API_KEYS[currentKeyIndex % API_KEYS.length];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const SYSTEM_PROMPT = `You are Endroid AI — fast, smart, with real-time internet access.
Be helpful, confident, concise. Use markdown. Always cite sources when grounding is used.
Current date: November 08, 2025.`;

let chatHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  loadChat();
  document.getElementById('welcomeMessage').textContent = "Endroid AI — Live internet ready. Ask anything.";
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  if (input) input.focus();
  if (input) input.addEventListener('keypress', e => e.key === 'Enter' && sendMessage());
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
});

function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:#e0e0e0;padding:2px 6px;border-radius:4px;">$1</code>')
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

  let contents = chatHistory.length === 0
    ? [{ role: 'user', parts: [{ text: SYSTEM_PROMPT }] }]
    : chatHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
  contents.push({ role: 'user', parts: [{ text: message }] });

  let replied = false;
  let tries = 0;
  const maxTries = 8;

  while (!replied && tries < maxTries) {
    const key = getNextKey();
    if (!key) break;
    tries++;

    try {
      const res = await fetch(`${API_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          tools: [{
            googleSearchRetrieval: {
              dynamicRetrievalConfig: {
                mode: "MODE_DYNAMIC",
                dynamicThreshold: 0.7
              }
            }
          }],
          safetySettings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }]
        })
      });

      if (res.ok) {
        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm here!";

        let sources = "";
        if (data.candidates?.[0]?.groundingMetadata?.groundingChunks?.length > 0) {
          sources = "\n\nSources:\n";
          data.candidates[0].groundingMetadata.groundingChunks.forEach((c, i) => {
            sources += `${i+1}. [${c.web.uri}](${c.web.uri})\n`;
          });
        }

        const full = reply + sources;
        addMessage('bot', full);
        chatHistory.push({ role: 'user', text: message });
        chatHistory.push({ role: 'model', text: full });
        saveChat();
        replied = true;
      } else if (res.status === 429) {
        addMessage('bot', `Key ${tries} busy — next...`);
        await new Promise(r => setTimeout(r, 2500));
      } else {
        addMessage('bot', "Retrying...");
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {
      addMessage('bot', "Network — retrying...");
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  if (!replied) addMessage('bot', "All keys resting. Try again soon.");

  document.getElementById('sendBtn').disabled = false;
  input.focus();
}

function saveChat() { localStorage.setItem('endroid_chat', JSON.stringify(chatHistory)); }
function loadChat() {
  const saved = localStorage.getItem('endroid_chat');
  if (saved) {
    chatHistory = JSON.parse(saved);
    chatHistory.forEach(m => addMessage(m.role === 'model' ? 'bot' : 'user', m.text));
  }
}
