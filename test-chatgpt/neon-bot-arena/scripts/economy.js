import { companions, defaultCosmetic, getHeroStats, getUpgradeCost, heroes, maxUpgradeLevel, starterHeroes } from "./config.js?v=musicvolume1";
import { escapeHtml } from "./utils.js";
import { saveCoins, saveProgression } from "./storage.js?v=musicvolume1";
import { t } from "./settings.js?v=settings9";

export function isHeroUnlocked(state, heroId) {
  return state.unlockedHeroes.includes(heroId);
}

export function getHeroLevel(state, heroId) {
  return Number(state.upgrades[heroId]) || 0;
}

export function getSelectedHeroStats(state) {
  const hero = heroes[state.selectedHero];
  return getHeroStats(hero, getHeroLevel(state, state.selectedHero));
}

export function calculateCoinReward(state) {
  const baseReward = Math.max(12, state.wave * 8 + Math.floor(state.score / 170));
  const difficulty = state.difficulty || "normal";
  const multipliers = { easy: 0.18, normal: 0.55, hard: 0.85 };
  const minimums = { easy: 3, normal: 10, hard: 16 };
  const bossBonuses = { easy: 10, normal: 35, hard: 55 };
  const bossBonus = (Number(state.bossesDefeated) || 0) * (bossBonuses[difficulty] || 35);
  state.bossCoinBonus = bossBonus;
  return Math.max(minimums[difficulty] || 10, Math.round(baseReward * (multipliers[difficulty] || 0.55)) + bossBonus);
}

export function addCoins(state, amount, dom) {
  state.coins += amount;
  saveCoins(state.coins);
  updateCoinDisplay(state, dom);
}

export function updateCoinDisplay(state, dom) {
  if (dom.coinCount) dom.coinCount.textContent = state.coins;
}

export function renderHeroMenu(state, dom) {
  if (!dom.heroList) return;
  dom.heroList.innerHTML = Object.values(heroes)
    .map((hero) => renderHeroCard(state, hero, isHeroUnlocked(state, hero.id), true))
    .join("");
  renderHeroDetails(state, dom);
}

export function renderShop(state, dom) {
  if (!dom.shopList) return;
  const lockedHeroes = Object.values(heroes).filter((hero) => !isHeroUnlocked(state, hero.id));
  const companionCards = Object.values(companions)
    .filter((companion) => companion.id !== defaultCosmetic)
    .filter((companion) => !companion.hiddenUntilOwned || isCompanionOwned(state, companion.id))
    .map((companion) => renderCompanionCard(state, companion))
    .join("");
  dom.shopList.innerHTML = `
    <div class="shop-section">
      <div class="shop-heading">
        <span>${t("shop.heroes")}</span>
        <strong>${lockedHeroes.length === 0 ? t("shop.done") : `${lockedHeroes.length} ${t("shop.open")}`}</strong>
      </div>
      <div class="fighters shop-grid">
        ${
          lockedHeroes.length === 0
            ? `<div class="empty-shop">${t("shop.allUnlocked")}</div>`
            : lockedHeroes.map((hero) => renderHeroCard(state, hero, false, false)).join("")
        }
      </div>
    </div>
    <div class="shop-section">
      <div class="shop-heading">
        <span>${t("shop.companions")}</span>
        <strong>${t("shop.specialBonus")}</strong>
      </div>
      <div class="fighters shop-grid">${companionCards}</div>
    </div>
  `;
}

export function setupEconomyInput(state, dom) {
  dom.heroList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-hero]");
    if (!button) return;
    selectHero(state, dom, button.dataset.hero);
  });

  dom.shopList?.addEventListener("click", (event) => {
    const heroButton = event.target.closest("[data-buy-hero]");
    if (heroButton) {
      buyHero(state, dom, heroButton.dataset.buyHero);
      return;
    }

    const companionButton = event.target.closest("[data-buy-companion]");
    if (companionButton) {
      buyCompanion(state, dom, companionButton.dataset.buyCompanion);
      return;
    }

    const equipButton = event.target.closest("[data-equip-companion]");
    if (equipButton) equipCompanion(state, dom, equipButton.dataset.equipCompanion);
  });

  dom.heroDetails?.addEventListener("click", (event) => {
    if (!event.target.closest("#upgradeHeroBtn")) return;
    upgradeSelectedHero(state, dom);
  });
}

export function selectHero(state, dom, heroId) {
  if (!isHeroUnlocked(state, heroId)) {
    showShopPanel(dom);
    renderShop(state, dom);
    return;
  }
  state.selectedHero = heroId;
  renderHeroMenu(state, dom);
}

export function buyHero(state, dom, heroId) {
  const hero = heroes[heroId];
  if (!hero || isHeroUnlocked(state, heroId) || state.coins < hero.price) return;
  state.coins -= hero.price;
  state.unlockedHeroes.push(heroId);
  state.selectedHero = heroId;
  saveCoins(state.coins);
  saveProgression(state);
  updateCoinDisplay(state, dom);
  renderHeroMenu(state, dom);
  renderShop(state, dom);
  showHeroPanel(dom);
}

export function upgradeSelectedHero(state, dom) {
  const heroId = state.selectedHero;
  if (!isHeroUnlocked(state, heroId)) return;
  const level = getHeroLevel(state, heroId);
  if (level >= maxUpgradeLevel) return;
  const cost = getUpgradeCost(level);
  if (state.coins < cost) return;
  state.coins -= cost;
  state.upgrades[heroId] = level + 1;
  saveCoins(state.coins);
  saveProgression(state);
  updateCoinDisplay(state, dom);
  renderHeroMenu(state, dom);
}

export function isCompanionOwned(state, companionId) {
  return state.ownedCosmetics.includes(companionId);
}

export function getEquippedCosmetic(state) {
  return companions[state.equippedCosmetic] || companions[defaultCosmetic];
}

export function buyCompanion(state, dom, companionId) {
  const companion = companions[companionId];
  if (!companion || companion.rewardOnly || isCompanionOwned(state, companionId) || state.coins < companion.price) return;
  state.coins -= companion.price;
  state.ownedCosmetics.push(companionId);
  state.equippedCosmetic = companionId;
  saveCoins(state.coins);
  saveProgression(state);
  updateCoinDisplay(state, dom);
  renderHeroMenu(state, dom);
  renderShop(state, dom);
}

export function equipCompanion(state, dom, companionId) {
  if (!companions[companionId] || !isCompanionOwned(state, companionId)) return;
  state.equippedCosmetic = companionId;
  saveProgression(state);
  renderHeroMenu(state, dom);
  renderShop(state, dom);
}

export function showHeroPanel(dom) {
  dom.heroPanel?.classList.remove("hidden");
  dom.shopPanel?.classList.add("hidden");
  dom.heroMenuBtn?.classList.add("selected");
  dom.shopMenuBtn?.classList.remove("selected");
}

export function showShopPanel(dom) {
  dom.heroPanel?.classList.add("hidden");
  dom.shopPanel?.classList.remove("hidden");
  dom.heroMenuBtn?.classList.remove("selected");
  dom.shopMenuBtn?.classList.add("selected");
}

function renderHeroCard(state, hero, unlocked, selectable) {
  const level = getHeroLevel(state, hero.id);
  const selected = state.selectedHero === hero.id;
  const status = unlocked ? `${t("shop.level")} ${level}` : `${hero.price} ${t("shop.coins")}`;
  const action = selectable ? `data-hero="${hero.id}"` : `data-buy-hero="${hero.id}"`;
  return `
    <button class="fighter ${selected ? "selected" : ""} ${unlocked ? "" : "locked"}" ${action}>
      <span class="portrait ${starterHeroes.includes(hero.id) ? hero.id : ""}" style="color:${hero.color}"></span>
      <span class="fighter-name">${escapeHtml(hero.name)}</span>
      <span class="fighter-role">${t("hud.special")}</span>
      <span class="stats">${escapeHtml(translateStatsLabel(hero.statsLabel))}</span>
      <span class="hero-status">${status}</span>
    </button>
  `;
}

function renderCompanionCard(state, companion) {
  const owned = isCompanionOwned(state, companion.id);
  const equipped = state.equippedCosmetic === companion.id;
  const disabled = !owned && state.coins < companion.price;
  const action = owned ? `data-equip-companion="${companion.id}"` : companion.rewardOnly ? "" : `data-buy-companion="${companion.id}"`;
  const status = equipped ? t("shop.active") : owned ? t("shop.equip") : companion.rewardOnly ? t("shop.reward") : `${companion.price} ${t("shop.coins")}`;
  return `
    <button class="fighter companion-card ${equipped ? "selected" : ""} ${owned ? "" : "locked"}" ${action} ${disabled ? "disabled" : ""}>
      <span class="companion-swatch" style="--companion-color:${companion.color}; --companion-glow:${companion.glow};"></span>
      <span class="fighter-name">${escapeHtml(companion.name)}</span>
      <span class="fighter-role">${companion.ability ? companionAbilitySummary(companion) : t("shop.follows")}</span>
      <span class="stats">${companion.ability ? t("shop.abilityActivated") : t("shop.follows")}</span>
      <span class="hero-status">${status}</span>
    </button>
  `;
}

function renderHeroDetails(state, dom) {
  if (!dom.heroDetails) return;
  const hero = heroes[state.selectedHero];
  const level = getHeroLevel(state, hero.id);
  const upgraded = getHeroStats(hero, level);
  const maxed = level >= maxUpgradeLevel;
  const cost = getUpgradeCost(level);
  const companion = getEquippedCosmetic(state);
  dom.heroDetails.innerHTML = `
    <div>
      <span class="label">${t("shop.selected")}</span>
      <strong>${escapeHtml(hero.name)}</strong>
      <p>${t("shop.level")} ${level}/${maxUpgradeLevel} | ${t("shop.health")} ${upgraded.hp} | ${t("shop.damage")} ${upgraded.bulletDamage} | ${t("shop.speed")} ${upgraded.speed} | ${t("shop.companion")} ${escapeHtml(companion.name)}</p>
    </div>
    <button id="upgradeHeroBtn" ${maxed || state.coins < cost ? "disabled" : ""}>${maxed ? t("shop.maxLevel") : `${t("shop.upgrade")} ${cost} ${t("shop.coins")}`}</button>
  `;
}

function translateStatsLabel(label) {
  return String(label)
    .replace("Tempo", t("shop.speed"))
    .replace("Leben", t("shop.health"))
    .replace("Schaden", t("shop.damage"));
}

function companionAbilitySummary(companion) {
  const multiplier = Number(companion.ability?.multiplier) || 1;
  const percent = Math.round(Math.abs(multiplier - 1) * 100);
  return `${Number(companion.ability?.duration) || 5} s · ${percent}%`;
}
