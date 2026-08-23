// Aura-Box-Öffnungslogik: Seltenheit gewichtet auswürfeln, dann eine Aura
// dieser Seltenheit ziehen. Spiegelt core/gacha.js bewusst 1:1 (gleiches
// Prinzip, andere Sammlung), inklusive derselben weightedPick-Hilfe.
import { state } from "./state.js";
import { events } from "./events.js";
import { AURAS } from "../data/auras.js";
import { getAuraBox } from "../data/auraBoxes.js";
import { spendCoins } from "./wallet.js";
import { grantAura } from "./auras.js";
import { weightedPick } from "./random.js";

function rollRarity(odds) {
  const rarityIds = Object.keys(odds);
  return weightedPick(rarityIds, (rarityId) => odds[rarityId]);
}

function auraPoolForRarity(rarityId) {
  return AURAS.filter((aura) => aura.rarity === rarityId);
}

export function openAuraBox(boxId) {
  const box = getAuraBox(boxId);
  if (!box) return null;
  if (!spendCoins(box.price)) return null;

  const rarityId = rollRarity(box.odds);
  const pool = auraPoolForRarity(rarityId);
  const aura = pool[Math.floor(Math.random() * pool.length)];

  const { isNew } = grantAura(aura.id);
  state.auraBoxesOpened += 1;

  const result = { box, aura, isNew };
  events.emit("auraBox:opened", result);
  events.emit("state:changed", state);
  return result;
}
