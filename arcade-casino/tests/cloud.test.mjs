// Cloud-Spielstand: Entscheidung beim Start, Sperren-Merge, gebündeltes Hochladen.
import test from "node:test";
import assert from "node:assert/strict";

import { decideBoot, mergeControl, createUploader, hasProgress, hasStoredSession, CLOUD_GAME_ID } from "../js/core/cloud.js";
import { defaultState, sanitizeState, sanitizeCloudMeta } from "../js/core/state.js";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

function st({ owner = null, savedAt = 0, rounds = 0, balance = 1000 } = {}) {
  const s = defaultState(1);
  s.cloud = { owner, savedAt };
  s.stats.rounds = rounds;
  s.balance = balance;
  return sanitizeState(s);
}

test("Cloud-Metadaten: nur gültige Konto-IDs, Zeitstempel ganzzahlig, überleben das Bereinigen", () => {
  assert.deepEqual(sanitizeCloudMeta({ owner: U1.toUpperCase(), savedAt: 5.7 }), { owner: U1, savedAt: 5 });
  assert.deepEqual(sanitizeCloudMeta({ owner: "admin' or 1=1", savedAt: -3 }), { owner: null, savedAt: 0 });
  assert.deepEqual(sanitizeState({ v: 3, balance: 5, cloud: { owner: U1, savedAt: 99 } }).cloud, { owner: U1, savedAt: 99 });
  assert.deepEqual(sanitizeState(null).cloud, { owner: null, savedAt: 0 }, "V1.2-Spielstand ohne Feld");
});

test("Start: gleiches Konto → neuerer Stand gewinnt", () => {
  assert.equal(decideBoot(st({ owner: U1, savedAt: 200, rounds: 5 }), st({ owner: U1, savedAt: 100, rounds: 9 }), U1).use, "local");
  assert.equal(decideBoot(st({ owner: U1, savedAt: 100, rounds: 5 }), st({ owner: U1, savedAt: 200, rounds: 9 }), U1).use, "cloud");
});

test("Start: Fortschritt eines Kontos wird nie in ein anderes Konto kopiert", () => {
  const fremd = st({ owner: U2, savedAt: 999, rounds: 50, balance: 99999 });
  assert.equal(decideBoot(fremd, null, U1).use, "fresh", "anderes Konto, Cloud leer → neu anfangen");
  assert.equal(decideBoot(fremd, st({ owner: U1, savedAt: 1, rounds: 1 }), U1).use, "cloud", "anderes Konto, Cloud vorhanden → Cloud");
});

test("Start: ohne Anmeldung gespielt + Konto", () => {
  const anonymLeer = st();
  const anonymMitFortschritt = st({ rounds: 12, balance: 3000 });
  const cloudMitFortschritt = st({ owner: U1, savedAt: 5, rounds: 40 });
  const cloudLeer = st({ owner: U1, savedAt: 5 });
  assert.equal(decideBoot(anonymMitFortschritt, null, U1).use, "local", "erste Anmeldung: lokaler Stand wird hochgeladen");
  assert.equal(decideBoot(anonymLeer, cloudMitFortschritt, U1).use, "cloud");
  assert.equal(decideBoot(anonymMitFortschritt, cloudLeer, U1).use, "local");
  assert.equal(decideBoot(anonymMitFortschritt, cloudMitFortschritt, U1).use, "ask", "beide mit Fortschritt → fragen");
  assert.equal(hasProgress(anonymLeer), false);
  assert.equal(hasProgress(anonymMitFortschritt), true);
});

test("Spielkontrolle: Abgleich verkürzt nie eine Pause oder Auszeit", () => {
  const lokal = { pauseUntil: 0, excludeUntil: 5000, remindMin: 30, lastBlockStart: 10 };
  const cloud = { pauseUntil: 9000, excludeUntil: 1000, remindMin: 90, lastBlockStart: 20 };
  assert.deepEqual(mergeControl(lokal, cloud), { pauseUntil: 9000, excludeUntil: 5000, remindMin: 30, lastBlockStart: 20 });
  assert.deepEqual(mergeControl(cloud, lokal), { pauseUntil: 9000, excludeUntil: 5000, remindMin: 90, lastBlockStart: 20 });
  assert.deepEqual(mergeControl({ pauseUntil: "kaputt" }, null).pauseUntil, 0);
});

test("Sitzungserkennung: nur Supabase-Sitzungsschlüssel zählen, rein lokal", () => {
  const fake = (keys) => ({ length: keys.length, key: (i) => keys[i] });
  assert.equal(hasStoredSession(fake(["neonpalast.save.v1", "snakeCoins"])), false);
  assert.equal(hasStoredSession(fake(["sb-hnknmdxxkmbtqluiovoe-auth-token"])), true);
  assert.equal(hasStoredSession({ get length() { throw new Error("gesperrt"); } }), false);
  assert.equal(CLOUD_GAME_ID, "arcade-casino", "außerhalb des Testbereichs");
});

test("Hochladen: gebündelt, immer der neueste Stand, nie zwei Anfragen gleichzeitig", async () => {
  let state = { n: 0 };
  const calls = [];
  let release;
  const api = {
    save: (id, snap) => {
      calls.push({ id, n: snap.n });
      return new Promise((r) => (release = () => r(true)));
    },
  };
  const up = createUploader({ api, getState: () => state, debounce: 20, maxWait: 60 });
  state = { n: 1 };
  up.schedule();
  state = { n: 2 };
  up.schedule();
  await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(calls, [{ id: "arcade-casino", n: 2 }], "zwei Änderungen → eine Anfrage mit dem neuesten Stand");
  state = { n: 3 };
  up.schedule();
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(calls.length, 1, "keine zweite Anfrage, solange die erste läuft");
  release();
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(calls.map((c) => c.n), [2, 3], "danach der neueste Stand");
  release();
  await new Promise((r) => setTimeout(r, 5));
});

test("Hochladen: spätestens nach maxWait, auch bei Dauerspiel; fremder Tab lädt nie hoch", async () => {
  const calls = [];
  const api = { save: async () => (calls.push(1), true) };
  const up = createUploader({ api, getState: () => ({}), debounce: 30, maxWait: 70 });
  const t0 = Date.now();
  while (Date.now() - t0 < 120 && !calls.length) {
    up.schedule(); // ständig neue Änderungen
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.equal(calls.length, 1, "trotz Dauer-Änderungen hochgeladen");
  assert.ok(Date.now() - t0 < 120);
  const blocked = [];
  const up2 = createUploader({ api: { save: async () => (blocked.push(1), true) }, getState: () => ({}), canWrite: () => false, debounce: 5 });
  up2.schedule();
  await up2.flush();
  assert.equal(blocked.length, 0);
});

test("Sicherung: nur Stände mit Fortschritt, nur im selben Konto wiederherstellbar", async () => {
  const { makeBackup, validBackup, canRestore } = await import("../js/core/cloud.js");
  assert.equal(makeBackup(st(), "x"), null, "leerer Stand wird nicht gesichert");
  const anonym = makeBackup(st({ rounds: 5, balance: 36 }), "beim Abgleich nicht gewählt", 1000);
  assert.equal(anonym.owner, null);
  assert.equal(anonym.state.balance, 36);
  assert.equal(canRestore(anonym, U1), true, "ohne Konto entstanden → im angemeldeten Konto erlaubt");
  const vonU2 = makeBackup(st({ owner: U2, rounds: 5, balance: 99999 }), "Stand eines anderen Kontos");
  assert.equal(canRestore(vonU2, U1), false, "nie über Kontogrenzen");
  assert.equal(canRestore(vonU2, U2), true);
  assert.equal(canRestore(vonU2, null), false, "abgemeldet: Konto-Sicherung nicht anbieten");
  assert.equal(validBackup({ bv: 1, at: "gestern", state: {} }), null, "kaputter Zeitstempel");
  assert.equal(validBackup({ bv: 2, at: 1, state: {} }), null, "unbekannte Version");
  assert.equal(validBackup(null), null);
});
