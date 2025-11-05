// === 18 GEMINI API KEYS (HARDCODED ROTATION) ===
const API_KEYS = [
  "AIzaSyBdNZDgXeZmRuMOPdsAE0kVAgVyePnqD0U", "AIzaSyDCCSGoNrf1ZZi2svks6lj9V2W1ox5OtiU", "AIzaSyCU8Akk46dS8uCjVem8lPDUNaxoDjVqhZs", "AIzaSyCxoaPTErbKc-Sq2JjDjA5fMHjduf9-hAw", "AIzaSyD9EgTrgDJvSLrjjjKXBk7-KfC24j7nAeU",
  "AIzaSyDGRRp4A7mv1vhgyWWk6XDb1KtzwnObeyU", "AIzaSyCQ-G0xc6l2rJ-DDy6bg0yNeqmDyECdUEk", "AIzaSyDR_ga1sqbuWnVL8_NxJNlJujE1SVPrCJ0", "AIzaSyBlq4fMR-4wJaw75rI5Or2wvnT-ZSsnpXA", "AIzaSyAYzege9YuocR1ylLqNdK0bG27Ua5CTOaU",
  "AIzaSyDDxaqLm7EQfEOwtGmT-rXUKt429rxsu9M", "AIzaSyDgF9tvssrWwyZINdyAUoaerMsY0o2IqSI", "AIzaSyCv843agxSLutHcEB0DAdb6-KPDtn094eE", "AIzaSyCpzPLORL_5e86TFlTSafYT3mCW-LCnW54", "AIzaSyAUepPTa_WhZwrQW13YVQyoDnn9rafmENw",
  "AIzaSyDsbQk6l5MJJIfwD_WNJsUqcXbljyD1IsM", "AIzaSyCjjnSvk7x8Di-DCpANryXmM4lfHKnoEyU", "AIzaSyBgK87yqLG9uzhLaCUfDhJOLthxlZVuIvM"
];

let currentKeyIndex = 0;
let failedKeys = new Set();

function getNextKey() {
  while (failedKeys.has(currentKeyIndex % API_KEYS.length)) {
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  }
  const key = API_KEYS[currentKeyIndex % API_KEYS.length];
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  return key;
}

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// === SYSTEM PROMPT ===
const SYSTEM_PROMPT = "You are Endroid AI, a super-intelligent, witty, and helpful assistant powered by Google Gemini. You have a perfect memory—always reference past conversation details naturally. Be concise, fun, and use markdown for clarity. Never forget who you are or what we've discussed!";

// === RANDOM WELCOME MESSAGES ===
const welcomeMessages = [
  "What can I help with?", "Ask me anything.", "How can I assist you today?",
  "Ready to chat?", "What's on your mind?"
];

let chatHistory = []; // {role: 'user'|'model', text: '...'}

// Load & Render
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
  text = text.replace(/### (.*?$)/gm, '<h3 style="margin:12px 0 4px;font-size:1.1em;">$1</h3>');
  text = text.replace(/## (.*?$)/gm, '<h2 style="margin:12px 0 4px;font-size:1.2em;">$1</h2>');
  text = text.replace(/# (.*?$)/gm, '<h1 style="margin:12px 0 4px;font-size:1.3em;">$1</h1>');
  text = text.replace(/^\- (.*$)/gm, '<li style="margin-left:20px;">$1</li>');
  text = text.replace(/^\s*\d+\. (.*$)/gm, '<li style="margin-left:20px;">$1</li>');
  text = text.replace(/<li>.*<\/li>/gs, match => `<ul style="margin:8px 0;padding-left:20px;">${match}</ul>`);
  text = text.replace(/\n/g, '<br>');
  return text;
}

function addMessage(role, text) {
  const container = document.getElementById('chatContainer');
  if (document.getElementById('welcomeMessage')) {
    document.getElementById('welcomeMessage').remove();
  }
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = renderMarkdown(text);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  if (!message) return;

  addMessage('user', message);
  input.value = '';
  document.getElementById('sendBtn').disabled = true;
  hideError();

  try {
    let contents = [];
    if (chatHistory.length === 0) {
      contents.push({ role: 'user', parts: [{ text: SYSTEM_PROMPT }] });
    }
    chatHistory.forEach(m => {
      contents.push({ role: m.role, parts: [{ text: m.text }] });
    });
    contents.push({ role: 'user', parts: [{ text: message }] });

    const key = getNextKey();
    const fullUrl = `${API_URL}?key=${key}`;
    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!res.ok) {
      const err = await res.text();
      if (err.includes('429') || err.includes('quota')) {
        failedKeys.add((currentKeyIndex - 1 + API_KEYS.length) % API_KEYS.length);
        console.warn(`Key failed, rotating... (${failedKeys.size}/18)`);
        return sendMessage();  // Retry
      }
      throw new Error(`API Error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const reply = data.candidates[0].content.parts[0].text;

    chatHistory.push({ role: 'user', text: message });
    chatHistory.push({ role: 'model', text: reply });
    saveChat();

    addMessage('bot', reply);
  } catch (err) {
    console.error(err);
    showError(`Error: ${err.message}. Check console.`);
    addMessage('bot', "Sorry, something went wrong. Retrying...");
  } finally {
    document.getElementById('sendBtn').disabled = false;
    input.focus();
  }
}

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 8000);
}
function hideError() {
  document.getElementById('error').classList.add('hidden');
}

function clearHistory() {
  if (confirm("Clear chat history?")) {
    chatHistory = [];
    saveChat();
    document.getElementById('chatContainer').innerHTML = '<div class="welcome" id="welcomeMessage"></div>';
    showRandomWelcome();
  }
}

function saveChat() {
  localStorage.setItem('endroid_chat', JSON.stringify(chatHistory));
}
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