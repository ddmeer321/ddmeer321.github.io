import { cleanName } from "./utils.js";

import { testSiteBuild } from "./config.js?v=testsite1";

import {
  addOwnedScoreReceipt,
  normalizeDeletionReceipt,
  OWNED_SCORE_STORAGE_KEY,
  removeOwnedScoreReceipt,
  sanitizeOwnedScoreReceipts
} from "./owned-score-store.js?v=deletion1";

const SUPABASE_URL = "https://ncishdfeznjysqswsvzq.supabase.co";
const SUPABASE_KEY = "sb_publishable_NKMtRTJM-5O0rWaJP3pGaw_vvofM_H8";
const SCORE_TABLE = "scores";
const SCORE_SUBMIT_URL = `${SUPABASE_URL}/functions/v1/submit-score`;
const SCORE_FIELDS = "name,scores,wave,diffculty,bosses,hero,player_count";
const LEGACY_SCORE_FIELDS = "name,scores,wave,diffculty,bosses,hero";
const BLOCKED_SCORE_NAMES = new Set([["co", "de", "24", ".", "4"].join("")]);

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json"
};

export async function loadOnlineScores(limit = 10, filter = "all") {
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${SCORE_TABLE}`);
    url.searchParams.set("select", SCORE_FIELDS);
    url.searchParams.set("order", "scores.desc,wave.desc");
    url.searchParams.set("limit", String(Math.max(limit * 6, 50)));
    if (filter === "players-2") {
      url.searchParams.set("player_count", "eq.2");
    } else {
      url.searchParams.set("player_count", "eq.1");
      if (filter && filter !== "all") url.searchParams.set("diffculty", `eq.${filter}`);
    }

    let response = await fetch(url, { headers });
    if (!response.ok && response.status === 400) {
      if (filter === "players-2") return [];
      url.searchParams.set("select", LEGACY_SCORE_FIELDS);
      url.searchParams.delete("player_count");
      response = await fetch(url, { headers });
    }
    if (!response.ok) throw new Error(`Rangliste konnte nicht geladen werden: ${response.status}`);

    const rows = await response.json();
    return Array.isArray(rows) ? getBestScoresByName(rows.map(normalizeScoreRow).filter(Boolean)).slice(0, limit) : [];
  } catch (error) {
    console.warn(error);
    return null;
  }
}

export async function submitOnlineScore(state) {
  if (!isOnlineScoreEligible(state)) {
    return { ok: false, reason: "test-mode" };
  }
  const name = cleanName(state.playerName);
  if (BLOCKED_SCORE_NAMES.has(name.toLowerCase())) {
    return { ok: false, reason: "blocked-name" };
  }

  const entry = {
    name,
    scores: Math.max(0, Math.round(Number(state.score) || 0)),
    wave: Math.max(1, Math.round(Number(state.wave) || 1)),
    diffculty: state.difficulty || "normal",
    bosses: Math.max(0, Math.round(Number(state.bossesDefeated) || 0)),
    hero: state.player?.hero?.name || state.selectedHero || "Unbekannt",
    player_count: Math.max(1, Math.min(3, Math.round(Number(state.multiplayer?.playerCount) || 1)))
  };
  if (!isPlausibleScore(entry.scores, entry.wave, entry.bosses)) {
    return { ok: false, reason: "implausible-score" };
  }

  try {
    const response = await fetch(SCORE_SUBMIT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(entry)
    });

    if (!response.ok) {
      const details = await readResponseError(response);
      const reason = response.status === 429 ? "rate-limited" : "score-rejected";
      console.warn(`Score wurde vom sicheren Endpunkt abgelehnt: ${response.status}${details ? ` (${details})` : ""}`);
      return { ok: false, reason, status: response.status, details };
    }
    const payload = await readJsonResponse(response);
    const receipt = normalizeDeletionReceipt(payload, entry);
    if (receipt) saveOwnedOnlineScores(addOwnedScoreReceipt(getOwnedOnlineScores(), receipt));
    return { ok: true, deletionStored: Boolean(receipt) };
  } catch (error) {
    console.warn(error);
    return {
      ok: false,
      reason: "network-error",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

export function isOnlineScoreEligible(state) {
  return testSiteBuild !== true && state?.testMode !== true && (!state?.gameMode || state.gameMode === "normal");
}

export function getOwnedOnlineScores() {
  try {
    return sanitizeOwnedScoreReceipts(JSON.parse(localStorage.getItem(OWNED_SCORE_STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

export async function deleteOwnedOnlineScore(scoreId) {
  const receipt = getOwnedOnlineScores().find((entry) => entry.scoreId === scoreId);
  if (!receipt) return { ok: false, reason: "missing-deletion-token" };

  try {
    const response = await fetch(SCORE_SUBMIT_URL, {
      method: "DELETE",
      headers,
      body: JSON.stringify({
        score_id: receipt.scoreId,
        delete_token: receipt.deleteToken
      })
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: response.status === 429 ? "rate-limited" : "delete-rejected",
        status: response.status,
        details: await readResponseError(response)
      };
    }
    saveOwnedOnlineScores(removeOwnedScoreReceipt(getOwnedOnlineScores(), receipt.scoreId));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: "network-error",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

function saveOwnedOnlineScores(records) {
  localStorage.setItem(OWNED_SCORE_STORAGE_KEY, JSON.stringify(sanitizeOwnedScoreReceipts(records)));
  window.dispatchEvent(new CustomEvent("ownedscoreschange"));
}

async function readJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function readResponseError(response) {
  try {
    const text = await response.text();
    if (!text) return "";
    try {
      const payload = JSON.parse(text);
      return [payload.code, payload.message, payload.details, payload.error].filter(Boolean).join(": ");
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return "";
  }
}

function normalizeScoreRow(row) {
  if (!row || !row.name) return null;
  const name = cleanName(row.name);
  if (BLOCKED_SCORE_NAMES.has(name.toLowerCase())) return null;
  const score = Number(row.scores);
  if (!Number.isFinite(score)) return null;
  const wave = Number(row.wave) || 1;
  const bosses = Number(row.bosses) || 0;
  if (!isPlausibleScore(score, wave, bosses)) return null;
  return {
    name,
    score,
    wave,
    difficulty: row.diffculty || "normal",
    bosses,
    hero: row.hero || "",
    playerCount: Math.max(1, Math.min(3, Math.round(Number(row.player_count) || 1)))
  };
}

function getBestScoresByName(scores) {
  const bestByName = new Map();
  for (const entry of scores) {
    const key = entry.name.toLowerCase();
    const current = bestByName.get(key);
    if (!current || entry.score > current.score || (entry.score === current.score && entry.wave > current.wave)) {
      bestByName.set(key, entry);
    }
  }
  return [...bestByName.values()].sort((a, b) => b.score - a.score || b.wave - a.wave);
}

function isPlausibleScore(score, wave, bosses = 0) {
  const safeWave = Math.max(1, Math.round(Number(wave) || 1));
  const safeBosses = Math.max(0, Math.round(Number(bosses) || 0));
  const maxScore = 5000 + safeWave * 1200 + safeWave * safeWave * 70 + safeBosses * 1200;
  return score <= maxScore;
}
