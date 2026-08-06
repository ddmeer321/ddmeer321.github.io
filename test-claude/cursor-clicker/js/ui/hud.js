// Immer sichtbare Kopfzeile: Coins, Coins/Klick, ausgerüsteter Cursor, gesammelte Cursor.
import { state } from "../core/state.js";
import { getCoinsPerClick, getEquippedCursor } from "../core/economy.js";
import { getUniqueCursorsDrawn, getTotalCursorCatalogSize } from "../core/stats.js";
import { canClaimDailyReward } from "../core/dailyReward.js";
import { formatNumber } from "./format.js";

export function renderHud() {
  document.getElementById("hud-coins").textContent = formatNumber(state.coins);
  document.getElementById("hud-cpc").textContent = formatNumber(getCoinsPerClick());

  const equipped = getEquippedCursor();
  document.getElementById("hud-equipped").textContent = equipped ? equipped.icon + " " + equipped.name : "—";

  document.getElementById("hud-collected").textContent = getUniqueCursorsDrawn() + " / " + getTotalCursorCatalogSize();

  const dailyBtn = document.getElementById("daily-reward-btn");
  dailyBtn.classList.toggle("cc-daily-btn-ready", canClaimDailyReward());
}
