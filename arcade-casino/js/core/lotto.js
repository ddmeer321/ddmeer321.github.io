// Neon Lotto (V1.2.1) – Regeln, Ziehungstermine, Auswertung und Verwaltung.
//
// Zwei Ziehungen:
//   * Neon Lotto        – täglich 20:00 Uhr, 4 aus 40, Schein 50 Credits
//   * Großes Neon Lotto – alle 3 Tage 21:00 Uhr, 6 aus 49 + Neonzahl (0–9),
//                         Schein 100 Credits, Höchstgewinn 1 : 139.838.160
// Höchstens 20 Scheine pro Ziehung. Gewinnplan und Wahrscheinlichkeiten:
// docs/ECONOMY.md (Abschnitt Lotto) und tests/lotto.test.mjs.
//
// REGELWERKE: Jeder Schein und jede ausgeloste Ziehung trägt die Version des
// Regelwerks, unter dem sie entstanden ist (`r`). V1.2-Daten haben kein `r`
// und gelten als Regelwerk 1 (4 aus 20 bzw. 4 aus 24). Gespeicherte Ziehungen
// werden immer nach IHREM Regelwerk ausgewertet – ein Update ändert weder
// Zahlen noch Gewinne. Noch nicht ausgeloste Scheine nach Regelwerk 1 werden
// einmalig erstattet (refundLegacy), statt sie unter neuen Quoten zu ziehen.
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
/** Annahmeschluss: so viele ms vor der Ziehung werden keine Scheine mehr für sie verkauft. */
export const SALES_CLOSE_MS = 60_000;
/** So lange nach dem Termin gilt eine Ziehung noch als „live“. */
export const LIVE_WINDOW_MS = 10 * 60_000;
export const KEEP_DRAWS = 40;
/** Aktuelles Regelwerk für neue Scheine. */
export const RULES_VERSION = 2;

/**
 * Gewinnklassen: k = richtige Zahlen, n = Neonzahl richtig (true/false) bzw.
 * undefined, wenn das Regelwerk keine Neonzahl kennt.
 */
const cls = (k, prize, n) => ({ id: n === undefined ? String(k) : `${k}${n ? "+N" : ""}`, k, n, prize, label: `${k} Richtige${n ? " + Neonzahl" : ""}` });

export const RULES = {
  daily: {
    1: { pick: 4, pool: 20, neon: 0, price: 50, classes: [cls(4, 10000), cls(3, 1000), cls(2, 100)] },
    2: { pick: 4, pool: 40, neon: 0, price: 50, classes: [cls(4, 150000), cls(3, 7500), cls(2, 350)] },
  },
  grand: {
    1: { pick: 4, pool: 24, neon: 0, price: 100, classes: [cls(4, 120000), cls(3, 4000), cls(2, 150)] },
    2: {
      pick: 6,
      pool: 49,
      neon: 10, // Neonzahl 0–9
      price: 100,
      classes: [
        cls(6, 10_000_000, true),
        cls(6, 1_000_000, false),
        cls(5, 300_000, true),
        cls(5, 75_000, false),
        cls(4, 20_000, true),
        cls(4, 5_000, false),
        cls(3, 4_000, true),
        cls(3, 1_250, false), // 1 : 63
        cls(2, 1_250, true), //  1 : 75,5 – seltener als „3 Richtige“, daher nicht weniger wert
      ],
    },
  },
};

const SCHEDULE = {
  daily: { id: "daily", name: "Neon Lotto", short: "Täglich", hour: 20, minute: 0, everyDays: 1 },
  grand: { id: "grand", name: "Großes Neon Lotto", short: "Alle 3 Tage", hour: 21, minute: 0, everyDays: 3 },
};

/** Ziehungen mit Termin und aktuellem Regelwerk (pick, pool, neon, price, classes). */
export const DRAWS = Object.fromEntries(Object.entries(SCHEDULE).map(([id, s]) => [id, { ...s, ...RULES[id][RULES_VERSION], r: RULES_VERSION }]));
export const DRAW_TYPES = Object.keys(DRAWS);

/** Regelwerk eines Typs in einer Version (Standard: aktuell). */
export function rulesFor(type, r = RULES_VERSION) {
  return RULES[type]?.[r] || null;
}
/** Version aus gespeicherten Daten: fehlt sie (V1.2), gilt Regelwerk 1. */
export function rulesVersionOf(x) {
  return x && Number.isInteger(x.r) && RULES.daily[x.r] ? x.r : 1;
}
/** Kurzbeschreibung, z. B. „4 aus 40“ oder „6 aus 49 + Neonzahl“. */
export function rulesLabel(rules) {
  return `${rules.pick} aus ${rules.pool}${rules.neon ? " + Neonzahl" : ""}`;
}
/** Höchste Gewinnklasse eines Regelwerks. */
export function topPrize(rules) {
  return Math.max(...rules.classes.map((c) => c.prize));
}

// ---------- Kombinatorik ----------

export function choose(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** Wahrscheinlichkeit für genau k Richtige bei „pick aus pool“. */
export function pMatches(pool, k, pick = 4) {
  return (choose(pick, k) * choose(pool - pick, pick - k)) / choose(pool, pick);
}

/** Wahrscheinlichkeit einer Gewinnklasse je Schein. */
export function pClass(rules, c) {
  const p = pMatches(rules.pool, c.k, rules.pick);
  if (!rules.neon || c.n === undefined) return p;
  return p * (c.n ? 1 / rules.neon : (rules.neon - 1) / rules.neon);
}

/** Anzahl gleich wahrscheinlicher Scheine (Kombinationen) eines Regelwerks. */
export function combinations(rules) {
  return choose(rules.pool, rules.pick) * (rules.neon || 1);
}

/** Wahrscheinlichkeit, mit einem Schein irgendeine Gewinnklasse zu treffen. */
export function pAnyWin(rules) {
  return rules.classes.reduce((s, c) => s + pClass(rules, c), 0);
}

/** Erwartete Rückzahlung je eingesetztem Credit (RTP). Typ-String oder Regelwerk. */
export function rtpOf(typeOrRules) {
  const rules = typeof typeOrRules === "string" ? rulesFor(typeOrRules) : typeOrRules;
  return rules.classes.reduce((s, c) => s + pClass(rules, c) * c.prize, 0) / rules.price;
}

/** Gewinnklasse für k Richtige und Neonzahl-Treffer (oder null). */
export function classFor(rules, k, neonHit) {
  return rules.classes.find((c) => c.k === k && (c.n === undefined || c.n === Boolean(neonHit))) || null;
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

/** Prüft eine Zahlenauswahl nach einem Regelwerk. Rückgabe: sortierte Zahlen oder null. */
export function validPick(rules, nums) {
  if (!rules || !Array.isArray(nums) || nums.length !== rules.pick) return null;
  const set = new Set();
  for (const n of nums) {
    if (!Number.isInteger(n) || n < 1 || n > rules.pool || set.has(n)) return null;
    set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}
/** Prüft eine Neonzahl (0 … neon−1). Ohne Neonzahl im Regelwerk: immer null. */
export function validNeon(rules, neon) {
  return rules?.neon && Number.isInteger(neon) && neon >= 0 && neon < rules.neon ? neon : null;
}
/** Zahlen nach dem aktuellen Regelwerk eines Typs. */
export function validNumbers(type, nums) {
  return validPick(rulesFor(type), nums);
}
/** Ganzer Schein: { nums, neon } oder null. */
export function validTicket(rules, nums, neon) {
  const clean = validPick(rules, nums);
  if (!clean) return null;
  if (!rules.neon) return { nums: clean, neon: null };
  const nz = validNeon(rules, neon);
  return nz === null ? null : { nums: clean, neon: nz };
}

/** Zieht `pick` verschiedene Zahlen aus 1..pool (in Ziehungsreihenfolge, Fisher–Yates). */
export function drawNumbers(pool, rnd = random, pick = 4) {
  const all = Array.from({ length: pool }, (_, i) => i + 1);
  const out = [];
  for (let i = 0; i < pick; i++) {
    const j = i + Math.floor(rnd() * (pool - i));
    [all[i], all[j]] = [all[j], all[i]];
    out.push(all[i]);
  }
  return out;
}

/** Komplette Ziehung nach einem Regelwerk: Zahlen und ggf. separat die Neonzahl. */
export function drawFor(rules, rnd = random) {
  const nums = drawNumbers(rules.pool, rnd, rules.pick);
  const neon = rules.neon ? Math.floor(rnd() * rules.neon) : null;
  return { nums, neon };
}

export function quickPick(type, rnd = random) {
  const rules = rulesFor(type);
  const t = drawFor(rules, rnd);
  return { nums: t.nums.sort((a, b) => a - b), neon: t.neon };
}

/**
 * Wertet Scheine gegen eine Ziehung aus.
 * @param {string|object} typeOrRules  Typ (aktuelles Regelwerk) oder Regelwerk
 * @param {number[]} drawn             gezogene Zahlen
 * @param {{id:string, nums:number[], neon?:number|null}[]} tickets
 * @param {number|null} [neon]         gezogene Neonzahl
 */
export function evaluate(typeOrRules, drawn, tickets, neon = null) {
  const rules = typeof typeOrRules === "string" ? rulesFor(typeOrRules) : typeOrRules;
  const set = new Set(drawn);
  let payout = 0;
  const results = tickets.map((t) => {
    const hits = t.nums.filter((n) => set.has(n));
    const neonHit = Boolean(rules.neon) && t.neon !== null && t.neon !== undefined && t.neon === neon;
    const c = classFor(rules, hits.length, neonHit);
    const prize = c ? c.prize : 0;
    payout += prize;
    return { id: t.id, nums: t.nums.slice(), neon: rules.neon ? t.neon : null, hits, k: hits.length, neonHit, cls: c ? c.id : null, label: c ? c.label : null, prize };
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
      if (clean.length >= MAX_TICKETS) break;
      const r = rulesVersionOf(t);
      const rules = rulesFor(info.type, r);
      const ok = validTicket(rules, t?.nums, t?.neon);
      if (!ok) continue;
      const ticket = { id: String(t.id || `t${clean.length}`).slice(0, 24), nums: ok.nums, at: Number.isFinite(t.at) ? t.at : 0, price: rules.price, r };
      if (rules.neon) ticket.neon = ok.neon;
      clean.push(ticket);
    }
    if (clean.length) out.tickets[id] = clean;
  }
  const draws = src.draws && typeof src.draws === "object" ? src.draws : {};
  for (const [id, dr] of Object.entries(draws)) {
    const info = parseDrawId(id);
    if (!info || !dr || typeof dr !== "object") continue;
    const r = rulesVersionOf(dr);
    const rules = rulesFor(info.type, r);
    const nums = Array.isArray(dr.nums) && validPick(rules, dr.nums) ? dr.nums.slice() : null;
    const neon = rules.neon ? validNeon(rules, dr.neon) : null;
    if (!nums || (rules.neon && neon === null)) continue; // beschädigt: lieber verwerfen als ein falsches Ergebnis zeigen
    const tickets = (Array.isArray(dr.tickets) ? dr.tickets : [])
      .map((t) => {
        const ok = validTicket(rules, t?.nums, t?.neon);
        return ok && { id: String(t?.id || "").slice(0, 24), nums: ok.nums, ...(rules.neon ? { neon: ok.neon } : {}) };
      })
      .filter(Boolean)
      .slice(0, MAX_TICKETS);
    const ev = evaluate(rules, nums, tickets, neon);
    out.draws[id] = {
      id,
      type: info.type,
      r,
      at: info.at,
      nums,
      neon,
      tickets,
      results: ev.results,
      stake: tickets.length * rules.price,
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
 * @param {object} o.economy        debit/credit/refund aus core/economy.js
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
     * @param {string} type
     * @param {number[]} nums
     * @param {number} [neon]  Neonzahl 0–9 (nur Großes Neon Lotto)
     */
    buy(type, nums, neon) {
      const def = DRAWS[type];
      if (!def) return { ok: false, reason: "Unbekannte Ziehung" };
      const clean = validPick(def, nums);
      if (!clean) return { ok: false, reason: `Wähle genau ${def.pick} verschiedene Zahlen von 1 bis ${def.pool}` };
      const nz = def.neon ? validNeon(def, neon) : null;
      if (def.neon && nz === null) return { ok: false, reason: `Wähle eine Neonzahl von 0 bis ${def.neon - 1}` };
      const draw = nextDraw(type, now());
      if (!draw) return { ok: false, reason: "Gerade keine Ziehung im Verkauf" };
      const list = ticketsFor(draw.id);
      if (list.length >= MAX_TICKETS) return { ok: false, reason: `Höchstens ${MAX_TICKETS} Scheine pro Ziehung` };
      const key = (t) => `${t.nums.join(",")}|${t.neon ?? ""}`;
      if (list.some((t) => key(t) === key({ nums: clean, neon: nz }))) return { ok: false, reason: "Diesen Schein hast du für diese Ziehung schon" };
      if (!economy.debit("lotto", def.price, "lotto")) return { ok: false, reason: economy.balance < def.price ? "Nicht genug Credits" : "Gerade nicht möglich" };
      const lotto = L();
      lotto.seq++;
      const ticket = { id: `t${lotto.seq}`, nums: clean, at: now(), price: def.price, r: RULES_VERSION };
      if (def.neon) ticket.neon = nz;
      (lotto.tickets[draw.id] ||= []).push(ticket);
      saveNow();
      emit("lotto:ticket", { drawId: draw.id, type });
      return { ok: true, ticket, draw };
    },
    /**
     * Erstattet noch nicht ausgeloste Scheine eines älteren Regelwerks (V1.2:
     * 4 aus 20 / 4 aus 24) genau einmal: Der Schein verschwindet, der Einsatz
     * wird zurückgebucht (zählt nicht als Gewinn). Rückgabe: erstattete Credits.
     */
    refundLegacy() {
      const lotto = L();
      let count = 0;
      let amount = 0;
      for (const [id, list] of Object.entries(lotto.tickets)) {
        const keep = list.filter((t) => rulesVersionOf(t) === RULES_VERSION);
        for (const t of list) {
          if (rulesVersionOf(t) === RULES_VERSION) continue;
          count++;
          amount += t.price;
        }
        if (keep.length) lotto.tickets[id] = keep;
        else delete lotto.tickets[id];
      }
      if (!count) return 0;
      economy.refund("lotto", amount, "lotto:refund");
      saveNow();
      inbox?.add({
        id: `lotto:refund-v${RULES_VERSION}`,
        type: "lotto",
        ts: now(),
        title: "Neon Lotto – neue Regeln",
        body: `Das Lotto spielt jetzt täglich 4 aus 40 und im Großen Neon Lotto 6 aus 49 + Neonzahl. ${count === 1 ? "Dein offener Schein" : `Deine ${count} offenen Scheine`} nach den alten Regeln ${count === 1 ? "wurde" : "wurden"} vollständig erstattet: ${amount.toLocaleString("de-DE")} Credits.`,
      });
      emit("lotto:refund", { count, amount });
      return amount;
    },
    /** Lost alle fälligen Ziehungen mit eigenen Scheinen aus (genau einmal). Rückgabe: neu ausgeloste Ziehungen. */
    realizeDue() {
      api.refundLegacy();
      const lotto = L();
      const t = now();
      const fresh = [];
      const due = Object.keys(lotto.tickets)
        .map(parseDrawId)
        .filter((i) => i && i.at <= t && !lotto.draws[i.id])
        .sort((a, b) => a.at - b.at);
      for (const info of due) {
        const rules = rulesFor(info.type);
        const tickets = lotto.tickets[info.id].map((x) => ({ id: x.id, nums: x.nums.slice(), ...(rules.neon ? { neon: x.neon } : {}) }));
        const { nums, neon } = drawFor(rules, rnd);
        const ev = evaluate(rules, nums, tickets, neon);
        const d = {
          id: info.id,
          type: info.type,
          r: RULES_VERSION,
          at: info.at,
          nums,
          neon,
          tickets,
          results: ev.results,
          stake: tickets.length * rules.price,
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
