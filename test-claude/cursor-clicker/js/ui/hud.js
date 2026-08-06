// Immer sichtbare Kopfzeile: Coins, Coins/Klick, ausgerüsteter Cursor (inkl.
// Level/Mutation-Badge), gesammelte Cursor.
import { state } from "../core/state.js";
import { getCoinsPerClick } from "../core/economy.js";
import { getEquippedLoadout } from "../core/loadout.js";
import { getUniqueCursorsDrawn, getTotalCursorCatalogSize } from "../core/stats.js";
import { canClaimDailyReward } from "../core/dailyReward.js";
import { formatNumber } from "./format.js";

export function renderHud() {
  document.getElementById("hud-coins").textContent = formatNumber(state.coins);
  document.getElementById("hud-cpc").textContent = formatNumber(getCoinsPerClick());

  const loadout = getEquippedLoadout();
  const equippedEl = document.getElementById("hud-equipped");
  if (!loadout.cursor) {
    equippedEl.textContent = "—";
  } else {
    const levelTag = " Lv." + loadout.level;
    const mutationTag = loadout.mutationMajor || loadout.mutationMinor
      ? " ✦" + [loadout.mutationMajor?.name, loadout.mutationMinor?.name].filter(Boolean).join("+")
      : "";
    equippedEl.textContent = loadout.cursor.icon + " " + loadout.cursor.name + levelTag + mutationTag;
  }

  document.getElementById("hud-collected").textContent = getUniqueCursorsDrawn() + " / " + getTotalCursorCatalogSize();

  const dailyBtn = document.getElementById("daily-reward-btn");
  dailyBtn.classList.toggle("cc-daily-btn-ready", canClaimDailyReward());
}
