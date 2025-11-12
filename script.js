// ENDROID AI — GEMINI + WIKIPEDIA + STRONG DECISION LOGIC + WEATHER (FINAL)

let API_KEYS = [];
let currentKey = 0;
let failedKeys = new Set();
let chatHistory = [];

const MODEL_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const SYSTEM_PROMPT = `You are Endroid AI — an intelligent, friendly assistant powered by Gemini.
Use the given Wikipedia context as the main truth source.
If context is empty, respond from your own knowledge.
Do NOT use Wikipedia for simple greetings like "hi" or "hello".`;

// ---------------- LOAD KEYS ----------------
fetch("keys.txt?t=" + Date.now())
  .then(r => r.text())
  .then(text => {
    API_KEYS = text.split(/\r?\n/).map(k => k.trim()).filter(k => k.startsWith("AIzaSy"));
    console.log(`✅ Loaded ${API_KEYS.length} Gemini keys`);
  })
  .catch(() => {
    API_KEYS = [];
    console.error("⚠️ Failed to load keys.txt");
  });

// ---------------- ROTATION ----------------
function getNextKey() {
  if (API_KEYS.length === 0) return "no-key";
  let attempts = 0;
  while (failedKeys.has(currentKey) && attempts < API_KEYS.length) {
    currentKey = (currentKey + 1) % API_KEYS.length;
    attempts++;
  }
  const key = API_KEYS[currentKey % API_KEYS.length];
  currentKey = (currentKey + 1) % API_KEYS.length;
  return key;
}

// ---------------- WIKIPEDIA ----------------
async function wikipediaSearch(query) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    const results = (data.query && data.query.search) ? data.query.search.slice(0, 5) : [];
    let out = [];
    for (let r of results) {
      try {
        const page = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&format=json&pageids=${r.pageid}&origin=*`);
        const pdata = await page.json();
        const txt = pdata.query.pages[r.pageid].extract || "";
        out.push(`📘 ${r.title}\n${txt}`);
      } catch {}
    }
    return out.length ? out.join("\n\n") : "No Wikipedia data found.";
  } catch {
    return "No Wikipedia data available (fetch failed).";
  }
}

// ---------------- WEATHER FEATURE ----------------
function shouldUseWeather(message) {
  const lower = message.toLowerCase();
  return /(weather|temperature|forecast|humidity|rain|wind|snow|hot|cold|climate)/i.test(lower);
}

async function getWeather(locationQuery) {
  // Helper: fetch weather using Open-Meteo
  const weatherUrl = (lat, lon) =>
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;

  // If location name provided, use geocoding
  if (locationQuery && !/my|here|current/i.test(locationQuery)) {
    try {
      const geo = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationQuery)}&count=1`
      );
      const gdata = await geo.json();
      if (gdata.results && gdata.results[0]) {
        const { latitude, longitude, name, country } = gdata.results[0];
        const res = await fetch(weatherUrl(latitude, longitude));
        const data = await res.json();
        const w = data.current;
        return `🌤️ Weather in ${name}, ${country}:\n• Temperature: ${w.temperature_2m}°C\n• Humidity: ${w.relative_humidity_2m}%\n• Wind: ${w.wind_speed_10m} km/h`;
      }
      return "⚠️ Couldn't find that city.";
    } catch {
      return "⚠️ Weather data fetch failed.";
    }
  }

  // Otherwise, ask for location permission
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve("⚠️ Geolocation not supported in this browser.");
      return;
    }
    addMessage("system", "Requesting location access...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lon = pos.coords.longitude.toFixed(4);
        try {
          const res = await fetch(weatherUrl(lat, lon));
          const data = await res.json();
          const w = data.current;
          resolve(`🌤️ Current weather at your location:\n• Temperature: ${w.temperature_2m}°C\n• Humidity: ${w.relative_humidity_2m}%\n• Wind: ${w.wind_speed_10m} km/h`);
        } catch {
          resolve("⚠️ Couldn't fetch weather data for your location.");
        }
      },
      () => resolve("⚠️ Location permission denied.")
    );
  });
}

// ---------------- SMART DECISION LOGIC ----------------
function shouldUseWikipedia(message) {
  if (!message || typeof message !== "string") return false;
  const m = message.trim();
  if (m.length === 0) return false;
  const lower = m.toLowerCase();
  const casual = /^(hi|hello|hey|ok|okay|thanks|thank you|please|yes|no|sure|man|hmm|wow|lol|haha|huh|alright|cool|good|fine|great|awesome|bye|goodbye|yo|sup)$/i;
  if (casual.test(lower)) return false;
  if (m.length <= 4 && !/[?]/.test(m)) return false;
  const strongKeywords = [
    "who is", "what is", "define", "wiki", "wikipedia", "search", "latest",
    "news", "released", "when was", "biography", "born", "capital of", "how to"
  ];
  for (const k of strongKeywords) if (lower.includes(k)) return true;
  if (/^(who|what|when|where|why|how)\b/i.test(lower)) return true;
  if (/\?/.test(lower)) return true;
  if (m.length >= 60) return true;
  const words = m.split(/\s+/).filter(Boolean);
  if (words.length >= 4) {
    const stopwords = new Set(["the","a","an","in","on","at","for","and","or","of","to","is","are","was","were","be","i","you","it","this","that"]);
    let contentWords = 0;
    for (const w of words) if (!stopwords.has(w.toLowerCase())) contentWords++;
    if (contentWords >= Math.max(1, Math.floor(words.length / 2))) return true;
  }
  return false;
}

// ---------------- GEMINI ----------------
async function geminiReply(prompt, wikiContext) {
  const context = wikiContext ? `Wikipedia context:\n${wikiContext}` : "";
  const body = {
    contents: [
      { role: "user", parts: [{ text: SYSTEM_PROMPT + (context ? "\n\n" + context : "") + "\n\nUser: " + prompt }] }
    ]
  };
  const totalKeys = API_KEYS.length || 1;
  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const key = getNextKey();
    try {
      const res = await fetch(`${MODEL_URL}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429 || /quota|exhausted/i.test(errText))
          failedKeys.add((currentKey - 1 + API_KEYS.length) % API_KEYS.length);
        continue;
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch {
      failedKeys.add((currentKey - 1 + API_KEYS.length) % API_KEYS.length);
    }
  }
  throw new Error("All keys failed or returned empty.");
}

// ---------------- RENDER / UI ----------------
function renderMarkdown(t) {
  if (!t && t !== "") return "";
  let out = t;
  out = out.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");
  out = out.replace(/\*(.*?)\*/g, "<i>$1</i>");
  out = out.replace(/`([^`]+)`/g, '<code style="background:#e0e0e0;padding:2px 6px;border-radius:4px;">$1</code>');
  out = out.replace(/\n/g, "<br>");
  return out;
}

function addMessage(role, text, typing = false) {
  const container = document.getElementById("chatContainer");
  const welcomeEl = document.getElementById("welcomeMessage");
  if (welcomeEl) welcomeEl.remove();
  const div = document.createElement("div");
  div.className = `message ${role}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  if (typing && role === "bot") {
    let i = 0;
    const plain = text;
    const speed = Math.max(6, Math.min(30, Math.floor(1200 / Math.max(1, Math.sqrt(plain.length)))));
    const interval = setInterval(() => {
      i++;
      div.innerHTML = renderMarkdown(plain.slice(0, i));
      container.scrollTop = container.scrollHeight;
      if (i >= plain.length) clearInterval(interval);
    }, speed);
  } else div.innerHTML = renderMarkdown(text);
  chatHistory.push({ role: role === "bot" ? "model" : role, text });
  saveChat();
}

function showRandomWelcome() {
  const container = document.getElementById("chatContainer");
  if (chatHistory.length === 0 && !document.getElementById("welcomeMessage")) {
    const msg = [
      "Hey there! What can I help with?",
      "Ready when you are.",
      "Ask me anything — I'm all ears.",
      "What's on your mind?",
      "Hello! How can I assist you today?"
    ][Math.floor(Math.random() * 5)];
    const div = document.createElement("div");
    div.className = "welcome";
    div.id = "welcomeMessage";
    div.textContent = msg;
    container.appendChild(div);
  }
}

// ---------------- SAVE / LOAD CHAT ----------------
function saveChat() {
  try {
    localStorage.setItem("endroid_chat", JSON.stringify(chatHistory));
  } catch {}
}

function loadChat() {
  try {
    const saved = localStorage.getItem("endroid_chat");
    if (saved) {
      chatHistory = JSON.parse(saved);
      const container = document.getElementById("chatContainer");
      container.innerHTML = "";
      for (const m of chatHistory) {
        const role = (m.role === "model") ? "bot" : (m.role || "user");
        const div = document.createElement("div");
        div.className = `message ${role}`;
        div.innerHTML = renderMarkdown(m.text);
        container.appendChild(div);
      }
      container.scrollTop = container.scrollHeight;
    }
  } catch {}
}

// ---------------- CLEAR HISTORY ----------------
function clearHistory() {
  if (confirm("Clear chat history?")) {
    chatHistory = [];
    saveChat();
    const container = document.getElementById("chatContainer");
    container.innerHTML = '<div class="welcome" id="welcomeMessage"></div>';
    showRandomWelcome();
  }
}

// ---------------- SEND MESSAGE (MAIN) ----------------
async function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  if (!message) return;
  const welcomeEl = document.getElementById("welcomeMessage");
  if (welcomeEl) welcomeEl.remove();
  addMessage("user", message);
  input.value = "";
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.disabled = true;

  try {
    // --- Weather check first ---
    if (shouldUseWeather(message)) {
      addMessage("system", "Checking weather...");
      const matchCity = message.match(/in\s+([a-zA-Z\s]+)/i);
      const location = matchCity ? matchCity[1].trim() : null;
      const weather = await getWeather(location);
      addMessage("bot", weather, true);
      addMessage("system", "");
      if (sendBtn) sendBtn.disabled = false;
      return;
    }

    // --- Wikipedia / Gemini logic ---
    const useWiki = shouldUseWikipedia(message);
    let wiki = "";
    if (useWiki) {
      addMessage("system", "Getting latest data....");
      wiki = await wikipediaSearch(message);
    }

    addMessage("system", "");
    const reply = await geminiReply(message, wiki);
    addMessage("bot", reply, true);
    addMessage("system", "");
  } catch (e) {
    console.error("sendMessage error:", e);
    addMessage("bot", "⚠️ Failed to get a response. Try again later.", true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

// ---------------- EVENTS ----------------
document.getElementById("messageInput").addEventListener("keypress", e => {
  if (e.key === "Enter") sendMessage();
});
window.addEventListener("load", () => {
  loadChat();
  showRandomWelcome();
  const input = document.getElementById("messageInput");
  if (input) input.focus();
});
