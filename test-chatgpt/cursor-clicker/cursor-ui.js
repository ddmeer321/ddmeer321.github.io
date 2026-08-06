import { ACHIEVEMENTS, BOXES, CURSORS, RARITIES, cursorById } from "./cursor-data.js";

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

export function formatNumber(value) {
  if (value < 1000) return Math.floor(value).toLocaleString("de-DE");
  const units = [[1e12, "Bio."], [1e9, "Mrd."], [1e6, "Mio."], [1e3, "Tsd."]];
  const unit = units.find(([threshold]) => value >= threshold);
  return `${(value / unit[0]).toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${unit[1]}`;
}

export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours) return `${hours} Std. ${minutes} Min.`;
  if (minutes) return `${minutes} Min. ${secs} Sek.`;
  return `${secs} Sek.`;
}

function rarityClass(rarity) { return `rarity-${rarity}`; }
function setRarity(element, rarity) {
  Object.keys(RARITIES).forEach(key => element.classList.remove(rarityClass(key)));
  element.classList.add(rarityClass(rarity));
}

export function createUI(actions) {
  let lastRewardCursor;
  let currentSearch = "";

  $$(".tab-button").forEach(button => button.addEventListener("click", () => showTab(button.dataset.tab)));
  $("#inventory-search").addEventListener("input", event => { currentSearch = event.target.value.trim().toLowerCase(); actions.requestRender(); });
  $("#cursor-button").addEventListener("click", event => actions.clickCursor(event));
  document.addEventListener("keydown", event => {
    if (event.code === "Space" && !event.repeat && !["INPUT", "BUTTON"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      actions.clickCursor({ clientX: innerWidth / 2, clientY: innerHeight / 2 });
    }
  });
  document.addEventListener("click", event => {
    const buy = event.target.closest("[data-buy-box]");
    const equip = event.target.closest("[data-equip]");
    const favorite = event.target.closest("[data-favorite]");
    if (buy) actions.openBox(buy.dataset.buyBox);
    if (equip) actions.equipCursor(equip.dataset.equip);
    if (favorite) actions.toggleFavorite(favorite.dataset.favorite);
  });
  $("#daily-button").addEventListener("click", actions.claimDaily);
  $("#daily-claim-inline").addEventListener("click", actions.claimDaily);
  $("#reward-close").addEventListener("click", closeReward);
  $("#reward-continue").addEventListener("click", closeReward);
  $("#reward-equip").addEventListener("click", () => { if (lastRewardCursor) actions.equipCursor(lastRewardCursor.id); closeReward(); });
  $("#reward-modal").addEventListener("click", event => { if (event.target.id === "reward-modal") closeReward(); });
  $("#reset-button").addEventListener("click", () => $("#confirm-modal").classList.remove("hidden"));
  $("#confirm-cancel").addEventListener("click", () => $("#confirm-modal").classList.add("hidden"));
  $("#confirm-reset").addEventListener("click", actions.resetGame);
  ["music", "sounds", "animations"].forEach(key => {
    $(`#setting-${key}`).addEventListener("change", event => actions.updateSetting(key, event.target.checked));
  });

  function showTab(tab) {
    $$(".tab-button").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
    $$(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === tab));
    if (tab === "inventory") $("#inventory-search").focus({ preventScroll: true });
  }

  function render(state, derived) {
    const equipped = cursorById(state.equipped);
    $("#coins-value").textContent = formatNumber(state.coins);
    $("#per-click-value").textContent = formatNumber(derived.coinsPerClick);
    $("#equipped-value").textContent = equipped.name;
    $("#equipped-mini-icon").textContent = equipped.icon;
    $("#draws-value").textContent = state.stats.totalDraws.toLocaleString("de-DE");
    $("#inventory-count").textContent = Object.keys(state.inventory).length;
    $("#active-cursor-name").textContent = equipped.name;
    $("#active-cursor-description").textContent = equipped.description;
    $("#main-cursor-icon").textContent = equipped.icon;
    setRarity($("#cursor-button"), equipped.rarity);
    document.body.classList.toggle("no-animations", !state.settings.animations);
    renderBoxes(state);
    renderInventory(state);
    renderProgress(state);
    renderDaily(state, derived.daily);
    renderSettings(state.settings);
  }

  function renderBoxes(state) {
    $("#box-grid").innerHTML = BOXES.map((box, index) => {
      const palette = ["#4ade80", "#38bdf8", "#c084fc"];
      const chanceRows = Object.entries(box.chances).filter(([, chance]) => chance >= .05).map(([rarity, chance]) => `
        <div class="chance-row"><span style="color:${RARITIES[rarity].color}">${RARITIES[rarity].label}</span><i style="--chance:${Math.max(chance, 2)}%;--chance-color:${RARITIES[rarity].color}"></i><strong>${chance}%</strong></div>`).join("");
      return `<article class="box-card" style="--box-color:${palette[index]};--box-glow:${palette[index]}"><div class="box-top"><span class="box-big-icon">${box.icon}</span><span class="box-price">● ${formatNumber(box.price)}</span></div><h2>${box.name}</h2><p>${box.description}</p><div class="chance-list">${chanceRows}</div><button class="primary-button" data-buy-box="${box.id}" ${state.coins < box.price ? "disabled" : ""}>${state.coins < box.price ? "Nicht genug Coins" : "Box öffnen"}</button></article>`;
    }).join("");
    $$('[data-buy-box="starter"] span').forEach(span => span.textContent = formatNumber(BOXES[0].price));
    $$('[data-buy-box="starter"]').forEach(button => button.disabled = state.coins < BOXES[0].price);
  }

  function renderInventory(state) {
    const items = CURSORS.filter(cursor => state.inventory[cursor.id] && cursor.name.toLowerCase().includes(currentSearch)).sort((a, b) => {
      const favoriteDiff = Number(state.inventory[b.id].favorite) - Number(state.inventory[a.id].favorite);
      return favoriteDiff || RARITIES[b.rarity].rank - RARITIES[a.rarity].rank || a.name.localeCompare(b.name);
    });
    $("#inventory-grid").innerHTML = items.map(cursor => {
      const item = state.inventory[cursor.id];
      const equipped = state.equipped === cursor.id;
      return `<article class="cursor-card ${rarityClass(cursor.rarity)} ${equipped ? "equipped" : ""}"><div class="cursor-card-top"><span class="item-icon">${cursor.icon}</span><button class="favorite-button ${item.favorite ? "active" : ""}" data-favorite="${cursor.id}" type="button" aria-label="${item.favorite ? "Aus Favoriten entfernen" : "Als Favorit markieren"}">★</button></div><div><span class="rarity-label">${RARITIES[cursor.rarity].label}</span><h3>${cursor.name}</h3></div><p>${cursor.description}</p><div class="item-meta"><strong>×${cursor.multiplier.toLocaleString("de-DE")}</strong><span class="duplicate-count">${item.count}× gezogen</span></div><button class="equip-button" data-equip="${cursor.id}" type="button" ${equipped ? "disabled" : ""}>${equipped ? "Ausgerüstet" : "Ausrüsten"}</button></article>`;
    }).join("");
    const unique = Object.keys(state.inventory).length;
    $("#unique-count").textContent = `${unique} von ${CURSORS.length} gesammelt`;
    $("#inventory-empty").classList.toggle("hidden", items.length > 0);
  }

  function renderProgress(state) {
    const rarest = CURSORS.filter(cursor => state.inventory[cursor.id]).sort((a, b) => RARITIES[b.rarity].rank - RARITIES[a.rarity].rank)[0];
    const stats = [
      ["Gesamte Klicks", state.stats.totalClicks.toLocaleString("de-DE")],
      ["Verdiente Coins", formatNumber(state.stats.totalCoinsEarned)],
      ["Geöffnete Boxen", state.stats.boxesOpened.toLocaleString("de-DE")],
      ["Seltenster Cursor", rarest ? `${RARITIES[rarest.rarity].label} · ${rarest.name}` : "–"],
      ["Spielzeit", formatDuration(state.stats.playSeconds)],
      ["Verschiedene Cursor", `${Object.keys(state.inventory).length} / ${CURSORS.length}`],
    ];
    $("#stats-grid").innerHTML = stats.map(([label, value]) => `<article class="stat-card"><span>${label}</span><strong>${value}</strong></article>`).join("");
    const unlocked = ACHIEVEMENTS.filter(item => state.achievements[item.id]).length;
    $("#achievement-progress").textContent = `${unlocked} / ${ACHIEVEMENTS.length}`;
    $("#achievement-list").innerHTML = ACHIEVEMENTS.map(item => `<article class="achievement ${state.achievements[item.id] ? "unlocked" : ""}"><span class="achievement-icon">${state.achievements[item.id] ? "✓" : item.icon}</span><div><h3>${item.title}</h3><p>${item.description}</p></div><span class="achievement-reward">+${formatNumber(item.reward)}</span></article>`).join("");
  }

  function renderDaily(state, daily) {
    $("#daily-streak").textContent = state.daily.streak;
    $("#daily-button").classList.toggle("ready", daily.available);
    $("#daily-label").textContent = daily.available ? `+${formatNumber(daily.reward)} Coins` : "Daily abgeholt";
    $("#daily-description").textContent = daily.available ? `Tag ${daily.nextStreak}: ${formatNumber(daily.reward)} Coins warten auf dich.` : `Nächste Belohnung in ${daily.remaining}.`;
    $("#daily-claim-inline").disabled = !daily.available;
    $("#daily-claim-inline").textContent = daily.available ? `${formatNumber(daily.reward)} Coins abholen` : "Heute abgeholt";
  }

  function renderSettings(settings) {
    $("#setting-music").checked = settings.music;
    $("#setting-sounds").checked = settings.sounds;
    $("#setting-animations").checked = settings.animations;
  }

  function showReward(cursor, duplicate) {
    lastRewardCursor = cursor;
    const rank = RARITIES[cursor.rarity].rank;
    const card = $("#reward-card");
    setRarity(card, cursor.rarity);
    $("#reward-icon").textContent = cursor.icon;
    $("#reward-rarity").textContent = RARITIES[cursor.rarity].label;
    $("#reward-title").textContent = cursor.name;
    $("#reward-description").textContent = duplicate ? `${cursor.description} Du besitzt ihn jetzt mehrfach.` : cursor.description;
    $("#reward-multiplier").textContent = `×${cursor.multiplier.toLocaleString("de-DE")} Coins pro Klick`;
    $("#reward-modal").classList.remove("hidden");
    if (rank >= RARITIES.legendary.rank) toast(`${RARITIES[cursor.rarity].label} gezogen!`, cursor.name, RARITIES[cursor.rarity].color, 5500);
  }

  function closeReward() { $("#reward-modal").classList.add("hidden"); }
  function closeConfirm() { $("#confirm-modal").classList.add("hidden"); }

  function floatCoins(x, y, amount, special = false) {
    const node = document.createElement("span");
    node.className = "coin-float";
    node.textContent = `${special ? "✦ " : "+"}${formatNumber(amount)}`;
    node.style.left = `${Math.max(15, x - 20)}px`;
    node.style.top = `${Math.max(60, y - 15)}px`;
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), 850);
  }

  function animateClick() {
    const button = $("#cursor-button");
    button.classList.add("clicked");
    window.setTimeout(() => button.classList.remove("clicked"), 90);
  }

  function setCombo(value) { $("#combo-value").textContent = value; }
  function showSpecial(text) {
    const note = $("#special-effect-note");
    note.textContent = text;
    note.classList.remove("hidden");
    window.clearTimeout(showSpecial.timer);
    showSpecial.timer = window.setTimeout(() => note.classList.add("hidden"), 1300);
  }

  function toast(title, message, color = "#7c6cff", duration = 3300) {
    const node = document.createElement("div");
    node.className = "toast";
    node.style.setProperty("--toast-color", color);
    node.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
    $("#toast-stack").appendChild(node);
    window.setTimeout(() => node.remove(), duration);
  }

  return { render, showTab, showReward, closeReward, closeConfirm, floatCoins, animateClick, setCombo, showSpecial, toast };
}
