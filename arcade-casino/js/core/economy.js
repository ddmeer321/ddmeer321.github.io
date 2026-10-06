// Virtuelle Wirtschaft. Ausschließlich fiktives Spielgeld („Credits“) –
// keine Käufe, keine Auszahlung, kein realer Wert.
//
// Grundregeln gegen triviale Exploits innerhalb der normalen Spiellogik:
//  * Beträge müssen sichere, positive Ganzzahlen sein (kein NaN, kein Negativ, keine Brüche).
//  * Ein Einsatz wird beim Start einer Runde SOFORT abgebucht (synchron), bevor
//    irgendeine Animation läuft. Doppelklicks finden danach kein Guthaben mehr vor
//    bzw. werden von den Spielen über ihren Rundenstatus abgewiesen.
//  * Jede Runde hat ein Ticket. settle() zahlt pro Ticket genau einmal aus;
//    ein zweiter Aufruf wird ignoriert.

import { MAX_BALANCE } from "./state.js";

export function isValidAmount(n) {
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0;
}

export function createEconomy({ getState, save = () => {}, emit = () => {}, guard = () => null }) {
  let seq = 0;
  const open = new Map();

  function setBalance(next, delta, reason) {
    const s = getState();
    const clamped = Math.max(0, Math.min(MAX_BALANCE, Math.trunc(next)));
    const prev = s.balance;
    s.balance = clamped;
    save();
    emit("balance", { balance: clamped, prev, delta: clamped - prev, reason });
  }

  function statFor(gameId) {
    const s = getState();
    if (!s.stats.perGame[gameId]) s.stats.perGame[gameId] = { rounds: 0, wagered: 0, won: 0, biggestWin: 0 };
    return s.stats.perGame[gameId];
  }

  const api = {
    get balance() {
      return getState().balance;
    },

    canAfford(amount) {
      return isValidAmount(amount) && amount <= getState().balance;
    },

    /** Prüft einen Einsatz gegen Limits und Guthaben. */
    validateBet(amount, { min = 1, max = MAX_BALANCE } = {}) {
      const blocked = guard();
      if (blocked) return { ok: false, reason: blocked };
      if (!isValidAmount(amount)) return { ok: false, reason: "Ungültiger Einsatz" };
      if (amount < min) return { ok: false, reason: `Mindesteinsatz ${min}` };
      if (amount > max) return { ok: false, reason: `Höchsteinsatz ${max}` };
      if (amount > getState().balance) return { ok: false, reason: "Nicht genug Credits" };
      return { ok: true };
    },

    /**
     * Startet eine Runde und bucht den Einsatz ab.
     * @returns {object|null} Ticket oder null, wenn ungültig.
     */
    placeBet(gameId, amount, limits) {
      const check = api.validateBet(amount, limits);
      if (!check.ok) return null;
      const ticket = { id: ++seq, gameId, stake: amount, settled: false, payout: 0 };
      open.set(ticket.id, ticket);
      setBalance(getState().balance - amount, -amount, "bet");
      return ticket;
    },

    /** Zusätzlicher Einsatz innerhalb derselben Runde (Double Down, Split). */
    addStake(ticket, amount) {
      if (!ticket || ticket.settled || !open.has(ticket.id)) return false;
      if (guard()) return false;
      if (!api.canAfford(amount)) return false;
      ticket.stake += amount;
      setBalance(getState().balance - amount, -amount, "bet");
      return true;
    },

    /**
     * Beendet eine Runde und zahlt `payout` (Gesamtrückzahlung inkl. Einsatz) aus.
     * Zweiter Aufruf mit demselben Ticket: wirkungslos.
     */
    settle(ticket, payout) {
      if (!ticket || ticket.settled || !open.has(ticket.id)) return null;
      const pay = typeof payout === "number" && Number.isFinite(payout) ? Math.max(0, Math.floor(payout)) : 0;
      ticket.settled = true;
      ticket.payout = pay;
      open.delete(ticket.id);

      const s = getState();
      const g = statFor(ticket.gameId);
      s.stats.rounds++;
      s.stats.wagered += ticket.stake;
      s.stats.won += pay;
      g.rounds++;
      g.wagered += ticket.stake;
      g.won += pay;
      const net = pay - ticket.stake;
      if (net > s.stats.biggestWin) s.stats.biggestWin = net;
      if (net > g.biggestWin) g.biggestWin = net;

      if (pay > 0) setBalance(s.balance + pay, pay, "payout");
      else save();
      emit("settle", { gameId: ticket.gameId, stake: ticket.stake, payout: pay, net });
      return { payout: pay, net };
    },

    /** Direkte Abbuchung für Automaten ohne Runden (Coin Pusher, Startgebühr). */
    debit(gameId, amount, reason = "debit") {
      if (guard()) return false;
      if (!api.canAfford(amount)) return false;
      const s = getState();
      const g = statFor(gameId);
      s.stats.wagered += amount;
      g.wagered += amount;
      setBalance(s.balance - amount, -amount, reason);
      emit("debit", { gameId, amount });
      return true;
    },

    /** Direkte Gutschrift (Coin Pusher, Skill-Preise, Boni). */
    credit(gameId, amount, reason = "credit") {
      if (!isValidAmount(amount)) return false;
      const s = getState();
      if (gameId) {
        const g = statFor(gameId);
        s.stats.won += amount;
        g.won += amount;
        if (amount > g.biggestWin) g.biggestWin = amount;
      } else {
        // Boni (Tagesbonus, Level, Challenges, Nachschub) getrennt zählen:
        // Guthaben = Start − Einsätze + Auszahlungen + Boni
        s.stats.bonus = (s.stats.bonus || 0) + amount;
      }
      setBalance(s.balance + amount, amount, reason);
      emit("credit", { gameId, amount, reason });
      return true;
    },

    /** Zählt eine abgeschlossene Runde eines Automaten ohne Ticket (Statistik/XP). */
    countRound(gameId) {
      const s = getState();
      s.stats.rounds++;
      statFor(gameId).rounds++;
      save();
    },

    /** Offene Tickets (z. B. wenn ein Spiel mitten in der Runde verlassen wird). */
    openTickets() {
      return [...open.values()];
    },

    /** Bricht offene Runden ab: Einsätze verfallen (wie das Verlassen eines Tisches). */
    forfeitOpen(gameId) {
      for (const t of [...open.values()]) {
        if (!gameId || t.gameId === gameId) api.settle(t, 0);
      }
    },
  };
  return api;
}
