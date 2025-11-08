// === ENDRIOD AI: Live Wikipedia-Powered Smart Engine ===
// by Mudasir Wazir (Endroid Project)
// Version: Stable 3.0 — "TrustSource"
// ---------------------------------------------

const API_KEY = "YOUR_GEMINI_API_KEY"; // replace with your Gemini API key
const WIKI_API = "https://en.wikipedia.org/api/rest_v1/page/summary/";

const chatBox = document.getElementById("chatBox");
const input = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

// Helper: append message to chat
function appendMessage(sender, text, type = "") {
  const msg = document.createElement("div");
  msg.className = `msg ${sender}`;
  msg.innerHTML = type === "source" ? `<small>${text}</small>` : text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Wikipedia search helper
async function fetchWikipediaData(query) {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
  const res = await fetch(searchUrl);
  const data = await res.json();
  const titles = data.query.search.slice(0, 5).map(r => r.title);

  const fetches = titles.map(title =>
    fetch(WIKI_API + encodeURIComponent(title)).then(r => r.json()).catch(() => null)
  );

  const results = (await Promise.all(fetches))
    .filter(r => r && r.extract)
    .map(r => `📘 ${r.title}: ${r.extract}`);

  return results.length ? results : ["⚠️ No Wikipedia summaries found."];
}

// Send to Gemini
async function askGemini(question, context) {
  const fullPrompt = `
You are Endroid AI — a fact-aware assistant.
Always use provided sources as reliable.
If user provides context (like Wikipedia data), summarize accurately and clearly.
Never say “no source to prove” — just use reasoning or say “No reliable data found.”

Question: ${question}

Context:
${context.join("\n\n")}
`;

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }]
    })
  });

  const data = await res.json();
  try {
    return data.candidates[0].content.parts[0].text;
  } catch {
    return "⚠️ Error: Gemini could not process your request.";
  }
}

// Handle user send
sendBtn.onclick = async () => {
  const question = input.value.trim();
  if (!question) return;
  appendMessage("user", question);
  input.value = "";

  appendMessage("ai", "🔍 Searching Wikipedia for live information...");

  const wikiData = await fetchWikipediaData(question);
  appendMessage("ai", "📚 Fetched live Wikipedia data.", "source");

  const response = await askGemini(question, wikiData);
  appendMessage("ai", response);
};

// Optional: Press Enter to send
input.addEventListener("keydown", e => {
  if (e.key === "Enter") sendBtn.click();
});
