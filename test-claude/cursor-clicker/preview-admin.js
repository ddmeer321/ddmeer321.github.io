// Nur für die lokale No-Login-Vorschau (preview-admin.js wird nur von
// preview-no-login.html eingebunden, niemals von index.html) — ein kleines
// Cheat-Panel für schnelles manuelles Testen. Arbeitet direkt auf denselben
// Singleton-Modulen wie main.js (state.js etc. sind ES-Module-Singletons),
// löst also nach jeder Änderung dasselbe "state:changed" aus, das die
// bestehende UI schon zum Neu-Rendern nutzt.
import { state } from "./js/core/state.js";
import { events } from "./js/core/events.js";
import { saveGame, hardReset } from "./js/core/save.js";
import { addCoins } from "./js/core/wallet.js";
import { CURSORS } from "./js/data/cursors.js";
import { MUTATIONS } from "./js/data/mutations.js";
import { AURAS } from "./js/data/auras.js";
import { grantAura } from "./js/core/auras.js";
import { MAX_LEVEL } from "./js/core/upgrades.js";

function notify(text) {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.cssText =
    "position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:9999;" +
    "background:#161a26;border:1px solid rgba(255,255,255,0.15);color:#f1f3fb;" +
    "padding:8px 14px;border-radius:999px;font:600 12px system-ui;pointer-events:none;" +
    "box-shadow:0 4px 18px rgba(0,0,0,0.4);";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

function unlockEverything() {
  CURSORS.forEach((cursor) => {
    const entry = state.ownedCursors[cursor.id] || { count: 0, favorite: false, firstObtainedAt: Date.now() };
    entry.count += 5;
    state.ownedCursors[cursor.id] = entry;
  });
  if (!state.equipped.cursorId) {
    state.equipped = { cursorId: CURSORS[0].id, instanceId: null };
  }
  AURAS.forEach((aura) => {
    if (!state.ownedAuras[aura.id]) grantAura(aura.id);
  });
  events.emit("state:changed", state);
  notify("Alle Cursor (je 5×) + alle Auren freigeschaltet");
}

function applyMutationToEquipped(mutationId) {
  const cursorId = state.equipped.cursorId;
  if (!cursorId) {
    notify("Erst einen Cursor ausrüsten");
    return;
  }
  const mutation = MUTATIONS.find((m) => m.id === mutationId);
  if (!mutation) return;

  const instanceId = cursorId + "-admin-" + Date.now().toString(36);
  const instance = {
    instanceId,
    major: mutation.tier === "major" ? mutation.id : null,
    minor: mutation.tier === "minor" ? mutation.id : null,
    createdAt: Date.now(),
  };
  if (!state.mutatedCursors[cursorId]) state.mutatedCursors[cursorId] = [];
  state.mutatedCursors[cursorId].push(instance);
  state.equipped = { cursorId, instanceId };
  events.emit("state:changed", state);
  notify(mutation.name + " angewendet + ausgerüstet");
}

function maxLevelEquipped() {
  const cursorId = state.equipped.cursorId;
  if (!cursorId) {
    notify("Erst einen Cursor ausrüsten");
    return;
  }
  state.cursorLevels[cursorId] = MAX_LEVEL;
  events.emit("state:changed", state);
  notify("Level auf MAX gesetzt");
}

function resetSave() {
  if (!confirm("Spielstand wirklich zurücksetzen?")) return;
  hardReset();
  location.reload();
}

function buildPanel() {
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.textContent = "🛠️ Admin";
  toggle.style.cssText =
    "position:fixed;right:14px;bottom:14px;z-index:9998;font:700 12px system-ui;" +
    "background:#7c5cff;color:#0b0d14;border:none;border-radius:999px;padding:9px 14px;" +
    "cursor:pointer;box-shadow:0 4px 16px rgba(124,92,255,0.5);";

  const panel = document.createElement("div");
  panel.style.cssText =
    "position:fixed;right:14px;bottom:56px;z-index:9998;width:240px;display:none;" +
    "flex-direction:column;gap:8px;background:#12151f;border:1px solid rgba(255,255,255,0.12);" +
    "border-radius:12px;padding:12px;box-shadow:0 12px 32px rgba(0,0,0,0.5);" +
    "font:600 12px system-ui;color:#f1f3fb;";

  const btnStyle =
    "width:100%;background:#1b1f2e;color:#f1f3fb;border:1px solid rgba(255,255,255,0.1);" +
    "border-radius:8px;padding:7px 8px;cursor:pointer;font:600 12px system-ui;text-align:left;";
  const selectStyle =
    "width:100%;background:#1b1f2e;color:#f1f3fb;border:1px solid rgba(255,255,255,0.1);" +
    "border-radius:8px;padding:6px 8px;font:600 12px system-ui;";

  function addButton(label, onClick, danger) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.cssText = btnStyle + (danger ? "border-color:#f87171;color:#f87171;" : "");
    btn.addEventListener("click", onClick);
    panel.appendChild(btn);
    return btn;
  }

  const title = document.createElement("div");
  title.textContent = "Nur lokale Vorschau — Test-Cheats";
  title.style.cssText = "color:#8b93a8;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;";
  panel.appendChild(title);

  addButton("+10.000 Coins", () => { addCoins(10000); saveGame(); });
  addButton("+1.000.000 Coins", () => { addCoins(1000000); saveGame(); });
  addButton("Alles freischalten (Cursor + Auren)", () => { unlockEverything(); saveGame(); });
  addButton("Level MAX (ausgerüstet)", () => { maxLevelEquipped(); saveGame(); });

  const mutSelect = document.createElement("select");
  mutSelect.id = "admin-mutation-select";
  mutSelect.style.cssText = selectStyle;
  const minorGroup = document.createElement("optgroup");
  minorGroup.label = "Minor";
  const majorGroup = document.createElement("optgroup");
  majorGroup.label = "Major";
  MUTATIONS.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    (m.tier === "major" ? majorGroup : minorGroup).appendChild(opt);
  });
  mutSelect.appendChild(minorGroup);
  mutSelect.appendChild(majorGroup);
  panel.appendChild(mutSelect);
  addButton("Mutation auf ausgerüsteten Cursor", () => { applyMutationToEquipped(mutSelect.value); saveGame(); });

  addButton("State in Konsole loggen", () => {
    console.log("Cursor Clicker state:", JSON.parse(JSON.stringify(state)));
    notify("State in Konsole geloggt");
  });
  addButton("Jetzt speichern", () => { saveGame(); notify("Gespeichert"); });
  addButton("Spielstand zurücksetzen", resetSave, true);

  toggle.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "flex" : "none";
  });

  document.body.appendChild(toggle);
  document.body.appendChild(panel);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", buildPanel);
} else {
  buildPanel();
}
