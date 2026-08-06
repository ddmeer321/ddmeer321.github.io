// Wiederverwendbare Aura-Darstellung: Ringe + Partikel, großflächig HINTER dem
// Cursor (siehe css/auras.css für die eigentlichen Ring-/Partikel-Stile je
// Seltenheit). Rendert nichts (leerer Layer), wenn keine Aura ausgerüstet ist.
import { getRarity } from "../data/rarities.js";

export function renderAuraLayer(aura) {
  if (!aura) return '<div class="cc-aura-layer" aria-hidden="true"></div>';

  const color = getRarity(aura.rarity).color;
  const rings = Array.from({ length: aura.ringCount }, (_, i) => `<span class="cc-aura-ring cc-aura-ring-${i + 1}"></span>`).join("");

  return (
    `<div class="cc-aura-layer ${aura.visualClass}" style="--aura-color:${color}" aria-hidden="true">` +
    rings +
    `<span class="cc-aura-particles"></span>` +
    `</div>`
  );
}
