// Fusion: verbraucht Basis-Duplikate eines Cursors und erzeugt eine mutierte
// Instanz (siehe state.mutatedCursors). Ersetzt nie den Basis-Cursor, sondern
// legt ein zusätzliches, separat ausrüstbares Ergebnis an.
import { state } from "./state.js";
import { events } from "./events.js";
import { getCursor } from "../data/cursors.js";
import { FUSION_OUTCOME_ODDS, getMutationsByTier, getMutation } from "../data/mutations.js";
import { weightedPick, toPercentRows } from "./random.js";
import { getFusionDropChanceBonus } from "./loadout.js";

// Basiskosten in Duplikaten. Als Funktion gehalten, damit spätere Balance-Änderungen
// (z.B. nach Seltenheit gestaffelt) keine Aufrufer anfassen müssen.
export function getFusionCost() {
  return 5;
}

export function getDuplicateCount(cursorId) {
  return state.ownedCursors[cursorId]?.count || 0;
}

export function canFuse(cursorId) {
  return getDuplicateCount(cursorId) >= getFusionCost(cursorId);
}

export function getFusableCursorIds() {
  return Object.keys(state.ownedCursors).filter((id) => canFuse(id));
}

// Lucky-artige Mutationen verschieben das Ergebnis leicht weg von "nur Minor"
// hin zu "auch Major" — nie unter eine Mindestchance auf das einfache Ergebnis.
function getOutcomeOdds(cursorId) {
  const bonus = Math.max(0, getFusionDropChanceBonus(cursorId));
  const base = FUSION_OUTCOME_ODDS;
  const shift = Math.min(bonus, base.minorOnly - 10);
  return {
    minorOnly: base.minorOnly - shift,
    majorOnly: base.majorOnly + shift * 0.7,
    majorAndMinor: base.majorAndMinor + shift * 0.3,
  };
}

// Vollständige Odds-Vorschau fürs Fusion-Menü: Ergebnistyp + welche Mutation
// innerhalb jeder Stufe. Nutzt dieselbe toPercentRows-Form wie die Boxen-Odds.
export function getFusionOddsPreview(cursorId) {
  const outcomeWeights = getOutcomeOdds(cursorId);
  const minorWeights = Object.fromEntries(getMutationsByTier("minor").map((m) => [m.id, m.weight]));
  const majorWeights = Object.fromEntries(getMutationsByTier("major").map((m) => [m.id, m.weight]));
  return {
    outcome: toPercentRows(outcomeWeights),
    minor: toPercentRows(minorWeights),
    major: toPercentRows(majorWeights),
  };
}

function rollInstanceId(cursorId) {
  return cursorId + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
}

export function performFusion(cursorId) {
  if (!canFuse(cursorId)) return null;
  const cursor = getCursor(cursorId);
  if (!cursor) return null;

  state.ownedCursors[cursorId].count -= getFusionCost(cursorId);
  state.fusionsPerformed += 1;

  const outcomeOdds = getOutcomeOdds(cursorId);
  const outcome = weightedPick(Object.keys(outcomeOdds), (key) => outcomeOdds[key]);
  const rollsMajor = outcome === "majorOnly" || outcome === "majorAndMinor";
  const rollsMinor = outcome === "minorOnly" || outcome === "majorAndMinor";

  const majorId = rollsMajor ? weightedPick(getMutationsByTier("major"), (m) => m.weight).id : null;
  const minorId = rollsMinor ? weightedPick(getMutationsByTier("minor"), (m) => m.weight).id : null;

  const instance = { instanceId: rollInstanceId(cursorId), major: majorId, minor: minorId, createdAt: Date.now() };
  if (!state.mutatedCursors[cursorId]) state.mutatedCursors[cursorId] = [];
  state.mutatedCursors[cursorId].push(instance);

  const majorMutation = getMutation(majorId);
  const minorMutation = getMutation(minorId);
  const spectacular = Boolean(majorMutation?.spectacular || minorMutation?.spectacular);

  const result = { cursorId, cursor, instance, majorMutation, minorMutation, spectacular };
  events.emit("fusion:completed", result);
  events.emit("state:changed", state);
  return result;
}
