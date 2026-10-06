// Neon Lotto (V1.2) – Regeln, Ziehungstermine, Auswertung und Verwaltung.
//
// Zwei Ziehungen mit derselben Technik:
//   * Neon Lotto        – täglich 20:00 Uhr, 4 aus 20, Schein 50 Credits
//   * Großes Neon Lotto – alle 3 Tage 21:00 Uhr, 4 aus 24, Schein 100 Credits
// Höchstens 20 Scheine pro Ziehung. Gewinnplan und Wahrscheinlichkeiten:
// docs/ECONOMY.md (Abschnitt Lotto) und tests/lotto.test.mjs.
//
// EHRLICHKEIT: Jede Ziehung hat eine stabile id („daily-2026-10-06“). Ihr
// Ergebnis wird beim ersten Erreichen des Termins EINMAL mit crypto-Zufall
// erzeugt und sofort gespeichert. Danach zeigt jede Präsentation (live,
// Aufzeichnung, übersprungen, nach Neuladen) genau dieses Ergebnis. Eine
// Ziehung ohne eigene Scheine wird nicht ausgelost (nichts zu entscheiden).
//
// Grenze (bewusst akzeptiert): Alles läuft im Browser. Wer Systemuhr oder
// localStorage mit Entwicklerwerkzeugen verändert, kann Termine verschieben
// oder Ergebnisse überschreiben. Für reines Spielgeld ist das in Ordnung.

import { random } from "./rng.js";

export const MAX_TICKETS = 20;
export const PICK = 4;
/** Annahmeschluss: so viele ms vor der Ziehung werden keine Scheine mehr für sie verkauft. */
export const SALES_CLOSE_MS = 60_000;
/** So lange nach dem Termin gilt eine Ziehung noch als „live“. */
export const LIVE_WINDOW_MS = 10 * 60_000;
export const KEEP_DRAWS = 40;

export const DRAWS = {
  daily: {
    id: "daily",
    name: "Neon Lotto",
    short: "Täglich",
    pool: 20,
    price: 50,
    hour: 20,
    minute: 0,
    everyDays: 1,
    prizes: { 4: 10000, 3: 1000, 2: 100 },
  },
  grand: {
    id: "grand",
    name: "Großes Neon Lotto",
    short: "Alle 3 Tage",
    pool: 24,
    price: 100,
    hour: 21,
    minute: 0,
    everyDays: 3,
    prizes: { 4: 120000, 3: 4000, 2: 150 },
  },
};
export const DRAW_TYPES = Object.keys(DRAWS);

// ---------- Kombinatorik ----------

export function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** Wahrscheinlichkeit für genau k Richtige bei „4 aus pool“. */
export function pMatches(pool, k, pick = PICK) {
  return (choose(pick, k) * choose(pool - pick, pick - k)) / choose(pool, pick);
}

/** Erwartete Rückzahlung je eingesetztem Credit (RTP). */
export function rtpOf(type) {
  const d = DRAWS[type];
  let ev = 0;
  for (const [k, prize] of Object.entries(d.prizes)) ev += pMatches(d.pool, Number(k)) * prize;
  return ev / d.price;
}

export function prizeFor(type, k) {
  return DRAWS[type]?.prizes[k] || 0;
}

// ---------- Termine (lokale Zeitzone) ----------

const pad = (n) => String(n).padStart(2, "0");
export function dateKey(y, m, d) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}
/** Fortlaufende Tagesnummer eines Kalenderdatums (unabhängig von Sommerzeit). */
export function dayNumber(y, m, d) {
  return Math.round(Date.UTC(y, m, d) / 86400000);
}
export function drawIdFor(type, y, m, d) {
  return `${type}-${dateKey(y, m, d)}`;
}
export function parseDrawId(id) {
  const m = /^(daily|grand)-(\d{4})-(\d{2})-(\d{2})$/.exec(typeof id === "string" ? id : "");
  if (!m) return null;
  const [y, mo, d] = [Number(m[2]), Number(m[3]) - 1, Number(m[4])];
  const check = new Date(y, mo, d);
  if (check.getFullYear() !== y || check.getMonth() !== mo || check.getDate() !== d) return null; // z. B. 2026-13-01
  const def = DRAWS[m[1]];
  const at = new Date(y, mo, d, def.hour, def.minute, 0, 0).getTime();
  return { id, type: m[1], y, m: mo, d, at };
}
/** Findet an diesem Kalendertag eine Ziehung dieses Typs statt? */
export function isDrawDay(type, y, m, d) {
  const every = DRAWS[type].everyDays;
  return every <= 1 || ((dayNumber(y, m, d) % every) + every) % every === 0;
}

/** Die nächste Ziehung, für die noch Scheine verkauft werden. */
export function nextDraw(type, now = Date.now()) {
  const base = new Date(now);
  for (let i = 0; i < 8; i++) {
    const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    const [y, m, d] = [day.getFullYear(), day.getMonth(), day.getDate()];
    if (!isDrawDay(type, y, m, d)) continue;
    const info = parseDrawId(drawIdFor(type, y, m, d));
    if (info.at - SALES_CLOSE_MS > now) return info;
  }
  return null;
}

export function formatDrawDate(at) {
  const d = new Date(at);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
}
export function formatDrawTime(at, now = Date.now()) {
  const d = new Date(at);
  const today = new Date(now);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const day = same(d, today) ? "heute" : same(d, tomorrow) ? "morgen" : `am ${formatDrawDate(at)}`;
  return `${day} ${pad(d.getHours())}:${pad(d.getMinutes())} Uhr`;
}

// ---------- Scheine & Auswertung ----------

/** Prüft eine Zahlenauswahl. Rückgabe: sortierte Zahlen oder null. */
export function validNumbers(type, nums) {
  const d = DRAWS[type];
  if (!d || !Array.isArray(nums) || nums.length !== PICK) return null;
  const set = new Set();
  for (const n of nums) {
    if (!Number.isInteger(n) || n < 1 || n > d.pool || set.has(n)) return null;
    set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/** Zieht PICK verschiedene Zahlen aus 1..pool (in Ziehungsreihenfolge). */
export function drawNumbers(pool, rnd = random) {
  const all = Array.from({ length: pool }, (_, i) => i + 1);
  const out = [];
  for (let i = 0; i < PICK; i++) {
    const j = i + Math.floor(rnd() * (pool - i));
    [all[i], all[j]] = [all[j], all[i]];
    out.push(all[i]);
  }
  return out;
}

export function quickPick(type, rnd = random) {
  return drawNumbers(DRAWS[type].pool, rnd).sort((a, b) => a - b);
}

export function evaluate(type, drawn, tickets) {
  const set = new Set(drawn);
  let payout = 0;
  const results = tickets.map((t) => {
    const hits = t.nums.filter((n) => set.has(n));
    const prize = prizeFor(type, hits.length);
    payout += prize;
    return { id: t.id, nums: t.nums.slice(), hits, k: hits.length, prize };
  });
  return { results, payout };
}

// ---------- Bereinigung ----------

export function defaultLotto() {
  return { tickets: {}, draws: {}, seq: 0 };
}

export function sanitizeLotto(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = defaultLotto();
  out.seq = Number.isSafeInteger(src.seq) && src.seq >= 0 ? src.seq : 0;
  const tix = src.tickets && typeof src.tickets === "object" ? src.tickets : {};
  for (const [id, list] of Object.entries(tix)) {
    const info = parseDrawId(id);
    if (!info || !Array.isArray(list)) continue;
    const clean = [];
    for (const t of list) {
      const nums = validNumbers(info.type, t?.nums);
      if (!nums || clean.length >= MAX_TICKETS) continue;
      clean.push({ id: String(t.id || `t${clean.length}`).slice(0, 24), nums, at: Number.isFinite(t.at) ? t.at : 0, price: DRAWS[info.type].price });
    }
    if (clean.length) out.tickets[id] = clean;
  }
  const draws = src.draws && typeof src.draws === "object" ? src.draws : {};
  for (const [id, dr] of Object.entries(draws)) {
    const info = parseDrawId(id);
    if (!info || !dr || typeof dr !== "object") continue;
    const nums = Array.isArray(dr.nums) && dr.nums.length === PICK && validNumbers(info.type, dr.nums) ? dr.nums.slice() : null;
    if (!nums) continue; // beschädigt: lieber verwerfen als ein falsches Ergebnis zeigen
    const tickets = Array.isArray(dr.tickets) ? dr.tickets.map((t) => ({ id: String(t?.id || "").slice(0, 24), nums: validNumbers(info.type, t?.nums) })).filter((t) => t.nums).slice(0, MAX_TICKETS) : [];
    const ev = evaluate(info.type, nums, tickets);
    out.draws[id] = {
      id,
      type: info.type,
      at: info.at,
      nums,
      tickets,
      results: ev.results,
      stake: tickets.length * DRAWS[info.type].price,
      payout: ev.payout, // immer neu berechnet – manipulierte Beträge zählen nicht
      createdAt: Number.isFinite(dr.createdAt) ? dr.createdAt : info.at,
      live: dr.live === true,
      seen: dr.seen === true,
      claimed: dr.claimed === true,
      claimedAt: Number.isFinite(dr.claimedAt) ? dr.claimedAt : 0,
    };
    delete out.tickets[id]; // ausgeloste Ziehung: Scheine stecken im Ergebnis
  }
  const keep = Object.values(out.draws).sort((a, b) => b.at - a.at).slice(0, KEEP_DRAWS).map((d) => d.id);
  for (const id of Object.keys(out.draws)) if (!keep.includes(id) && (out.draws[id].claimed || out.draws[id].payout === 0)) delete out.draws[id];
  return out;
}

// ---------- Verwaltung ----------

/**
 * @param {object} o
 * @param {() => object} o.getState
 * @param {object} o.economy        debit/credit aus core/economy.js
 * @param {() => void} o.saveNow    schreibt sofort (Ergebnis/Claim dürfen nicht verloren gehen)
 * @param {object} [o.inbox]        Posteingang (core/inbox.js)
 * @param {(ev:string, d?:any) => void} [o.emit]
 * @param {() => number} [o.now]
 * @param {() => number} [o.rnd]    Zufall für die Ziehung (Standard: crypto)
 */
export function createLotto({ getState, economy, saveNow, inbox = null, emit = () => {}, now = () => Date.now(), rnd = random }) {
  const L = () => {
    const s = getState();
    if (!s.lotto || typeof s.lotto !== "object") s.lotto = defaultLotto();
    return s.lotto;
  };

  function ticketsFor(drawId) {
    return L().tickets[drawId] || [];
  }

  function messageFor(d) {
    const def = DRAWS[d.type];
    return {
      id: `lotto:${d.id}`,
      type: "lotto",
      ts: d.at,
      title: `${def.name} – Ziehung vom ${formatDrawDate(d.at)}`,
      body: `Deine ${d.tickets.length === 1 ? "Schein wurde" : `${d.tickets.length} Scheine wurden`} ausgewertet.`,
      payload: { drawId: d.id },
      action: { label: "Ziehung ansehen", kind: "lotto:show" },
    };
  }

  const api = {
    DRAWS,
    nextDraw: (type) => nextDraw(type, now()),
    ticketsFor,
    /**
     * Kauft einen Schein für die nächste Ziehung dieses Typs.
     * Atomar: erst vollständig prüfen, dann genau einmal abbuchen, dann speichern.
     */
    buy(type, nums) {
      const def = DRAWS[type];
      if (!def) return { ok: false, reason: "Unbekannte Ziehung" };
      const clean = validNumbers(type, nums);
      if (!clean) return { ok: false, reason: `Wähle genau ${PICK} verschiedene Zahlen von 1 bis ${def.pool}` };
      const draw = nextDraw(type, now());
      if (!draw) return { ok: false, reason: "Gerade keine Ziehung im Verkauf" };
      const list = ticketsFor(draw.id);
      if (list.length >= MAX_TICKETS) return { ok: false, reason: `Höchstens ${MAX_TICKETS} Scheine pro Ziehung` };
      if (list.some((t) => t.nums.join(",") === clean.join(","))) return { ok: false, reason: "Diesen Schein hast du für diese Ziehung schon" };
      if (!economy.debit("lotto", def.price, "lotto")) return { ok: false, reason: economy.balance < def.price ? "Nicht genug Credits" : "Gerade nicht möglich" };
      const lotto = L();
      lotto.seq++;
      const ticket = { id: `t${lotto.seq}`, nums: clean, at: now(), price: def.price };
      (lotto.tickets[draw.id] ||= []).push(ticket);
      saveNow();
      emit("lotto:ticket", { drawId: draw.id, type });
      return { ok: true, ticket, draw };
    },
    /** Lost alle fälligen Ziehungen mit eigenen Scheinen aus (genau einmal). Rückgabe: neu ausgeloste Ziehungen. */
    realizeDue() {
      const lotto = L();
      const t = now();
      const fresh = [];
      const due = Object.keys(lotto.tickets)
        .map(parseDrawId)
        .filter((i) => i && i.at <= t && !lotto.draws[i.id])
        .sort((a, b) => a.at - b.at);
      for (const info of due) {
        const tickets = lotto.tickets[info.id].map((x) => ({ id: x.id, nums: x.nums.slice() }));
        const nums = drawNumbers(DRAWS[info.type].pool, rnd);
        const ev = evaluate(info.type, nums, tickets);
        const d = {
          id: info.id,
          type: info.type,
          at: info.at,
          nums,
          tickets,
          results: ev.results,
          stake: tickets.length * DRAWS[info.type].price,
          payout: ev.payout,
          createdAt: t,
          live: t - info.at <= LIVE_WINDOW_MS,
          seen: false,
          claimed: false,
          claimedAt: 0,
        };
        lotto.draws[info.id] = d;
        delete lotto.tickets[info.id];
        fresh.push(d);
      }
      if (fresh.length) {
        // Ergebnis zuerst sichern, erst dann irgendetwas anzeigen
        saveNow();
        for (const d of fresh) inbox?.add(messageFor(d));
        emit("lotto:drawn", fresh);
      }
      return fresh;
    },
    draw(id) {
      return L().draws[id] || null;
    },
    /** Ausgeloste Ziehungen, neueste zuerst. */
    archive() {
      return Object.values(L().draws).sort((a, b) => b.at - a.at);
    },
    /** Kommende Ziehungen mit eigenen Scheinen. */
    upcoming() {
      return Object.entries(L().tickets)
        .map(([id, list]) => ({ ...parseDrawId(id), tickets: list }))
        .filter((x) => x.id)
        .sort((a, b) => a.at - b.at);
    },
    unclaimed() {
      return api.archive().filter((d) => d.payout > 0 && !d.claimed);
    },
    /**
     * Zahlt den Gewinn einer Ziehung aus – höchstens einmal, egal wie oft
     * geklickt, neu geladen oder die Nachricht geöffnet wird.
     */
    claim(id) {
      const d = L().draws[id];
      if (!d || d.claimed || d.payout <= 0) return 0;
      d.claimed = true;
      d.claimedAt = now();
      d.seen = true;
      economy.credit("lotto", d.payout, "lotto");
      economy.countRound?.("lotto");
      saveNow();
      inbox?.markRead(`lotto:${id}`);
      emit("lotto:claimed", { id, payout: d.payout });
      return d.payout;
    },
    /**
     * Die Ziehung wurde vollständig angesehen und das Ergebnis behandelt
     * (Verlust bestätigt oder Gewinn eingefordert). Wurde sie live gesehen,
     * verschwindet die Posteingangs-Nachricht – keine überflüssige Doppelmeldung.
     */
    markSeen(id, { live = false } = {}) {
      const d = L().draws[id];
      if (!d) return false;
      d.seen = true;
      if (d.payout === 0 && !d.claimed) {
        d.claimed = true; // nichts auszuzahlen – gilt als erledigt
        economy.countRound?.("lotto");
      }
      saveNow();
      if (live) inbox?.remove(`lotto:${id}`);
      else inbox?.markRead(`lotto:${id}`);
      return true;
    },
  };
  return api;
}
