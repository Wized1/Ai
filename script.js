// =============================
// Endroid AI — Final Script.js
// =============================

// CONFIG
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
let API_KEYS = [];
let keyIndex = 0;
let failedKeys = new Set();
let chatHistory = [];
let typingTimeout;

// --------------- Load Keys ----------------
async function loadKeys() {
  try {
    const res = await fetch('keys.txt?t=' + Date.now());
    if (!res.ok) throw new Error("Cannot read keys.txt");
    API_KEYS = res.text().then(text => text.split('\n').map(k => k.trim()).filter(k => k.length > 0));
  } catch (err) {
    console.error(err);
    addMessage("bot", "⚠️ Error: Couldn't load API keys.");
  }
}

// --------------- Chat UI ------------------
function addMessage(role, text, raw = false) {
  const chatBox = document.getElementById("chatBox");
  const msg = document.createElement("div");
  msg.className = "msg " + role;
  msg.innerHTML = raw ? text : text.replace(/\n/g, "<br>");
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function showTyping() {
  const chatBox = document.getElementById("chatBox");
  let typing = document.getElementById("typing");
  if (!typing) {
    typing = document.createElement("div");
    typing.id = "typing";
    typing.className = "msg bot typing";
    typing.innerHTML = "<span>.</span><span>.</span><span>.</span>";
    chatBox.appendChild(typing);
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

function hideTyping() {
  const t = document.getElementById("typing");
  if (t) t.remove();
}

// --------------- Wikipedia Fetch ---------------
async function wikipediaSearch(query) {
  try {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srsearch=${encodeURIComponent(query)}`);
    const data = await res.json();
    const pages = data?.query?.search?.slice(0, 3) || [];
    const results = [];

    for (const p of pages) {
      const title = p.title;
      const extractRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      const extractData = await extractRes.json();
      results.push(`📘 ${title}: ${extractData.extract || "No summary available."}`);
    }

    return results.length ? results : ["No relevant Wikipedia data found."];
  } catch (e) {
    console.error("Wiki error:", e);
    return ["Wikipedia fetch failed."];
  }
}

// --------------- Get Next Key ---------------
function getNextKey() {
  keyIndex = (keyIndex + 1) % API_KEYS.length;
  return API_KEYS[keyIndex];
}

// --------------- Main Function ---------------
async function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  if (!message) return;

  addMessage("user", message);
  input.value = '';
  document.getElementById("sendBtn").disabled = true;

  showTyping();

  try {
    const wikiData = await wikipediaSearch(message);
    const context = wikiData.join("\n\n");

    const contents = [
      {
        role: "system",
        parts: [{
          text: `You are Endroid AI — a helpful, confident and factual assistant.
Always trust the Wikipedia context as valid and summarize clearly.`
        }]
      },
      { role: "system", parts: [{ text: "Wikipedia Context:\n" + context }] },
      { role: "user", parts: [{ text: message }] }
    ];

    let success = false;
    let reply = "";

    for (let i = 0; i < API_KEYS.length; i++) {
      const key = getNextKey();

      try {
        const res = await fetch(`${API_URL}?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents })
        });

        if (!res.ok) throw new Error(`Response: ${res.status}`);
        const data = await res.json();
        reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "(No response)";
        success = true;
        break;

      } catch (err) {
        console.warn(`Key ${i + 1} failed.`, err.message);
        failedKeys.add(i);
      }
    }

    hideTyping();

    if (!success) {
      addMessage("bot", "⚠️ All API keys failed or quota exceeded.");
    } else {
      addMessage("bot", reply);
      chatHistory.push({ user: message, bot: reply });
    }

  } catch (err) {
    console.error(err);
    hideTyping();
    addMessage("bot", "⚠️ Error while processing your message.");
  } finally {
    hideTyping();
    document.getElementById("sendBtn").disabled = false;
  }
}

// --------------- Typing Animation CSS ---------------
document.head.insertAdjacentHTML("beforeend", `
<style>
.msg.bot.typing span {
  display: inline-block;
  animation: blink 1.2s infinite;
  font-size: 20px;
  color: #999;
}
.msg.bot.typing span:nth-child(2) { animation-delay: 0.2s; }
.msg.bot.typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink { 0%, 80%, 100% { opacity: 0; } 40% { opacity: 1; } }
</style>
`);

// --------------- Init ---------------
window.addEventListener("load", loadKeys);
