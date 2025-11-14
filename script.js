// ENDROID AI — GEMINI + WIKIPEDIA + OPEN-METEO WEATHER + STRONG DECISION LOGIC (FINAL)
// All GEMINI API keys in keys.txt please don't miss use it and don't copy it.
// All API keys are at free tire.

let API_KEYS = [];
let currentKey = 0;
let failedKeys = new Set();
let chatHistory = [];

const MODEL_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const SYSTEM_PROMPT = `You are Endroid AI — an intelligent, friendly assistant powered by Gemini.
You have a great memory, you always remember everything from previous chats with user , talk with context from last message.
Use the given Wikipedia context as the main truth source.
If context is empty, respond from your own knowledge.
When the user's intent requires *real-time local weather*, output the exact token [GET_WEATHER] at the point in your reply where live weather data should appear.
Do NOT forget something from previous chat, always remember everything and answer according to previous messages ( chat ).
Do NOT output [GET_WEATHER] for source/explanation questions such as "How do you know my weather?" — those should be answered naturally with an explanation.
Do NOT invent or hallucinate locations — if you need a location and the user didn't provide a city, assume the client will provide coordinates (via browser geolocation).
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
      } catch (e) {
        // ignore individual page fetch errors
      }
    }
    return out.length ? out.join("\n\n") : "No Wikipedia data found.";
  } catch (e) {
    console.warn("Wikipedia fetch failed:", e);
    return "No Wikipedia data available (fetch failed).";
  }
}

// ---------------- HELPER: parse ISO times to index ----------------
function findHourIndex(hourlyTimes, targetIso) {
  // hourlyTimes: array of ISO strings
  // targetIso: ISO string like "2025-11-12T10:00"
  // exact match should work; otherwise fallback to nearest index
  const idx = hourlyTimes.indexOf(targetIso);
  if (idx !== -1) return idx;
  // fallback: find nearest by timestamp
  const targetT = Date.parse(targetIso);
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < hourlyTimes.length; i++) {
    const t = Date.parse(hourlyTimes[i]);
    const d = Math.abs(t - targetT);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

// ---------------- WEATHER (Open-Meteo) ----------------
// getDetailedWeather: given lat/lon, returns rich narrative string
async function getDetailedWeather(lat, lon) {
  try {
    // Request current_weather plus hourly arrays needed for humidity, apparent temp, precipitation
    // timezone=auto makes hourly.time in local tz for easier matching
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current_weather=true&hourly=relativehumidity_2m,apparent_temperature,precipitation&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather fetch failed");
    const data = await res.json();

    // Ensure expected fields exist
    const cw = data.current_weather;
    const hourly = data.hourly || {};
    const times = hourly.time || [];

    if (!cw) return "⚠️ Weather data unavailable.";

    // Find index in hourly arrays matching current_weather.time
    const idx = findHourIndex(times, cw.time);

    const temp = (cw.temperature !== undefined) ? `${cw.temperature}°C` : "N/A";
    const wind = (cw.windspeed !== undefined) ? `${cw.windspeed} km/h` : "N/A";
    const code = (cw.weathercode !== undefined) ? `${cw.weathercode}` : "N/A";

    const feelsLike = (hourly.apparent_temperature && hourly.apparent_temperature[idx] !== undefined) ? `${hourly.apparent_temperature[idx]}°C` : "N/A";
    const humidity = (hourly.relativehumidity_2m && hourly.relativehumidity_2m[idx] !== undefined) ? `${hourly.relativehumidity_2m[idx]}%` : "N/A";
    const precip = (hourly.precipitation && hourly.precipitation[idx] !== undefined) ? `${hourly.precipitation[idx]} mm` : "N/A";

    // Convert weather code to simple emoji/phrase
    const wc = Number(cw.weathercode || -1);
    const codeMap = {
      0: "☀️ Clear",
      1: "🌤 Mostly clear",
      2: "⛅ Partly cloudy",
      3: "☁️ Overcast",
      45: "🌫 Fog",
      48: "🌫 Depositing rime fog",
      51: "🌦 Light drizzle",
      53: "🌦 Moderate drizzle",
      55: "🌧 Dense drizzle",
      56: "🌧 Freezing drizzle",
      57: "🌧 Freezing drizzle (dense)",
      61: "🌧 Rain",
      63: "🌧 Moderate rain",
      65: "⛈ Heavy rain",
      66: "❄️ Freezing rain",
      67: "❄️ Heavy freezing rain",
      71: "❄️ Snow",
      73: "❄️ Moderate snow",
      75: "❄️ Heavy snow",
      80: "🌧 Rain showers",
      81: "🌧 Moderate showers",
      82: "⛈ Violent showers",
      95: "⛈ Thunderstorm",
      96: "⛈ Thunderstorm with hail",
      99: "⛈ Severe thunderstorm with hail"
    };
    const wcText = codeMap[wc] || `Code ${code}`;

    // Build a natural narrative (Gemini will insert this where [GET_WEATHER] was)
    const narrative =
`Here's the live weather for your location (from Open‑Meteo):
${wcText}
• Temperature: ${temp} (feels like ${feelsLike})
• Humidity: ${humidity}
• Precipitation (hour): ${precip}
• Wind: ${wind}
(Weather code: ${code})`;

    return narrative;
  } catch (e) {
    console.warn("getDetailedWeather error:", e);
    return "⚠️ Could not fetch weather data.";
  }
}

// If a user provided a city name, resolve to lat/lon via Open-Meteo geocoding
async function geocodeCity(city) {
  try {
    const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
    if (!g.ok) throw new Error("Geocode failed");
    const gd = await g.json();
    if (gd && gd.results && gd.results.length) {
      const r = gd.results[0];
      return { lat: r.latitude, lon: r.longitude, name: r.name, country: r.country };
    }
    return null;
  } catch (e) {
    console.warn("geocodeCity error:", e);
    return null;
  }
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
    "who is", "what is", "what's", "define", "definition", "wiki", "wikipedia",
    "search", "latest", "news", "released", "release date", "when was", "when did",
    "biography", "born", "age of", "population", "capital of", "how to", "how do i",
    "steps to", "recipe", "ingredients", "stats", "statistics", "convert", "meaning of"
  ];
  for (const k of strongKeywords) {
    if (lower.includes(k)) return true;
  }

  const questionStart = /^(who|what|when|where|why|how)\b/i;
  if (questionStart.test(lower)) return true;

  if (/\?/.test(lower)) return true;

  if (m.length >= 60) return true;

  const words = m.split(/\s+/).filter(Boolean);
  if (words.length >= 4) {
    const stopwords = new Set(["the","a","an","in","on","at","for","and","or","of","to","is","are","was","were","be","I","you","it","this","that"]);
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
        console.warn("Gemini response not ok:", res.status, errText);
        if (res.status === 429 || /quota|exhausted/i.test(errText)) {
          failedKeys.add((currentKey - 1 + API_KEYS.length) % API_KEYS.length);
        }
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (e) {
      console.warn("Gemini call error:", e);
      failedKeys.add((currentKey - 1 + API_KEYS.length) % API_KEYS.length);
      continue;
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
  // remove welcome if present and chat not empty
  const welcomeEl = document.getElementById("welcomeMessage");
  if (welcomeEl) welcomeEl.remove();

  const div = document.createElement("div");
  div.className = `message ${role}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  if (typing && role === "bot") {
    let i = 0;
    const plain = text; // keep original text for slicing
    const speed = Math.max(6, Math.min(30, Math.floor(1200 / Math.max(1, Math.sqrt(plain.length))))); // adaptive-ish
    const interval = setInterval(() => {
      i++;
      div.innerHTML = renderMarkdown(plain.slice(0, i));
      container.scrollTop = container.scrollHeight;
      if (i >= plain.length) clearInterval(interval);
    }, speed);
  } else {
    div.innerHTML = renderMarkdown(text);
  }

  // save to history (role mapping)
  chatHistory.push({ role: role === "bot" ? "model" : role, text });
  saveChat();
}

function showRandomWelcome() {
  const container = document.getElementById("chatContainer");
  // only show welcome if chatHistory is empty and welcome is not present
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
  } catch (e) {
    console.warn("saveChat failed", e);
  }
}

function loadChat() {
  try {
    const saved = localStorage.getItem("endroid_chat");
    if (saved) {
      chatHistory = JSON.parse(saved);
      const container = document.getElementById("chatContainer");
      container.innerHTML = "";
      for (const m of chatHistory) {
        // m.role: 'model' means bot, others are user/system
        const role = (m.role === "model") ? "bot" : (m.role || "user");
        const div = document.createElement("div");
        div.className = `message ${role}`;
        div.innerHTML = renderMarkdown(m.text);
        container.appendChild(div);
      }
      container.scrollTop = container.scrollHeight;
    }
  } catch (e) {
    console.warn("loadChat failed", e);
  }
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

  // remove welcome if present
  const welcomeEl = document.getElementById("welcomeMessage");
  if (welcomeEl) welcomeEl.remove();

  addMessage("user", message);
  input.value = "";
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.disabled = true;

  try {
    // Decide whether to fetch Wikipedia
    const useWiki = shouldUseWikipedia(message);
    let wiki = "";
    if (useWiki) {
      addMessage("system", "Getting latest data....");
      wiki = await wikipediaSearch(message);
    }

    addMessage("system", "");
    // Ask Gemini for reply. Gemini may include the exact token [GET_WEATHER].
    let reply = await geminiReply(message, wiki);

    // If Gemini included [GET_WEATHER], replace it after fetching actual weather
    if (reply && reply.includes("[GET_WEATHER]")) {
      // Show a subtle system message while we get weather
      addMessage("system", "Checking live weather...");
      // Try to detect a city explicitly from user's message ("weather in <city>")
      const cityMatch = message.match(/weather in\s+([a-zA-Z\u00C0-\u017F\s\-']+)/i);
      let weatherText = null;

      if (cityMatch && cityMatch[1]) {
        const city = cityMatch[1].trim();
        const geo = await geocodeCity(city);
        if (geo) {
          weatherText = await getDetailedWeather(geo.lat, geo.lon);
          // Optionally prepend location name so Gemini narrative flows
          weatherText = `Weather in ${geo.name}, ${geo.country}:\n` + weatherText;
        } else {
          weatherText = `⚠️ Couldn't find city "${city}".`;
        }
      } else {
        // Use browser geolocation (prompt user). Only ask when needed.
        if (!navigator.geolocation) {
          weatherText = "⚠️ Geolocation not supported in this browser.";
        } else {
          // request permission and coordinates
          try {
            const pos = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, maximumAge: 600000 });
            });
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            weatherText = await getDetailedWeather(lat, lon);
          } catch (err) {
            weatherText = "⚠️ Location permission denied or unavailable.";
          }
        }
      }

      // Replace all occurrences of [GET_WEATHER] with the live narrative
      reply = reply.split("[GET_WEATHER]").join(weatherText);
      addMessage("bot", reply, true);
      addMessage("system", "");
      if (sendBtn) sendBtn.disabled = false;
      return;
    }

    // Normal flow: no weather token; just return Gemini reply
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
