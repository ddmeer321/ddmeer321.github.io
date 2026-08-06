export const OWNED_SCORE_STORAGE_KEY = "neon-bot-arena-owned-online-scores";
const MAX_OWNED_SCORE_RECEIPTS = 50;

export function normalizeDeletionReceipt(payload, scoreEntry = {}) {
  const scoreId = String(payload?.deletion?.score_id || "").trim().toLowerCase();
  const deleteToken = String(payload?.deletion?.delete_token || "").trim().toLowerCase();
  if (!isValidScoreId(scoreId) || !isValidDeleteToken(deleteToken)) return null;
  return {
    scoreId,
    deleteToken,
    name: String(scoreEntry.name || "").trim().slice(0, 16),
    score: Math.max(0, Math.round(Number(scoreEntry.scores) || 0)),
    wave: Math.max(1, Math.round(Number(scoreEntry.wave) || 1)),
    createdAt: new Date().toISOString()
  };
}

export function addOwnedScoreReceipt(records, receipt) {
  if (!receipt || !isValidScoreId(receipt.scoreId) || !isValidDeleteToken(receipt.deleteToken)) {
    return sanitizeOwnedScoreReceipts(records);
  }
  const next = sanitizeOwnedScoreReceipts(records).filter((entry) => entry.scoreId !== receipt.scoreId);
  next.unshift(receipt);
  return next.slice(0, MAX_OWNED_SCORE_RECEIPTS);
}

export function removeOwnedScoreReceipt(records, scoreId) {
  return sanitizeOwnedScoreReceipts(records).filter((entry) => entry.scoreId !== scoreId);
}

export function sanitizeOwnedScoreReceipts(records) {
  if (!Array.isArray(records)) return [];
  return records
    .filter((entry) => entry && isValidScoreId(entry.scoreId) && isValidDeleteToken(entry.deleteToken))
    .map((entry) => ({
      scoreId: entry.scoreId.toLowerCase(),
      deleteToken: entry.deleteToken.toLowerCase(),
      name: String(entry.name || "").trim().slice(0, 16),
      score: Math.max(0, Math.round(Number(entry.score) || 0)),
      wave: Math.max(1, Math.round(Number(entry.wave) || 1)),
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : ""
    }))
    .slice(0, MAX_OWNED_SCORE_RECEIPTS);
}

export function isValidScoreId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export function isValidDeleteToken(value) {
  return /^[0-9a-f]{64}$/i.test(String(value || ""));
}
