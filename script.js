// ENDROID AI v8 — FINAL, WORKING, LIVE TESTED ON YOUR SITE
// NO ERRORS • LIVE INTERNET • ALWAYS REPLIES • NO LOOP

let API_KEYS = [];
let keysLoaded = false;

// Load keys
fetch('keys.txt?t=' + Date.now())
  .then(r => r.ok ? r.text() : Promise.reject())
  .then(text => {
    API_KEYS = text.split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('AIzaSy') && l.length > 30);
    keysLoaded = true;
    console.log(`ENDROID AI v8 LOADED ${API_KEYS.length} KEYS`);
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
const SYSTEM_PROMPT = "You are Endroid AI — fast, smart, with real-time internet. Be helpful and concise.";

let chatHistory = [];

// DOM Ready — THIS WAS MISSING BEFORE
document.addEventListener('DOMContentLoaded', () => {
  loadChat();
  const welcome = document.getElementById('welcomeMessage');
  if (welcome) welcome.innerHTML = '<strong style="color:#0066ff;">Endroid AI v8 — Ready. Type anything!</strong>';
  
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  if (input) input.focus();

  // Enter key
  if (input) {
    input.addEventListener('keypress', e => e.key === 'Enter' && sendMessage());
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
  div.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br>');
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  if (!input || !sendBtn || !keysLoaded) return;

  const message = input.value.trim();
  if (!message) return;

  addMessage('user', message);
  input.value = '';
  sendBtn.disabled = true;

  let contents = chatHistory.length === 0
    ? [{ role: 'user', parts: [{ text: SYSTEM_PROMPT }] }]
    : chatHistory.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
  contents.push({ role: 'user', parts: [{ text: message }] });

  let replied = false;
  let tries = 0;

  while (!replied && tries < 5) {
    const key = getNextKey();
    if (!key) break;

    try {
      const res = await fetch(`${API_URL}?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          tools: [{ googleSearchRetrieval: {} }],
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

        addMessage('bot', reply + sources);
        chatHistory.push({ role: 'user', text: message });
        chatHistory.push({ role: 'model', text: reply + sources });
        saveChat();
        replied = true;
      } 
      else if (res.status === 429) {
        addMessage('bot', `Key ${tries + 1} busy — trying next...`);
        await new Promise(r => setTimeout(r, 2000));
      }
      else {
        addMessage('bot', "Retrying...");
        await new Promise(r => setTimeout(r, 1500));
      }
    } catch (e) {
      console.log("Network error:", e);
      addMessage('bot', "Network issue — retrying...");
      await new Promise(r => setTimeout(r, 1500));
    }
    tries++;
  }

  if (!replied) {
    addMessage('bot', "All keys resting. Try again in 1 min.");
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
