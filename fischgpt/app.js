const messagesEl = document.querySelector("#messages");
const form = document.querySelector("#chat-form");
const questionEl = document.querySelector("#question");
const sendEl = document.querySelector("#send");
const statusEl = document.querySelector("#status");
const suggestionsEl = document.querySelector("#suggestions");

const gameConfigs = [
  { id: "neon-bot-arena", path: "../games/neon-bot-arena/config.json" },
  { id: "snake", path: "../games/snake/config.json" },
  { id: "tic-tac-toe", path: "../games/tic-tac-toe/config.json" },
  { id: "cursor-clicker", path: "../games/cursor-clicker/config.json" },
];

const pages = [
  { game: "Neon Bot Arena", title: "Neon Bot Arena", path: "../neon-bot-arena.html" },
  { game: "Neon Bot Arena", title: "Das Spiel", path: "../neon-bot-arena-beschreibung/das-spiel.html" },
  { game: "Neon Bot Arena", title: "Funktionen", path: "../neon-bot-arena-beschreibung/funktionen.html" },
  { game: "Neon Bot Arena", title: "Spielmodi", path: "../neon-bot-arena-beschreibung/spielmodi.html" },
  { game: "Neon Bot Arena", title: "Steuerung", path: "../neon-bot-arena-beschreibung/steuerung.html" },
  { game: "Neon Bot Arena", title: "Helden", path: "../neon-bot-arena-beschreibung/helden.html" },
  { game: "Neon Bot Arena", title: "Begleiter", path: "../neon-bot-arena-beschreibung/begleiter.html" },
  { game: "Neon Bot Arena", title: "Gegner und Bosse", path: "../neon-bot-arena-beschreibung/gegner-und-bosse.html" },
  { game: "Neon Bot Arena", title: "Updates", path: "../neon-bot-arena-beschreibung/updates.html" },
  { game: "Neon Bot Arena", title: "FAQ", path: "../neon-bot-arena-beschreibung/faq.html" },
  { game: "Cursor Clicker", title: "Cursor Clicker", path: "../cursor-clicker-beschreibung.html" },
  { game: "Snake", title: "Snake", path: "../snake.html" },
  { game: "Tic-Tac-Toe", title: "Tic-Tac-Toe", path: "../tic-tac-toe/index.html" },
];

const aliases = {
  "Neon Bot Arena": ["neon", "neon bot", "bot arena", "arena", "nba"],
  "Cursor Clicker": ["cursor", "clicker", "cursor clicker", "klicker"],
  "Snake": ["snake", "schlange"],
  "Tic-Tac-Toe": ["tic tac toe", "tic-tac-toe", "tictactoe", "ttt"],
};

const stopWords = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "einen", "einem",
  "und", "oder", "aber", "ist", "sind", "war", "was", "wie", "wo", "wer", "wann", "warum",
  "welche", "welcher", "welches", "gibt", "es", "ich", "du", "man", "mit", "zu", "zum", "zur",
  "von", "für", "auf", "in", "im", "am", "an", "bei", "aus", "noch", "kann", "kannst", "hat",
  "haben", "macht", "machen", "funktioniert", "spiel", "spiele", "game", "games", "bitte", "mir"
]);

const synonymGroups = [
  ["modus", "modi", "spielmodus", "spielmodi", "mode"],
  ["steuerung", "steuern", "taste", "tasten", "controls", "bewegung"],
  ["boss", "bosse", "gegner", "enemy", "feind"],
  ["held", "helden", "charakter", "charaktere", "hero"],
  ["cursor", "mauszeiger"],
  ["klicken", "klick", "click", "clicker"],
  ["schwer", "schwierigkeit", "schwierigkeitsgrad", "difficulty"],
  ["skin", "skins", "cosmetic", "cosmetics", "aussehen"],
  ["belohnung", "reward", "daily", "täglich"],
  ["shop", "laden", "kaufen", "coins", "münzen"],
];

const state = {
  chunks: [],
  games: [],
  ready: false,
};

function normalize(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9äöü\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalize(text)
    .split(" ")
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

function expandTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const group of synonymGroups) {
      if (group.includes(token)) group.forEach((word) => expanded.add(word));
    }
  }
  return [...expanded];
}

function detectGame(question) {
  const q = normalize(question);
  let best = null;
  let bestLength = 0;

  for (const [game, names] of Object.entries(aliases)) {
    for (const name of names) {
      const normalizedName = normalize(name);
      if (q.includes(normalizedName) && normalizedName.length > bestLength) {
        best = game;
        bestLength = normalizedName.length;
      }
    }
  }
  return best;
}

function flattenJson(value, prefix = "") {
  if (value == null) return [];
  if (Array.isArray(value)) return value.flatMap((item) => flattenJson(item, prefix));
  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => flattenJson(item, `${prefix}${key}: `));
  }
  return [`${prefix}${String(value)}`];
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim();
}

function htmlToChunks(html, source) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script, style, nav, footer, noscript, svg").forEach((node) => node.remove());

  const candidates = [...doc.querySelectorAll("h1, h2, h3, p, li, dt, dd")]
    .map((node) => cleanText(node.textContent || ""))
    .filter((text) => text.length >= 25 && text.length <= 900);

  const chunks = [];
  let heading = source.title;

  for (const text of candidates) {
    if (text.length < 110 && !/[.!?]$/.test(text)) {
      heading = text;
      continue;
    }
    chunks.push({
      ...source,
      text: `${heading}: ${text}`,
      normalized: normalize(`${heading} ${text}`),
    });
  }

  return chunks;
}

async function fetchText(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.text();
}

async function loadKnowledge() {
  const configTasks = gameConfigs.map(async ({ id, path }) => {
    try {
      const response = await fetch(path, { cache: "no-cache" });
      if (!response.ok) throw new Error(String(response.status));
      const config = await response.json();
      const name = config.name || config.title || id;
      state.games.push({ id, name, config, path });
      const text = flattenJson(config).join(" · ");
      state.chunks.push({
        game: name,
        title: `${name} Metadaten`,
        path,
        text,
        normalized: normalize(`${name} ${text}`),
      });
    } catch (error) {
      console.warn("FischGPT: Config konnte nicht geladen werden", path, error);
    }
  });

  const pageTasks = pages.map(async (source) => {
    try {
      const html = await fetchText(source.path);
      state.chunks.push(...htmlToChunks(html, source));
    } catch (error) {
      console.warn("FischGPT: Seite konnte nicht geladen werden", source.path, error);
    }
  });

  await Promise.all([...configTasks, ...pageTasks]);
  state.ready = state.chunks.length > 0;
  state.games.sort((a, b) => a.name.localeCompare(b.name, "de"));

  statusEl.textContent = state.ready
    ? `${state.chunks.length} Wissens-Chunks bereit`
    : "Wissen konnte nicht geladen werden";
  sendEl.disabled = !state.ready;
}

function scoreChunk(chunk, tokens, game) {
  let score = 0;
  const haystack = chunk.normalized;
  const chunkTokens = new Set(tokenize(haystack));

  for (const token of tokens) {
    if (chunkTokens.has(token)) score += token.length >= 7 ? 3 : 2;
    else if (token.length >= 5 && haystack.includes(token)) score += 1;
  }

  if (game && normalize(chunk.game).includes(normalize(game))) score += 8;
  if (game && chunk.game !== game) score -= 4;

  return score;
}

function searchKnowledge(question) {
  const rawTokens = tokenize(question);
  const tokens = expandTokens(rawTokens);
  const game = detectGame(question);

  return state.chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, tokens, game) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function gameListAnswer() {
  if (!state.games.length) return null;
  const names = state.games.map((game) => game.name);
  return `Aktuell finde ich ${names.length} öffentliche Spiele: ${names.join(", ")}. 🐟`;
}

function specialAnswer(question) {
  const q = normalize(question);

  if (/^(hi|hallo|hey|moin|servus)\b/.test(q)) {
    return { text: "Moin 🐟 Ich bin FischGPT. Frag mich irgendwas zu den Spielen hier.", sources: [] };
  }

  if (q.includes("wer bist du") || q.includes("was bist du") || q === "fisch") {
    return { text: "Ich bin FischGPT 🐟 — die maximal fischige Fragen-KI für diese Spielebibliothek. V1 läuft komplett im Browser und sucht Antworten direkt aus den öffentlichen Spielinfos.", sources: [] };
  }

  if ((q.includes("welche") || q.includes("alle")) && (q.includes("spiele") || q.includes("games"))) {
    return { text: gameListAnswer(), sources: state.games.map((game) => ({ title: game.name, path: game.path })).slice(0, 4) };
  }

  return null;
}

function shorten(text, max = 620) {
  const cleaned = cleanText(text);
  if (cleaned.length <= max) return cleaned;
  const cut = cleaned.slice(0, max);
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return `${cut.slice(0, sentenceEnd > 220 ? sentenceEnd + 1 : max).trim()} …`;
}

function buildAnswer(question) {
  const special = specialAnswer(question);
  if (special) return special;

  const results = searchKnowledge(question);
  const game = detectGame(question);
  const best = results[0];

  if (!best || best.score < (game ? 9 : 4)) {
    return {
      text: "Dazu finde ich in meinen Spielinfos gerade keine sichere Antwort. 🐟💀 Frag am besten etwas genauer nach einem Spiel, Modus, Feature oder der Steuerung — ich erfinde lieber nichts.",
      sources: [],
    };
  }

  const selected = [];
  const seen = new Set();
  for (const result of results) {
    const key = `${result.chunk.title}:${result.chunk.text}`;
    if (seen.has(key)) continue;
    if (game && result.chunk.game !== game) continue;
    selected.push(result.chunk);
    seen.add(key);
    if (selected.length === 2) break;
  }

  const answerBody = selected.map((chunk) => shorten(chunk.text, 430)).join("\n\n");
  const intro = game ? `Zu ${game} habe ich das gefunden:` : "Das passt am besten zu deiner Frage:";

  return {
    text: `${intro}\n\n${answerBody}`,
    sources: selected.map(({ title, path }) => ({ title, path })),
  };
}

function addMessage(role, text, sources = []) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  if (role === "bot") {
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = "🐟";
    article.appendChild(avatar);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const name = document.createElement("strong");
  name.textContent = role === "bot" ? "FischGPT" : "Du";

  const paragraph = document.createElement("p");
  paragraph.textContent = text;

  bubble.append(name, paragraph);

  if (sources.length) {
    const list = document.createElement("ul");
    list.className = "source-list";
    const unique = [...new Map(sources.map((source) => [source.path, source])).values()];
    for (const source of unique) {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = source.path;
      link.textContent = source.title;
      link.target = "_blank";
      link.rel = "noopener";
      item.append("Quelle: ", link);
      list.appendChild(item);
    }
    bubble.appendChild(list);
  }

  article.appendChild(bubble);
  messagesEl.appendChild(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function autoResize() {
  questionEl.style.height = "auto";
  questionEl.style.height = `${Math.min(questionEl.scrollHeight, 130)}px`;
}

async function ask(question) {
  const trimmed = question.trim();
  if (!trimmed || !state.ready) return;

  addMessage("user", trimmed);
  questionEl.value = "";
  autoResize();
  sendEl.disabled = true;

  await new Promise((resolve) => setTimeout(resolve, 180));
  const answer = buildAnswer(trimmed);
  addMessage("bot", answer.text, answer.sources);

  sendEl.disabled = false;
  questionEl.focus();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  ask(questionEl.value);
});

questionEl.addEventListener("input", autoResize);
questionEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

suggestionsEl.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button) ask(button.textContent);
});

sendEl.disabled = true;
loadKnowledge();
