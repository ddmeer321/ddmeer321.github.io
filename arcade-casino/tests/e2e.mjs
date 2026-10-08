// End-to-End-Test im echten Browser (Playwright/Chromium).
// Aufruf: node tests/e2e.mjs   (Playwright muss installiert sein, z. B. global)
// Startet einen eigenen kleinen Static-Server auf einem freien Port.
//
// V1.1: Gewartet wird auf Zustände statt auf feste Zeiten. Jedes Spiel meldet
// seine Phase als data-phase am Spielcontainer (.game-root), z. B. „spin“ →
// „result“ beim Roulette. Feste Pausen gibt es nur noch dort, wo echte
// Physik/Gesten im Spiel ablaufen (Basketball-Wurf) – und auch dort nur kurz.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (err, buf) => {
    if (err) return res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(buf);
  });
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/`;

const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);
const browser = await chromium.launch({ executablePath: exe });

let failures = 0;
let passes = 0;
let shotPage = null; // Seite für ein Bildschirmfoto bei Fehlschlag (E2E_SHOTS=Verzeichnis)
const ONLY = process.env.E2E_ONLY ? new RegExp(process.env.E2E_ONLY, "i") : null;
async function check(name, fn) {
  if (ONLY && !ONLY.test(name)) return;
  const t0 = Date.now();
  try {
    await fn();
    passes++;
    console.log(`  ✔ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (err) {
    failures++;
    console.log(`  ✘ ${name}\n      ${err.message.split("\n")[0]}`);
    if (process.env.E2E_SHOTS && shotPage) {
      const file = path.join(process.env.E2E_SHOTS, `fail-${failures}.png`);
      await shotPage.screenshot({ path: file }).catch(() => {});
      console.log(`      Bildschirmfoto: ${file}`);
    }
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  small: { viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  landscape: { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  tablet: { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1366, height: 820 } },
  wide: { viewport: { width: 1440, height: 900 } },
};

async function newPage({ mobile = true, size, init, clock = false, url = BASE, waitHub = true } = {}) {
  const ctx = await browser.newContext(VIEWPORTS[size || (mobile ? "phone" : "desktop")]);
  ctx.setDefaultTimeout(10000); // Folgefehler sollen nicht minutenlang blockieren
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  shotPage = page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  if (clock) await page.clock.install();
  await page.goto(url);
  if (waitHub) await page.waitForSelector(".machine");
  return { page, ctx, errors };
}

const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__neonpalast.getState())));
const root = (id) => `.game-root[data-game="${id}"]`;
/** Wartet, bis das Spiel eine der Phasen meldet. */
const phase = (page, id, phases, timeout = 15000) =>
  page.waitForFunction(
    ([sel, list]) => list.includes(document.querySelector(sel)?.dataset.phase),
    [root(id), [].concat(phases)],
    { timeout, polling: 50 }
  );
const currentPhase = (page, id) => page.evaluate((sel) => document.querySelector(sel)?.dataset.phase, root(id));
/** Bilanz-Invariante: Guthaben = Start − Einsätze + Auszahlungen + Boni − Ausgaben (Jukebox/Songs). */
async function assertLedger(page, start = 1000) {
  const s = await state(page);
  const extra = (s.stats.bonus || 0) - (s.stats.spent || 0);
  assert(s.balance === start - s.stats.wagered + s.stats.won + extra, `Bilanz inkonsistent: ${s.balance} ≠ ${start} − ${s.stats.wagered} + ${s.stats.won} + ${extra}`);
  return s;
}
async function openGame(page, id) {
  await page.goto(BASE + `#/play/${id}`);
  await page.waitForFunction((sel) => document.querySelector(sel)?.dataset.phase, root(id), { timeout: 8000 }).catch(() => {});
  await page.waitForSelector(root(id), { timeout: 8000 });
}
/** Spult die installierte Playwright-Uhr in kleinen Schritten vor, bis die Bedingung gilt (keine feste Wartezeit). */
async function runClockUntil(page, fn, arg, { step = 250, max = 60000 } = {}) {
  for (let t = 0; t <= max; t += step) {
    if (await page.evaluate(fn, arg)) return t;
    await page.clock.runFor(step);
  }
  throw new Error("Bedingung trat nicht ein");
}
const phaseIs = ([sel, list]) => list.includes(document.querySelector(sel)?.dataset.phase);
const noHorizontalScroll = (page) => page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1);

const MACHINES = ["slots-fruit", "slots-seven", "slots-cosmo", "blackjack", "roulette", "horses", "plinko", "grabber", "coinpusher", "hoops", "stacker", "cyclone"];
const GAMES = [...MACHINES, "lotto", "scratch"];

console.log("Neonpalast E2E (V1.2.1)");

// ---------- Hub & Navigation ----------
{
  const { page, ctx, errors } = await newPage();
  await check("Hub lädt mit allen 12 Automaten, Lotto-Studio, Rubbellos-Tisch und Jukebox", async () => {
    const n = await page.locator(".machine[data-game]").count();
    assert(n === GAMES.length, `erwartet ${GAMES.length}, gefunden ${n}`);
    assert(await page.locator('[data-fixture="jukebox"]').isVisible(), "Jukebox fehlt");
    assert(await page.locator("#hud-inbox").isVisible(), "Posteingang fehlt");
    assert(await page.locator(".hall-sign h1").isVisible(), "Leuchtschild fehlt");
    assert(await page.locator("#hud-control").isVisible(), "Spielkontrolle-Knopf fehlt");
  });
  for (const id of GAMES) {
    await check(`„${id}“ öffnet per Touch, meldet eine Phase, „Zurück“ führt in die Halle`, async () => {
      await page.locator(`.machine[data-game="${id}"]`).scrollIntoViewIfNeeded();
      await page.locator(`.machine[data-game="${id}"]`).tap();
      await page.waitForFunction((sel) => document.querySelector(sel)?.dataset.phase, root(id), { timeout: 8000 });
      assert(page.url().includes(`#/play/${id}`), "Route falsch");
      assert(await noHorizontalScroll(page), "horizontaler Scrollbalken");
      await page.locator('button[aria-label="Zurück zur Halle"]').tap();
      await page.waitForSelector("#view-hub.is-active", { timeout: 3000 });
      assert(!page.url().includes("/play/"), "nicht zurück in der Halle");
    });
  }
  await check("Browser-Zurück funktioniert ebenfalls", async () => {
    await page.locator('.machine[data-game="plinko"]').scrollIntoViewIfNeeded();
    await page.locator('.machine[data-game="plinko"]').tap();
    await phase(page, "plinko", "idle");
    await page.goBack();
    await page.waitForSelector("#view-hub.is-active");
  });
  await check("Tages-Challenges werden in der Halle angezeigt", async () => {
    const s = await state(page);
    assert(s.challenges.items.length === 3, `Challenges: ${s.challenges.items.length}`);
    assert(await page.locator(".challenge-list .challenge").count() >= 3, "Challenge-Karte fehlt");
  });
  await check("Keine Konsolenfehler in Halle/Navigation", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Blackjack ----------
{
  const { page, ctx, errors } = await newPage({ mobile: false });
  await openGame(page, "blackjack");
  /** Wartet, bis die Runde vorbei ist oder „Halten“ wirklich bedienbar ist (nicht während des Austeilens). */
  const bjReady = () =>
    page.waitForFunction(
      (sel) => {
        const r = document.querySelector(sel);
        if (!r) return false;
        if (r.dataset.phase === "result") return true;
        const b = [...r.querySelectorAll(".bj-actions button")].find((x) => x.textContent.includes("Halten"));
        return r.dataset.phase === "play" && b && !b.disabled;
      },
      root("blackjack"),
      { timeout: 10000, polling: 50 }
    );
  async function playHand() {
    await page.locator(".bj-betbar .btn-primary").click();
    for (let i = 0; i < 6; i++) {
      await bjReady();
      if ((await currentPhase(page, "blackjack")) === "result") return;
      await page.locator(".bj-actions button:has-text('Halten')").click();
    }
    await phase(page, "blackjack", "result", 8000);
  }
  await check("Blackjack: drei vollständige Runden, Bilanz stimmt mit Statistik", async () => {
    for (let round = 0; round < 3; round++) {
      await playHand();
      const s = await assertLedger(page);
      assert(s.stats.perGame.blackjack.rounds === round + 1, "Runde nicht gezählt");
    }
  });
  await check("Blackjack: Einsatzstufen bis 1.000 (V1.1-Limit)", async () => {
    await page.evaluate(() => (window.__neonpalast.getState().balance = 50000));
    for (let i = 0; i < 15; i++) await page.locator('button[aria-label="Einsatz erhöhen"]').click({ force: true }).catch(() => {});
    const v = (await page.locator(".bet-value strong").textContent()).replace(/\D/g, "");
    assert(v === "1000", `Maximum ${v}`);
    await page.evaluate(() => (window.__neonpalast.getState().balance = 1000 - window.__neonpalast.getState().stats.wagered + window.__neonpalast.getState().stats.won));
  });
  await check("Blackjack: Tastatur (Enter austeilen, S halten)", async () => {
    for (let i = 0; i < 15; i++) await page.locator('button[aria-label="Einsatz verringern"]').click({ force: true }).catch(() => {});
    await page.keyboard.press("Enter");
    for (let i = 0; i < 6; i++) {
      await bjReady();
      if ((await currentPhase(page, "blackjack")) === "result") break;
      await page.keyboard.press("s");
    }
    await phase(page, "blackjack", "result", 8000);
  });
  await check("Ungültiger Einsatz (zu wenig Guthaben) wird verhindert", async () => {
    await page.evaluate(() => (window.__neonpalast.getState().balance = 5));
    await page.locator(".bj-betbar .btn-primary").click();
    await page.waitForSelector(".toast", { timeout: 2000 });
    assert((await state(page)).balance === 5, "Guthaben verändert");
    assert((await currentPhase(page, "blackjack")) !== "play", "Runde trotzdem gestartet");
  });
  await check("Keine Konsolenfehler (Blackjack)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Roulette ----------
{
  const { page, ctx, errors } = await newPage();
  await openGame(page, "roulette");
  await check("Roulette: Drehen ohne Einsatz ist gesperrt", async () => {
    assert(await page.locator(".rl-ctrl .btn-lg").isDisabled(), "Drehen nicht gesperrt");
  });
  await check("Roulette zahlt korrekt aus (3 Runden, Warten auf Phase „result“)", async () => {
    for (let r = 0; r < 3; r++) {
      const keys = ["red", "n:17", "dozen:2", "odd"];
      for (const k of keys) await page.locator(`.rl-cell[data-key="${k}"]`).tap();
      const before = (await state(page)).balance;
      await page.locator(".rl-ctrl .btn-lg").tap();
      await phase(page, "roulette", "spin", 3000);
      await phase(page, "roulette", "result", 20000);
      const s = await state(page);
      const n = s.games.roulette.history[0];
      const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n);
      let expected = -40;
      if (n !== 0 && red) expected += 20;
      if (n === 17) expected += 360;
      if (n >= 13 && n <= 24) expected += 30;
      if (n % 2 === 1) expected += 20;
      assert(s.balance - before === expected, `Zahl ${n}: erwartet ${expected}, war ${s.balance - before}`);
      assert(Number(await page.locator(".rl-result").textContent()) === n, "angezeigte Zahl ≠ ausgewertete Zahl");
      // Gewonnene Chips bleiben liegen → wegräumen; ging alles verloren, ist „Löschen“ zu Recht gesperrt
      const clear = page.locator(".rl-ctrl button:has-text('✕')");
      if (await clear.isEnabled()) await clear.tap();
    }
  });
  await check("Roulette: höchstens 100 pro Einzelzahl", async () => {
    await page.locator('.chip-btn[aria-label="Chip 100"]').tap();
    await page.locator('.rl-cell[data-key="n:5"]').tap();
    await page.locator('.rl-cell[data-key="n:5"]').tap();
    await page.waitForSelector(".toast:has-text('Einzelzahl')", { timeout: 2000 });
    const chip = (await page.locator('.rl-cell[data-key="n:5"] .rl-chip').textContent()).trim();
    assert(chip === "100", `Chip auf 5: ${chip}`);
    await page.locator(".rl-ctrl button:has-text('✕')").tap();
  });
  await check("Keine Konsolenfehler (Roulette)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Slots ----------
{
  const { page, ctx, errors } = await newPage({ mobile: false });
  await openGame(page, "slots-fruit");
  await check("Slots: Einsatz kann nicht unter das Minimum fallen", async () => {
    for (let i = 0; i < 10; i++) await page.locator('button[aria-label="Einsatz verringern"]').click({ force: true }).catch(() => {});
    const v = await page.locator(".bet-value strong").textContent();
    assert(v.trim() === "5", `Minimum ${v}`);
  });
  await check("Slots: Gewinne und Verluste kommen vor, Bilanz stimmt", async () => {
    let wins = 0;
    let losses = 0;
    await page.evaluate(() => document.activeElement?.blur());
    for (let i = 0; i < 60 && (wins === 0 || losses === 0); i++) {
      const before = (await state(page)).stats.perGame["slots-fruit"]?.won || 0;
      await page.keyboard.press("Space");
      await phase(page, "slots-fruit", "spinning", 3000);
      await page.keyboard.press("Space"); // Schnellstopp
      await phase(page, "slots-fruit", "idle", 6000);
      const after = (await state(page)).stats.perGame["slots-fruit"].won;
      if (after > before) wins++;
      else losses++;
    }
    assert(wins > 0 && losses > 0, `wins ${wins} losses ${losses}`);
    await assertLedger(page);
  });
  await check("Spielstand übersteht Neuladen", async () => {
    await page.evaluate(() => window.__neonpalast.saveNow());
    const before = await state(page);
    await page.reload();
    await phase(page, "slots-fruit", "idle");
    const after = await state(page);
    assert(after.balance === before.balance, `${before.balance} → ${after.balance}`);
    assert(after.stats.rounds === before.stats.rounds, "Statistik verloren");
  });
  await check("Goldene Sieben: Einsatz höchstens 50 (V1.1)", async () => {
    await openGame(page, "slots-seven");
    for (let i = 0; i < 10; i++) await page.locator('button[aria-label="Einsatz erhöhen"]').click({ force: true }).catch(() => {});
    const v = (await page.locator(".bet-value strong").textContent()).trim();
    assert(v === "50", `Maximum ${v}`);
  });
  await check("Keine Konsolenfehler (Slots)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Plinko ----------
{
  const { page, ctx, errors } = await newPage();
  await openGame(page, "plinko");
  await check("Plinko: eine Kugel fällt durch die Pins und wird ausgewertet", async () => {
    await page.locator(".game-controls .btn-primary:has-text('Kugel')").tap();
    await phase(page, "plinko", "dropping", 3000);
    await phase(page, "plinko", "idle", 15000);
    const s = await assertLedger(page);
    assert(s.stats.perGame.plinko.rounds === 1, "Kugel nicht gezählt");
    assert(await page.locator(".plinko-history > *").count() >= 1, "Trefferhistorie leer");
  });
  await check("Plinko: Multi-Drop (×10) und Risikowechsel, Bilanz stimmt", async () => {
    await page.locator('.segmented button[data-risk="high"]').tap();
    await page.locator(".game-controls .btn-gold").tap();
    await phase(page, "plinko", "dropping", 3000);
    await phase(page, "plinko", "idle", 30000);
    const s = await assertLedger(page);
    assert(s.stats.perGame.plinko.rounds === 11, `Runden ${s.stats.perGame.plinko.rounds}`);
  });
  await check("Keine Konsolenfehler (Plinko)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Münzgreifer ----------
{
  const { page, ctx, errors } = await newPage();
  await openGame(page, "grabber");
  await check("Münzgreifer: Position wählen, greifen, Auszahlung über den Schacht", async () => {
    for (let i = 0; i < 4; i++) await page.locator('button[aria-label="Greifer nach rechts"]').tap();
    await page.locator(".game-controls .btn-gold:has-text('Greifen')").tap();
    await phase(page, "grabber", ["grabbing", "down"], 3000);
    await phase(page, "grabber", "aim", 25000);
    const s = await assertLedger(page);
    assert(s.stats.perGame.grabber.rounds === 1, "Griff nicht gezählt");
    assert(typeof s.games.grabber?.clawX === "number", "Greiferposition nicht gespeichert");
  });
  await check("Münzgreifer: Haufen bleibt nach Neuladen erhalten", async () => {
    await page.evaluate(() => window.__neonpalast.saveNow());
    const before = (await state(page)).games.grabber;
    await page.reload();
    await phase(page, "grabber", "aim");
    const after = (await state(page)).games.grabber;
    assert(JSON.stringify(Object.keys(after)) === JSON.stringify(Object.keys(before)), "Daten verändert");
  });
  await check("Keine Konsolenfehler (Münzgreifer)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Pferderennen ----------
{
  const { page, ctx, errors } = await newPage();
  await openGame(page, "horses");
  await check("Neon Derby: Pferd wählen, Rennen läuft 10–20 s, Sieger = Auszahlung", async () => {
    await page.waitForSelector(".horse-row:not([disabled])", { timeout: 8000 });
    await page.locator(".horse-row").nth(2).tap();
    const odds = await page.locator(".horse-row").nth(2).getAttribute("data-odds");
    const before = (await state(page)).balance;
    const bet = Number((await page.locator(".bet-value strong").textContent()).replace(/\D/g, ""));
    const t0 = Date.now();
    await page.locator(".game-controls .btn-primary:has-text('Rennen starten')").tap();
    await phase(page, "horses", "race", 3000);
    await phase(page, "horses", "result", 30000);
    const secs = (Date.now() - t0) / 1000;
    assert(secs > 8 && secs < 26, `Renndauer ${secs.toFixed(1)} s`);
    const s = await assertLedger(page);
    const last = s.games.horses.history[0];
    const delta = s.balance - before;
    if (last.no === 3) assert(delta === Math.floor(bet * Number(odds)) - bet, `Sieg: Δ ${delta}, Quote ${odds}`);
    else assert(delta === -bet, `Niederlage: Δ ${delta}`);
  });
  await check("Keine Konsolenfehler (Neon Derby)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Lichtwirbel ----------
{
  const { page, ctx, errors } = await newPage();
  await openGame(page, "cyclone");
  await check("Lichtwirbel: fünf Stufen spielen, Ergebnis wird abgerechnet", async () => {
    await page.locator(".game-controls .btn-primary").tap();
    for (let i = 0; i < 12; i++) {
      await phase(page, "cyclone", ["running", "result"], 8000);
      if ((await currentPhase(page, "cyclone")) === "result") break;
      await page.locator(".game-controls .btn-primary").tap();
      await phase(page, "cyclone", ["between", "result", "ready"], 4000);
    }
    await phase(page, "cyclone", "result", 8000);
    const s = await assertLedger(page);
    assert(s.stats.perGame.cyclone.rounds === 1, "Runde nicht gezählt");
  });
  await check("Keine Konsolenfehler (Lichtwirbel)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Turmbau ----------
{
  const { page, ctx, errors } = await newPage();
  await openGame(page, "stacker");
  await check("Turmbau: Runde bis zum Ende, Abrechnung erfolgt genau einmal", async () => {
    await page.locator(".arcade-overlay .btn-primary").tap();
    await phase(page, "stacker", "play", 3000);
    for (let i = 0; i < 20; i++) {
      const p = await currentPhase(page, "stacker");
      if (p === "over" || p === "menu") break;
      if (p === "choice") {
        await page.locator(".arcade-overlay .btn-gold").tap();
        break;
      }
      await page.locator(".game-controls .btn-primary").tap();
      await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => setTimeout(() => r(true), 60))));
    }
    await phase(page, "stacker", ["over", "menu"], 5000);
    const s = await assertLedger(page);
    assert(s.stats.perGame.stacker.rounds === 1, "Runde nicht gezählt");
  });
  await check("Keine Konsolenfehler (Turmbau)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Münzkaskade ----------
{
  const { page, ctx, errors } = await newPage();
  await openGame(page, "coinpusher");
  await check("Münzkaskade: Münzen fallen über die Kante und werden gutgeschrieben", async () => {
    const box = await page.locator(".arcade-stage").boundingBox();
    // Einwürfe sind auf einen alle 0,2 s begrenzt: nach jedem Tippen auf die Abbuchung warten
    const wagered = () => page.evaluate(() => window.__neonpalast.getState().stats.perGame.coinpusher?.wagered || 0);
    for (let i = 0; i < 60 && (await wagered()) < 250; i++) {
      const before = await wagered();
      await page.touchscreen.tap(box.x + box.width * (0.35 + (i % 4) * 0.1), box.y + box.height * 0.4);
      await page.waitForFunction((b) => (window.__neonpalast.getState().stats.perGame.coinpusher?.wagered || 0) > b, before, { timeout: 1000 }).catch(() => {});
    }
    await page.waitForFunction(() => (window.__neonpalast.getState().stats.perGame.coinpusher?.won || 0) > 0, null, { timeout: 30000 });
    const s = await assertLedger(page);
    assert(s.stats.perGame.coinpusher.wagered === 250, `eingeworfen ${s.stats.perGame.coinpusher.wagered}`);
  });
  await check("Münzkaskade: Feld bleibt nach Neuladen erhalten", async () => {
    await page.evaluate(() => window.__neonpalast.saveNow());
    const before = (await state(page)).games.coinpusher.world.c.length;
    await page.reload();
    await page.waitForSelector(".arcade-stage canvas");
    const after = (await state(page)).games.coinpusher.world.c.length;
    assert(Math.abs(after - before) <= 3, `${before} → ${after}`);
  });
  await check("Keine Konsolenfehler (Münzkaskade)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Basketball ----------
{
  const { page, ctx, errors } = await newPage();
  await openGame(page, "hoops");
  await page.locator(".arcade-overlay .btn-primary").tap();
  await phase(page, "hoops", "play", 6000);
  const box = await page.locator(".arcade-stage").boundingBox();
  let k = 1.6;
  const score = async () => Number(await page.locator(".arcade-hud .slot-display:nth-child(2) strong").textContent());
  async function swipe(up) {
    const x0 = box.x + box.width / 2;
    const y0 = box.y + box.height * 0.8;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x0, y0 - (up * k * box.height * 0.16 * i) / 8, { steps: 1 });
    await page.mouse.up();
    const m = await page.evaluate(() => window.__hoopsLastSwipe);
    k *= up / m.up;
    // Wurf abwarten: bis der nächste Ball bereitliegt
    await page.waitForFunction(() => window.__hoopsReady !== false, null, { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1400);
    return m.up;
  }
  await check("Basketball: Treffer mit passendem Swipe", async () => {
    await swipe(2.3);
    let hit = false;
    for (let i = 0; i < 5 && !hit; i++) {
      const s0 = await score();
      await swipe(2.3);
      hit = (await score()) > s0;
    }
    assert(hit, "kein Treffer");
  });
  await check("Basketball: Fehlwurf mit zu schwachem Swipe", async () => {
    const s0 = await score();
    await swipe(1.2);
    assert((await score()) === s0, "schwacher Wurf hat getroffen");
  });
  await check("Keine Konsolenfehler (Basketball)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Spielkontrolle: Pause ----------
{
  const { page, ctx, errors } = await newPage({ clock: true });
  await check("Pause (15 Min.): bestätigen, Spiele gesperrt, Halle bleibt offen", async () => {
    await page.locator("#hud-control").tap();
    await page.locator(".modal button:has-text('15 Min.')").tap();
    await page.waitForSelector(".modal:has-text('Pause starten?')");
    assert(await page.locator(".modal:has-text('nicht vorzeitig beenden')").count(), "Hinweis fehlt");
    await page.locator(".modal button:has-text('Pause starten')").tap();
    await page.waitForFunction(() => document.documentElement.classList.contains("is-play-locked"));
    await page.waitForSelector(".lock-banner");
    const s = await state(page);
    assert(s.control.pauseUntil > Date.now(), "pauseUntil nicht gesetzt");
  });
  await check("Pause: Automat in der Halle startet nicht, Direktlink führt zurück", async () => {
    await page.locator('.machine[data-game="slots-fruit"]').tap();
    await page.waitForSelector(".modal:has-text('Automaten pausiert')");
    await page.locator(".modal button:has-text('OK')").tap();
    await page.goto(BASE + "#/play/blackjack");
    await page.waitForSelector(".modal:has-text('Automaten pausiert')");
    assert((await page.locator(root("blackjack")).count()) === 0, "Spiel trotz Pause geöffnet");
    await page.locator(".modal button:has-text('OK')").tap();
    await page.goto(BASE + "#/play/scratch");
    await page.waitForSelector(".modal:has-text('Automaten pausiert')");
    assert((await page.locator(root("scratch")).count()) === 0, "Rubbellose trotz Pause geöffnet");
  });
  await check("Pause: Lotto-Studio offen, Scheinkauf gesperrt", async () => {
    await page.goto(BASE + "#/play/lotto");
    await page.waitForSelector(".lt-grid");
    assert(/Pause/.test(await page.locator(".lt-buy").textContent()), "Kaufknopf nicht gesperrt");
    const r = await page.evaluate(() => window.__neonpalast.lotto.buy("daily", [1, 2, 3, 4]));
    assert(!r.ok, "Schein trotz Pause gekauft");
    await page.goto(BASE + "#/");
    await page.waitForSelector(".machine");
  });
  await check("Pause: Einsätze werden auch programmatisch abgelehnt", async () => {
    const ok = await page.evaluate(() => window.__neonpalast.economy.placeBet("slots-fruit", 10, { min: 5, max: 250 }));
    assert(ok === null || ok === undefined || ok === false, "Einsatz trotz Pause angenommen");
  });
  await check("Pause übersteht Neuladen und endet nach Ablauf von selbst", async () => {
    await page.reload();
    await page.waitForSelector(".machine");
    assert(await page.evaluate(() => document.documentElement.classList.contains("is-play-locked")), "nach Neuladen entsperrt");
    await page.clock.fastForward("16:00");
    await page.clock.runFor(16000);
    await page.waitForFunction(() => !document.documentElement.classList.contains("is-play-locked"), null, { timeout: 5000 });
    const s = await state(page);
    assert(!s.achievements["break-taken"], "Pausen dürfen nicht belohnt werden");
  });
  await check("Keine Konsolenfehler (Pause)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Spielkontrolle: Auszeit ----------
{
  const { page, ctx, errors } = await newPage({ clock: true });
  await check("Auszeit (1 Tag): verbindlich, mit Endzeit, kein vorzeitiges Aufheben", async () => {
    await page.locator("#hud-control").tap();
    await page.locator(".modal button:has-text('1 Tag')").tap();
    await page.waitForSelector(".modal:has-text('Auszeit verbindlich starten?')");
    assert(await page.locator(".modal:has-text('nicht vorzeitig aufheben')").count(), "Hinweis fehlt");
    await page.locator(".modal button:has-text('Auszeit starten')").tap();
    await page.waitForFunction(() => document.documentElement.classList.contains("is-play-locked"));
    await page.locator("#hud-control").tap();
    const txt = await page.locator(".modal").textContent();
    assert(!/aufheben|beenden/i.test(await page.locator(".modal button").allTextContents().then((a) => a.join(" "))), "Knopf zum Aufheben vorhanden");
    assert(/Auszeit/.test(txt), "Status zeigt keine Auszeit");
    await page.locator(".modal button:has-text('Schließen')").first().tap();
  });
  await check("Auszeit: Neuladen hebt sie nicht auf, Automaten bleiben gesperrt", async () => {
    const before = (await state(page)).control.excludeUntil;
    await page.evaluate(() => window.__neonpalast.saveNow());
    await page.reload();
    await page.waitForSelector(".machine");
    const after = (await state(page)).control.excludeUntil;
    assert(after === before && after > Date.now() + 23 * 3600e3, "Auszeit verändert");
    await page.locator('.machine[data-game="roulette"]').scrollIntoViewIfNeeded();
    await page.locator('.machine[data-game="roulette"]').tap();
    await page.waitForSelector(".modal:has-text('Automaten pausiert')");
  });
  await check("Auszeit endet nach Ablauf", async () => {
    await page.clock.fastForward("25:00:00");
    await page.clock.runFor(16000);
    await page.waitForFunction(() => !document.documentElement.classList.contains("is-play-locked"), null, { timeout: 5000 });
  });
  await check("Keine Konsolenfehler (Auszeit)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Neutrale Session-Erinnerung ----------
{
  const { page, ctx, errors } = await newPage({ clock: true, mobile: false });
  await check("Erinnerung nach 60 Minuten aktiver Spielzeit – neutral formuliert", async () => {
    await openGame(page, "blackjack");
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Shift");
      await page.clock.fastForward("05:00");
      if (await page.locator(".modal:has-text('Zeit für eine Pause?')").count()) break;
    }
    await page.clock.runFor(16000);
    await page.waitForSelector(".modal:has-text('Zeit für eine Pause?')", { timeout: 3000 });
    const txt = await page.locator(".modal").textContent();
    assert(/Wie wär’s mit einer Pause\?/.test(txt), "Text fehlt");
    assert(!/zurückholen|noch eine Runde|Verlust/i.test(txt), "manipulativer Text");
    await page.locator(".modal button:has-text('Weiterspielen')").click();
    await page.waitForFunction(() => !document.querySelector(".modal"));
  });
  await check("Keine Konsolenfehler (Erinnerung)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Migration V1.0 → V1.1 ----------
{
  const v1 = {
    v: 1,
    createdAt: Date.now() - 86400e3 * 3,
    balance: 4321,
    xp: 2600,
    lastDaily: 0,
    lastRefill: 0,
    refills: 2,
    settings: { master: 0.5, sfx: 0.7, ambience: 0.1, vibration: false, audioHaptics: true, motion: "reduced", theme: "ocean" },
    stats: { rounds: 77, wagered: 5400, won: 8721, biggestWin: 900, perGame: { blackjack: { rounds: 40, wagered: 3000, won: 3100, biggestWin: 200 } } },
    bests: { hoops: 64, stacker: 9 },
    achievements: { "first-win": Date.now() - 1e6, "bj-natural": Date.now() - 1e5 },
    counters: { "slots-spins": 30 },
    games: { cyclone: { old: true }, roulette: { history: [17, 3, 0], chip: 25, lastBets: { "n:17": 500, red: 100 } }, "slots-cosmo": { bet: 500, free: { n: 5, bet: 500, total: 0 } } },
  };
  const ctx2 = await browser.newContext(VIEWPORTS.phone);
  ctx2.setDefaultTimeout(10000);
  await ctx2.addInitScript((save) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("neonpalast.save.v1", save);
      sessionStorage.setItem("seeded", "1");
    }
  }, JSON.stringify(v1));
  const p2 = await ctx2.newPage();
  const errs2 = [];
  p2.on("pageerror", (e) => errs2.push(e.message));
  p2.on("console", (m) => m.type() === "error" && errs2.push(m.text()));
  await p2.goto(BASE);
  await p2.waitForSelector(".machine");
  await check("Migration V1.0 → V1.2: Guthaben, XP, Erfolge, Einstellungen, Statistik, Bestwerte bleiben", async () => {
    const s = await state(p2);
    assert(s.v === 3, `Version ${s.v}`);
    assert(s.jukebox && s.lotto && s.inbox, "V1.2-Bereiche fehlen");
    assert(s.balance === 4321, `Guthaben ${s.balance}`);
    assert(s.xp === 2600, `XP ${s.xp}`);
    assert(s.achievements["first-win"] && s.achievements["bj-natural"], "Erfolge verloren");
    assert(s.settings.theme === "ocean" && s.settings.motion === "reduced" && s.settings.vibration === false, "Einstellungen verloren");
    assert(s.stats.rounds === 77 && s.stats.perGame.blackjack.rounds === 40, "Statistik verloren");
    assert(s.bests.hoops === 64 && s.bests.stacker === 9, "Bestwerte verloren");
    assert(!s.games.cyclone, "alte Lichtwirbel-Daten nicht verworfen");
    assert(s.control && s.control.pauseUntil === 0 && s.control.excludeUntil === 0, "Spielkontrolle fehlt");
  });
  await check("Migration: alte Roulette-Wetten werden auf das neue Einzelzahl-Limit begrenzt", async () => {
    await p2.goto(BASE + "#/play/roulette");
    await phase(p2, "roulette", "bet");
    await p2.locator('button[aria-label="Einsätze wie zuvor"]').tap();
    const total = await p2.evaluate(() => {
      const el = document.querySelector('.rl-cell[data-key="n:17"] .rl-chip');
      return el ? el.textContent.trim() : "";
    });
    assert(total === "100", `Chip auf 17: ${total}`);
  });
  await check("Migration: verdiente Kosmo-Freispiele bleiben erhalten", async () => {
    await p2.goto(BASE + "#/play/slots-cosmo");
    await phase(p2, "slots-cosmo", "idle");
    const badge = await p2.locator(".slot-free").textContent();
    assert(/5/.test(badge), `Freispiel-Anzeige: ${badge}`);
  });
  await check("Keine Konsolenfehler (Migration)", async () => assert(!errs2.length, errs2.join(" | ")));
  await ctx2.close();
}

// ---------- Jukebox ----------
{
  const { page, ctx, errors } = await newPage();
  await check("Jukebox: vor dem Kauf sichtbar mit Preis, Kauf braucht Bestätigung", async () => {
    const sub = await page.locator('[data-fixture="jukebox"] .fixture-sub').textContent();
    assert(/Zu verkaufen/.test(sub), `Schild: ${sub}`);
    await page.locator('[data-fixture="jukebox"]').tap();
    await page.waitForSelector(".modal:has-text('Jukebox')");
    assert(await page.locator(".modal button:has-text('Noch zu teuer')").count(), "mit 1.000 Credits nicht kaufbar");
    await page.locator(".modal button:has-text('Abbrechen')").tap();
    assert((await state(page)).jukebox.owned === false, "ohne Bestätigung gekauft");
  });
  await check("Jukebox kaufen: Abbuchung genau einmal, Licht an, Musik startet", async () => {
    await page.evaluate(() => {
      const s = window.__neonpalast.getState();
      s.balance += 20000;
      s.stats.bonus += 20000; // Testguthaben als Bonus verbuchen (Bilanz bleibt prüfbar)
    });
    await page.locator('[data-fixture="jukebox"]').tap();
    await page.locator(".modal .btn-gold").tap();
    await page.waitForFunction(() => window.__neonpalast.music.playing, null, { timeout: 6000 });
    const s = await assertLedger(page);
    assert(s.jukebox.owned && s.stats.spent === 5000, `Ausgaben ${s.stats.spent}`);
    assert(await page.locator('[data-fixture="jukebox"].is-owned.is-playing').count(), "Jukebox nicht beleuchtet");
  });
  await check("Song kaufen (Einheitspreis), wechseln, Zufall – Bibliothek bleibt", async () => {
    await page.locator('[data-fixture="jukebox"]').tap();
    await page.waitForSelector(".jb-panel");
    const prices = await page.locator(".jb-shop .btn-gold").allTextContents();
    assert(prices.length >= 5 && new Set(prices).size === 1, `Preise: ${prices}`);
    await page.locator(".jb-shop .btn-gold").first().tap();
    await page.locator(".jb-confirm .btn-gold").tap();
    await page.waitForFunction(() => window.__neonpalast.jukebox.state().songs.length === 3);
    const s = await assertLedger(page);
    assert(s.stats.spent === 6500, `Ausgaben ${s.stats.spent}`);
    const third = s.jukebox.songs[2];
    await page.locator(".jb-list:not(.jb-shop):not(.jb-locked) .jb-song").nth(2).locator("button").tap();
    await page.waitForFunction((id) => window.__neonpalast.music.current === id, third);
    await page.locator('.jb-controls button[aria-label="Nächstes Stück"]').tap();
    await page.waitForFunction((id) => window.__neonpalast.music.current !== id, third);
    await page.locator(".modal-close").tap();
  });
  await check("Musik in Spielen leiser, „aus“ stoppt sie, Rückkehr in die Halle setzt fort", async () => {
    await openGame(page, "plinko");
    assert(await page.evaluate(() => window.__neonpalast.music.playing), "Musik sollte leise weiterlaufen");
    await page.evaluate(() => window.__neonpalast.jukebox.setInGames("off"));
    await page.goto(BASE + "#/");
    await page.waitForSelector("#view-hub.is-active");
    await openGame(page, "stacker");
    assert(!(await page.evaluate(() => window.__neonpalast.music.playing)), "Modus „aus“ ignoriert");
    await page.goto(BASE + "#/");
    await page.waitForSelector("#view-hub.is-active");
    await page.waitForFunction(() => window.__neonpalast.music.playing, null, { timeout: 4000 });
    await page.evaluate(() => window.__neonpalast.jukebox.setInGames("duck"));
  });
  await check("Jukebox nach Neuladen: Besitz und Songs bleiben, Musik startet erst nach einer Geste", async () => {
    const before = (await state(page)).jukebox;
    await page.evaluate(() => window.__neonpalast.saveNow());
    await page.reload();
    await page.waitForSelector(".machine");
    const after = (await state(page)).jukebox;
    assert(after.owned && after.songs.join() === before.songs.join(), "Bibliothek verloren");
    assert(!(await page.evaluate(() => window.__neonpalast.music.playing)), "Autoplay ohne Geste");
    await page.locator(".hall-sign").tap();
    await page.waitForFunction(() => window.__neonpalast.music.playing, null, { timeout: 4000 });
  });
  await check("Keine Konsolenfehler (Jukebox)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Neon Lotto: Scheine & Live-Ziehung ----------
{
  const evening = new Date();
  evening.setHours(19, 56, 0, 0);
  const ctx = await browser.newContext(VIEWPORTS.phone);
  ctx.setDefaultTimeout(10000);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.clock.install({ time: evening });
  await page.goto(BASE + "#/play/lotto");
  await phase(page, "lotto", "idle");
  await check("Lotto: Schein mit 4 aus 40 kaufen, zweiter per Zufall, Abbuchung je Schein", async () => {
    assert((await page.locator(".lt-num").count()) === 40, "Tagesziehung: 40 Zahlen");
    assert(!(await page.locator(".lt-neonpick").isVisible()), "Tageslotto hat keine Neonzahl");
    for (const n of [3, 7, 12, 39]) await page.locator(`.lt-num[aria-label="Zahl ${n}"]`).tap();
    assert(await page.locator('.lt-num[aria-label="Zahl 5"]').getAttribute("aria-pressed") === "false");
    await page.locator('.lt-num[aria-label="Zahl 5"]').tap(); // fünfte Zahl wird abgewiesen
    assert((await page.locator(".lt-num.is-on").count()) === 4, "mehr als 4 Zahlen gewählt");
    await page.locator(".lt-buy").tap();
    await page.locator(".lt-builder-actions button:has-text('Zufallszahlen')").tap();
    await page.locator(".lt-buy").tap();
    const s = await assertLedger(page);
    const ids = Object.keys(s.lotto.tickets);
    assert(ids.length === 1 && s.lotto.tickets[ids[0]].length === 2, JSON.stringify(s.lotto.tickets));
    assert(s.stats.wagered === 100, `Einsatz ${s.stats.wagered}`);
  });
  await check("Lotto: höchstens 20 Scheine pro Ziehung", async () => {
    await page.evaluate(() => {
      const L = window.__neonpalast.lotto;
      for (let a = 1; a <= 17 && L.upcoming()[0].tickets.length < 20; a++) for (let b = a + 1; b <= 18 && L.upcoming()[0].tickets.length < 20; b++) L.buy("daily", [a, b, 19, 20]);
    });
    const n = await page.evaluate(() => window.__neonpalast.lotto.upcoming()[0].tickets.length);
    assert(n === 20, `Scheine ${n}`);
    await page.locator(".lt-builder-actions button:has-text('Zufallszahlen')").tap();
    assert(/Limit/.test(await page.locator(".lt-buy").textContent()) && (await page.locator(".lt-buy").isDisabled()), "Limit nicht angezeigt");
    await assertLedger(page);
  });
  await check("Live-Ziehung: zum Termin LIVE-Hinweis, Show zeigt das gespeicherte Ergebnis", async () => {
    await page.goto(BASE + "#/");
    await page.waitForSelector("#view-hub.is-active");
    await page.clock.fastForward("05:00");
    await page.clock.runFor(6000);
    await page.waitForSelector(".toast.has-action:has-text('LIVE')");
    const draw = await page.evaluate(() => window.__neonpalast.lotto.archive()[0]);
    assert(draw && draw.nums.length === 4 && draw.live, "keine Live-Ziehung gespeichert");
    assert(await page.locator('.machine[data-game="lotto"].is-live').count(), "Studio zeigt nicht LIVE");
    await page.locator(".toast-action").tap();
    await page.waitForSelector(".lt-show");
    assert((await page.locator(".lt-onair").textContent()).includes("LIVE"));
    await runClockUntil(page, phaseIs, [root("lotto"), ["win", "lose", "claimed"]]);
    await page.waitForSelector(".lt-finale");
    const shown = (await page.locator(".lt-rack .lt-ballchip").allTextContents()).map((x) => Number(x.replace(/\D/g, "")));
    assert(shown.join() === draw.nums.join(), `gezeigt ${shown} ≠ gespeichert ${draw.nums}`);
  });
  await check("Live gesehen und behandelt: Ergebnis erledigt, keine doppelte Nachricht, Bilanz stimmt", async () => {
    const d = await page.evaluate(() => window.__neonpalast.lotto.archive()[0]);
    if (d.payout > 0) {
      await page.locator(".lt-claim").tap();
      await page.locator(".lt-continue").tap();
    } else await page.locator(".lt-back").tap();
    await page.clock.runFor(1000);
    const s = await assertLedger(page);
    assert(s.lotto.draws[d.id].seen, "nicht als gesehen markiert");
    assert(!s.inbox.items.some((m) => m.id === `lotto:${d.id}`), "überflüssige Posteingang-Nachricht");
  });
  await check("Keine Konsolenfehler (Lotto live)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Neon Lotto: verpasste Ziehung, Posteingang, Einfordern ----------
{
  const save = {
    v: 3,
    balance: 1000,
    stats: { wagered: 100, won: 0, bonus: 100 },
    lotto: { tickets: {}, draws: { "daily-2026-10-05": { nums: [4, 12, 17, 19], tickets: [{ id: "t1", nums: [4, 12, 17, 2] }, { id: "t2", nums: [1, 2, 3, 5] }] } } },
    inbox: { items: [{ id: "lotto:daily-2026-10-05", type: "lotto", ts: 1, title: "Neon Lotto – Ziehung vom 05.10.", body: "Deine 2 Scheine wurden ausgewertet.", payload: { drawId: "daily-2026-10-05" }, action: { label: "Ziehung ansehen", kind: "lotto:show" } }] },
  };
  const ctx = await browser.newContext(VIEWPORTS.phone);
  ctx.setDefaultTimeout(10000);
  await ctx.addInitScript((s) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("neonpalast.save.v1", s);
      sessionStorage.setItem("seeded", "1");
    }
  }, JSON.stringify(save));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(BASE);
  await page.waitForSelector(".machine");
  await check("V1.2-Spielstand: verpasste Ziehung bleibt erhalten, Badge zeigt sie, Nachricht verrät nichts", async () => {
    assert((await page.locator("#hud-inbox-badge").textContent()) === "1", "Badge fehlt");
    await page.locator("#hud-inbox").tap();
    await page.waitForSelector(".inbox-item.is-unread");
    const txt = await page.locator(".inbox-item").textContent();
    assert(!/gewonnen|kein Gewinn|1\.000/i.test(txt), `Spoiler: ${txt}`);
  });
  await check("Aufzeichnung ansehen, Neuladen mitten in der Show ändert das Ergebnis nicht", async () => {
    await page.locator(".inbox-action").tap();
    await page.waitForSelector(".lt-show");
    assert((await page.locator(".lt-onair").textContent()).includes("AUFZEICHNUNG"));
    await page.reload();
    await page.waitForSelector(".lt-grid");
    const d = await page.evaluate(() => window.__neonpalast.lotto.draw("daily-2026-10-05"));
    assert(d.nums.join() === "4,12,17,19" && !d.claimed, "Ergebnis verändert");
    await page.locator(".lt-open button:has-text('Ziehung ansehen')").tap();
    await page.waitForSelector(".lt-skip");
    await page.locator(".lt-skip").tap();
    await phase(page, "lotto", "win");
  });
  await check("Einfordern: Doppelklick zahlt einmal, „Eingefordert“, Neuladen zahlt nicht erneut", async () => {
    await page.locator(".lt-claim").dblclick();
    await page.waitForSelector(".lt-claim.is-claimed");
    let s = await assertLedger(page);
    assert(s.balance === 2000, `Guthaben ${s.balance}`);
    await page.reload();
    await page.waitForSelector(".lt-grid");
    s = await state(page);
    assert(s.balance === 2000 && s.lotto.draws["daily-2026-10-05"].claimed, "doppelt ausgezahlt oder Anspruch verloren");
    const claimed = await page.evaluate(() => window.__neonpalast.lotto.claim("daily-2026-10-05"));
    assert(claimed === 0, "zweites Einfordern möglich");
  });
  await check("Archiv zeigt Datum, Zahlen, Treffer und Status", async () => {
    if (await page.locator(".lt-open button").count()) {
      await page.locator(".lt-open button").tap();
      await page.locator(".lt-skip").tap();
      await page.locator(".lt-continue").tap();
    }
    await page.waitForSelector(".lt-arch");
    const txt = await page.locator(".lt-arch summary").first().textContent();
    assert(/05\.10\./.test(txt) && /eingefordert/.test(txt), `Archiv: ${txt}`);
  });
  await check("Keine Konsolenfehler (Lotto verpasst)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Neon Lotto: Verlust ----------
{
  const save = { v: 3, balance: 1000, lotto: { tickets: {}, draws: { "grand-2026-10-04": { nums: [1, 2, 3, 4], tickets: [{ id: "t1", nums: [10, 11, 12, 13] }] } } } };
  const ctx = await browser.newContext(VIEWPORTS.small);
  ctx.setDefaultTimeout(10000);
  await ctx.addInitScript((s) => localStorage.setItem("neonpalast.save.v1", s), JSON.stringify(save));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "#/play/lotto");
  await check("Verlust: „Leider kein Gewinn“, roter Zurück-Knopf, kein Kaufdruck", async () => {
    await page.locator(".lt-open button").tap();
    await page.locator(".lt-skip").tap();
    await phase(page, "lotto", "lose");
    const txt = await page.locator(".lt-finale").textContent();
    assert(/LEIDER KEIN GEWINN/.test(txt) && !/fast|beinahe|nochmal|neues Los/i.test(txt), txt);
    assert(await page.locator(".lt-back.btn-danger").isVisible());
    await page.locator(".lt-back").tap();
    await page.waitForFunction(() => !document.querySelector(".lt-show"));
    assert((await state(page)).balance === 1000);
    assert(await noHorizontalScroll(page), "Querscrollen");
  });
  await check("Keine Konsolenfehler (Lotto Verlust)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Großes Neon Lotto: 6 aus 49 + Neonzahl ----------
{
  const evening = new Date();
  evening.setHours(12, 0, 0, 0);
  const ctx = await browser.newContext(VIEWPORTS.small);
  ctx.setDefaultTimeout(10000);
  const page = await ctx.newPage();
  shotPage = page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.clock.install({ time: evening });
  await page.goto(BASE + "#/play/lotto");
  await phase(page, "lotto", "idle");
  await check("Großes Lotto: genau 6 Zahlen aus 49 + Neonzahl 0–9, erst dann kaufbar", async () => {
    await page.locator('.lt-tabs button[data-type="grand"]').tap();
    assert((await page.locator(".lt-num").count()) === 49, "49 Zahlen");
    assert((await page.locator(".lt-neon").count()) === 10, "Neonzahlen 0–9");
    for (const n of [3, 11, 19, 27, 35, 43]) await page.locator(`.lt-num[aria-label="Zahl ${n}"]`).tap();
    await page.locator('.lt-num[aria-label="Zahl 49"]').tap(); // siebte Zahl wird abgewiesen
    assert((await page.locator(".lt-num.is-on").count()) === 6, "mehr als 6 Zahlen gewählt");
    assert(await page.locator(".lt-buy").isDisabled(), "ohne Neonzahl kaufbar");
    await page.locator('.lt-neon[aria-label="Neonzahl 7"]').tap();
    assert(!(await page.locator(".lt-buy").isDisabled()), "Kaufknopf bleibt gesperrt");
    await page.locator(".lt-buy").tap();
    const s = await assertLedger(page);
    const [id] = Object.keys(s.lotto.tickets);
    const t = s.lotto.tickets[id][0];
    assert(id.startsWith("grand-") && t.nums.join() === "3,11,19,27,35,43" && t.neon === 7 && t.r === 2, JSON.stringify(t));
    assert(s.balance === 900, `Guthaben ${s.balance}`);
    assert(await noHorizontalScroll(page), "Querscrollen");
  });
  await check("Große Ziehung: Ergebnis vor der Show gespeichert, 6 Kugeln, Pause, dann separat die Neonzahl", async () => {
    const wait = await page.evaluate(() => window.__neonpalast.lotto.nextDraw("grand").at - Date.now());
    await page.clock.fastForward(wait + 2000);
    await page.evaluate(() => window.__neonpalast.lottoTick());
    const d = await page.evaluate(() => window.__neonpalast.lotto.archive()[0]);
    assert(d.type === "grand" && d.nums.length === 6 && Number.isInteger(d.neon), "Ergebnis nicht vollständig gespeichert");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("neonpalast.save.v1")).lotto.draws);
    assert(saved[d.id] && saved[d.id].nums.join() === d.nums.join() && saved[d.id].neon === d.neon, "nicht vor der Show gespeichert");
    await page.waitForSelector(".lt-show");
    // Während die Hauptzahlen laufen, ist der Neon-Platz leer
    await runClockUntil(page, () => document.querySelectorAll(".lt-rack .lt-slot.is-filled:not(.is-neon)").length === 6, null);
    assert(!(await page.locator(".lt-slot.is-neon.is-filled").count()), "Neonzahl zu früh gezeigt");
    await runClockUntil(page, phaseIs, [root("lotto"), ["neon"]]);
    assert(!(await page.locator(".lt-slot.is-neon.is-filled").count()), "keine Spannungspause vor der Neonzahl");
    await runClockUntil(page, () => document.querySelector(".lt-slot.is-neon.is-filled"), null);
    await runClockUntil(page, phaseIs, [root("lotto"), ["win", "lose"]]);
    const shown = (await page.locator(".lt-rack .lt-slot:not(.is-neon) .lt-ballchip").allTextContents()).map((x) => Number(x.replace(/\D/g, "")));
    const neon = Number((await page.locator(".lt-rack .lt-slot.is-neon .lt-ballchip").textContent()).replace(/\D/g, ""));
    assert(shown.join() === d.nums.join() && neon === d.neon, `gezeigt ${shown}+${neon} ≠ gespeichert ${d.nums}+${d.neon}`);
    assert(await noHorizontalScroll(page), "Querscrollen");
  });
  await check("Große Ziehung: Neuladen und erneutes Ansehen zeigen dasselbe Ergebnis", async () => {
    const d = await page.evaluate(() => window.__neonpalast.lotto.archive()[0]);
    await page.reload();
    await page.waitForSelector(".lt-grid");
    await page.evaluate(() => window.__neonpalast.lottoTick());
    const again = await page.evaluate(() => window.__neonpalast.lotto.archive()[0]);
    assert(again.nums.join() === d.nums.join() && again.neon === d.neon && again.payout === d.payout, "Ergebnis verändert");
    await page.locator(".lt-open button").first().tap();
    await page.locator(".lt-skip").tap();
    await phase(page, "lotto", ["win", "lose"]);
    const neon = Number((await page.locator(".lt-rack .lt-slot.is-neon .lt-ballchip").textContent()).replace(/\D/g, ""));
    assert(neon === d.neon, "Überspringen zeigt andere Neonzahl");
    if (d.payout > 0) {
      await page.locator(".lt-claim").tap();
      await page.locator(".lt-continue").tap();
    } else await page.locator(".lt-back").tap();
    await page.waitForFunction(() => !document.querySelector(".lt-show"));
    await assertLedger(page);
  });
  await check("Keine Konsolenfehler (Großes Lotto)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Migration: offene V1.2-Lottoscheine ----------
{
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const save = {
    v: 3,
    balance: 850,
    stats: { wagered: 150, won: 0, bonus: 0 },
    lotto: { seq: 2, tickets: { [`daily-${key(tomorrow)}`]: [{ id: "t1", nums: [1, 2, 3, 4], at: 1, price: 50 }], "grand-2026-10-07": [{ id: "t2", nums: [21, 22, 23, 24], at: 2, price: 100 }] }, draws: {} },
    jukebox: { owned: true },
  };
  const ctx = await browser.newContext(VIEWPORTS.phone);
  ctx.setDefaultTimeout(10000);
  await ctx.addInitScript((s) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("neonpalast.save.v1", s);
      sessionStorage.setItem("seeded", "1");
    }
  }, JSON.stringify(save));
  const page = await ctx.newPage();
  shotPage = page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForSelector(".machine");
  await check("Migration: offene V1.2-Scheine (4 aus 20/24) werden einmal erstattet, nicht neu gezogen", async () => {
    await page.waitForSelector(".toast:has-text('erstattet')");
    let s = await assertLedger(page);
    assert(s.balance === 1000 && Object.keys(s.lotto.tickets).length === 0 && Object.keys(s.lotto.draws).length === 0, JSON.stringify({ b: s.balance, l: s.lotto }));
    assert(s.inbox.items.some((m) => m.id === "lotto:refund-v2"), "Hinweis im Posteingang fehlt");
    assert(s.jukebox.owned, "Jukebox-Besitz verloren");
    await page.reload();
    await page.waitForSelector(".machine");
    await page.evaluate(() => window.__neonpalast.lottoTick());
    s = await state(page);
    assert(s.balance === 1000, "doppelt erstattet");
  });
  await check("Keine Konsolenfehler (Migration)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Touch: Spielflächen blockieren Browser-Gesten, Seiten bleiben scrollbar ----------
for (const width of [320, 375, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 700 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  ctx.setDefaultTimeout(10000);
  const page = await ctx.newPage();
  shotPage = page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cdp = await ctx.newCDPSession(page);
  const swipe = async (x, y, dx, dy) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + (dx * i) / 8, y: y + (dy * i) / 8 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  await page.goto(BASE);
  await page.waitForSelector(".machine");
  await check(`Touch ${width} px: Wischen/Halten auf Spielflächen wird nicht vom Browser übernommen`, async () => {
    for (const id of ["hoops", "grabber", "coinpusher", "plinko", "stacker", "cyclone"]) {
      await openGame(page, id);
      const targets = await page.evaluate((sel) => {
        const rootEl = document.querySelector(sel);
        rootEl.querySelectorAll(".arcade-overlay").forEach((o) => (o.style.display = "none")); // Start-/Ergebnistafeln dürfen scrollen
        const stage = rootEl.querySelector(".arcade-stage");
        const holds = [...rootEl.querySelectorAll(".touch-hold")];
        window.__tc = { cancel: 0, move: 0 };
        for (const el of [stage, ...holds]) {
          el.addEventListener("pointercancel", () => window.__tc.cancel++);
          el.addEventListener("pointermove", () => window.__tc.move++);
        }
        const c = (el) => {
          const r = el.getBoundingClientRect();
          return [r.x + r.width / 2, r.y + r.height / 2];
        };
        return [c(stage), ...holds.map(c)];
      }, root(id));
      for (const [x, y] of targets) {
        await swipe(x, y, 0, -40); // kleines Verrutschen beim Halten
        await swipe(x, y, 0, 120); // Wischen nach unten („Pull to refresh“)
      }
      const r = await page.evaluate(() => ({ ...window.__tc, scroll: document.scrollingElement.scrollTop, scale: visualViewport.scale }));
      assert(r.cancel === 0, `${id}: Browser hat ${r.cancel}× die Geste übernommen (pointercancel)`);
      assert(r.move > 0, `${id}: keine Pointer-Bewegung angekommen`);
      assert(r.scroll === 0 && r.scale === 1, `${id}: Seite gescrollt/gezoomt`);
    }
  });
  await check(`Touch ${width} px: Lotto, Halle und Einstellungen bleiben normal scrollbar`, async () => {
    await openGame(page, "lotto");
    for (const type of ["daily", "grand"]) {
      await page.locator(`.lt-tabs button[data-type="${type}"]`).tap();
      const ok = await page.evaluate(() => [...document.querySelectorAll(".lt-num, .lt-neon")].every((n) => n.getBoundingClientRect().width >= 40 && n.getBoundingClientRect().height >= 40));
      assert(ok, `${type}: Zahlenfelder < 40 px`);
      assert(await noHorizontalScroll(page), `${type}: Querscrollen`);
    }
    await swipe(width / 2, 520, 0, -300);
    await page.waitForFunction(() => document.querySelector(".lotto-stage").scrollTop > 50);
    const ta = await page.evaluate(() => ["html", "body", ".lotto-stage", ".lt-num"].map((q) => getComputedStyle(document.querySelector(q)).touchAction));
    assert(!ta.includes("none"), `touch-action none außerhalb der Spielflächen: ${ta}`);
    await page.goto(BASE + "#/");
    await page.waitForSelector(".machine");
    assert((await page.evaluate(() => getComputedStyle(document.querySelector("#view-hub")).touchAction)) !== "none", "Halle gesperrt");
    await openGame(page, "plinko");
    await page.locator("#hud-settings").tap();
    await page.waitForSelector(".modal");
    const modalTa = await page.evaluate(() => [...document.querySelectorAll(".modal, .modal *")].some((e) => getComputedStyle(e).touchAction === "none"));
    assert(!modalTa, "Einstellungen blockieren Scrollen");
  });
  await check(`Keine Konsolenfehler (Touch ${width})`, async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Automat lädt nicht (Netzwerk) vs. Automat defekt ----------
{
  const { page, ctx, errors } = await newPage({ mobile: false });
  await check("Loader: 503 auf einem Spielmodul → „konnte gerade nicht geladen werden“, Erneut versuchen lädt den Automaten", async () => {
    await page.route("**/js/games/slots/machines.js*", (r) => r.fulfill({ status: 503, body: "Service Unavailable" }));
    await page.goto(BASE + "#/play/slots-fruit");
    await page.waitForSelector(".toast:has-text('konnte gerade nicht geladen werden')");
    assert(!(await page.locator(".toast:has-text('außer Betrieb')").count()), "als Defekt gemeldet");
    await page.waitForSelector("#view-hub.is-active");
    await page.unroute("**/js/games/slots/machines.js*");
    await page.locator(".toast-action:has-text('Erneut versuchen')").click();
    await phase(page, "slots-fruit", "idle");
  });
  await check("Loader: Fehler im Spielcode bleibt „außer Betrieb“", async () => {
    await page.route("**/js/games/stacker/stacker.js*", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "export default { mount() { throw new Error('kaputt'); } };" }));
    await page.goto(BASE + "#/");
    await page.waitForSelector(".machine");
    await page.goto(BASE + "#/play/stacker");
    await page.waitForSelector(".toast:has-text('außer Betrieb')");
    await page.waitForSelector("#view-hub.is-active");
  });
  // erwartete Fehlermeldungen dieses Abschnitts (503, absichtlicher Defekt) herausfiltern
  await check("Keine unerwarteten Konsolenfehler (Loader)", async () => {
    const rest = errors.filter((e) => !/503|Failed to fetch dynamically|kaputt|konnte nicht gestartet|Failed to load resource/i.test(e));
    assert(!rest.length, rest.join(" | "));
  });
  await ctx.close();
}

// ---------- Rubbellose ----------
{
  const ctx = await browser.newContext(VIEWPORTS.phone);
  ctx.setDefaultTimeout(10000);
  const page = await ctx.newPage();
  shotPage = page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(BASE + "#/play/scratch");
  await phase(page, "scratch", "idle");
  await check("Rubbellose: Lose kaufen, landen auf dem Tisch, Abbuchung je Los, Ergebnis sofort gespeichert", async () => {
    for (const t of ["neon7", "lucky", "vault"]) await page.locator(`.sc-buy[data-type="${t}"]`).tap();
    await page.waitForFunction(() => document.querySelectorAll(".sc-mini").length === 3);
    const s = await assertLedger(page);
    assert(s.balance === 1000 - 20 - 50 - 200, `Guthaben ${s.balance}`);
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem("neonpalast.save.v1"))).games.scratch.tickets;
    assert(saved.length === 3 && saved.every((t) => t.layout && Number.isInteger(t.prize)), "Lose nicht sofort gespeichert");
    assert((await page.locator(".sc-mini.is-open").count()) === 0, "Ergebnis verraten");
  });
  await check("Rubbellose: Los antippen → groß im Vordergrund, Tisch verschwommen; Finger-Rubbeln deckt Felder auf", async () => {
    await page.locator(".sc-mini").first().tap();
    await page.waitForSelector(".sc-focus .sc-foil");
    assert(await page.evaluate(() => getComputedStyle(document.querySelector(".sc-world")).filter.includes("blur")), "Tisch nicht verschwommen");
    await phase(page, "scratch", "scratch");
    await page.waitForSelector(".sc-focus[data-ready]");
    const box = await page.locator(".sc-foil").boundingBox();
    await page.evaluate(() => {
      window.__sc = { cancel: 0 };
      document.querySelector(".sc-foil").addEventListener("pointercancel", () => window.__sc.cancel++);
    });
    // echte Touch-Wischer, Zeile für Zeile, bis das ganze Los offen ist
    for (let row = 0, y = 6; y < box.height && !(await page.evaluate(phaseIs, [root("scratch"), ["win", "push", "lose"]])); y += 12, row++) {
      const x0 = row % 2 ? box.width - 4 : 4;
      const x1 = row % 2 ? 4 : box.width - 4;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + x0, y: box.y + y }] });
      for (let i = 1; i <= 10; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + x0 + ((x1 - x0) * i) / 10, y: box.y + y }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await phase(page, "scratch", ["win", "push", "lose"]);
    const r = await page.evaluate(() => ({ ...window.__sc, scroll: document.scrollingElement.scrollTop, open: document.querySelectorAll(".sc-field.is-revealed").length, all: document.querySelectorAll(".sc-field").length }));
    assert(r.cancel === 0 && r.scroll === 0, `Browser-Geste beim Rubbeln: ${JSON.stringify(r)}`);
    assert(r.open === r.all, `nicht alle Felder offen: ${r.open}/${r.all}`);
  });
  await check("Rubbellose: Gewinn genau einmal einfordern bzw. Niete mit rotem Knopf ablegen", async () => {
    await page.waitForSelector(".sc-actions[data-ready]");
    const before = await state(page);
    const t = before.games.scratch.tickets.find((x) => x.revealed.every(Boolean));
    if (t.prize > 0) {
      await page.locator(".sc-claim").dblclick();
    } else {
      assert(await page.locator(".sc-drop.btn-danger").isVisible(), "kein roter Ablegen-Knopf");
      assert(!/nochmal|neues Los|fast/i.test(await page.locator(".sc-focus").textContent()), "Kaufdruck im Verlustfall");
      await page.locator(".sc-drop").tap();
    }
    await page.waitForFunction(() => !document.querySelector(".sc-focus")).catch(async (e) => {
      const dbg = await page.evaluate(() => ({ dis: document.querySelector(".sc-drop, .sc-claim")?.disabled, phase: document.querySelector(".game-root").dataset.phase, t: window.__neonpalast.getState().games.scratch.tickets.map((x) => [x.id, x.revealed.join("")]) }));
      throw new Error(`${e.message.split("\n")[0]} ${JSON.stringify(dbg)}`);
    });
    const s = await assertLedger(page);
    assert(s.balance === before.balance + t.prize, `Guthaben ${s.balance} ≠ ${before.balance} + ${t.prize}`);
    assert(s.games.scratch.tickets.length === 2 && s.stats.perGame.scratch.rounds === 1, "Los nicht genau einmal abgerechnet");
  });
  await check("Rubbellose: Neuladen mitten im Rubbeln ändert weder Bild noch Gewinn, Fortschritt bleibt", async () => {
    await page.locator(".sc-mini").first().tap();
    await page.waitForSelector(".sc-focus[data-ready] .sc-foil");
    const box = await page.locator(".sc-foil").boundingBox();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + 4, y: box.y + 20 }] });
    for (let i = 1; i <= 12; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + 4 + ((box.width - 8) * i) / 12, y: box.y + 20 + (i % 2) * 14 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.evaluate(() => window.__neonpalast.saveNow());
    const before = (await state(page)).games.scratch.tickets[0];
    await page.reload();
    await phase(page, "scratch", "idle");
    const after = (await state(page)).games.scratch.tickets[0];
    assert(JSON.stringify(after.layout) === JSON.stringify(before.layout) && after.prize === before.prize, "Los neu gewürfelt");
    assert(JSON.stringify(after.revealed) === JSON.stringify(before.revealed), "Fortschritt verloren");
    await page.locator(".sc-mini").first().tap();
    await page.waitForSelector(".sc-foil");
    const shown = await page.locator(".sc-field.is-revealed").count();
    assert(shown === before.revealed.filter(Boolean).length, `aufgedeckte Felder ${shown}`);
    await page.locator(".sc-back-table").tap();
    await page.waitForFunction(() => !document.querySelector(".sc-focus"));
    await phase(page, "scratch", "idle");
  });
  await check("Rubbellose: höchstens 12 Lose auf dem Tisch", async () => {
    for (let i = 0; i < 12 && !(await page.locator('.sc-buy[data-type="neon7"]').isDisabled()); i++) await page.locator('.sc-buy[data-type="neon7"]').tap();
    assert((await page.locator(".sc-mini").count()) === 12, "nicht 12 Lose");
    assert(/Tisch voll/.test(await page.locator('.sc-buy[data-type="neon7"]').textContent()), "Limit nicht angezeigt");
    await assertLedger(page);
    assert(await noHorizontalScroll(page), "Querscrollen");
  });
  await check("Keine Konsolenfehler (Rubbellose)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Rubbellose: bekannter Gewinn / manipulierter Spielstand ----------
{
  const win = { id: "s1", type: "neon7", prize: 10000, layout: { cells: [100, 20, 100, 40, 100, 200] }, revealed: [false, false, false, false, false, false], boughtAt: 1, rot: 3, dx: 0, dy: 0 };
  const lose = { id: "s2", type: "vault", prize: 0, layout: { cells: Array.from({ length: 9 }, () => ({ s: "⭐", amount: 0 })) }, revealed: Array(9).fill(false), boughtAt: 2, rot: -4, dx: 0, dy: 0 };
  const multi = { id: "s3", type: "turbo", prize: 1, layout: { cells: [100, 50, 100, 250, 100, 500], multi: 5 }, revealed: Array(7).fill(false), boughtAt: 3, rot: 2, dx: 0, dy: 0 };
  const extra = { id: "s4", type: "luckyx", prize: 1, layout: { win: [7, 30], own: [{ n: 7, amount: 200 }, { n: 1, amount: 100 }, { n: 2, amount: 500 }, { n: 3, amount: 100 }, { n: 4, amount: 1000 }, { n: 5, amount: 100 }], extra: { draw: 4, mine: 4 } }, revealed: Array(10).fill(false), boughtAt: 4, rot: -2, dx: 0, dy: 0 };
  const coins = { id: "s5", type: "digger", prize: 1, layout: { cells: [true, false, true, false, false, true, false, false, true, false, false, false] }, revealed: Array(12).fill(false), boughtAt: 5, rot: 1, dx: 0, dy: 0 };
  const save = { v: 3, balance: 1000, stats: { wagered: 900, won: 0, bonus: 900 }, games: { scratch: { seq: 5, tickets: [win, lose, multi, extra, coins], history: [] } } };
  const ctx = await browser.newContext(VIEWPORTS.small);
  ctx.setDefaultTimeout(10000);
  await ctx.addInitScript((s) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("neonpalast.save.v1", s);
      sessionStorage.setItem("seeded", "1");
    }
  }, JSON.stringify(save));
  const page = await ctx.newPage();
  shotPage = page;
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "#/play/scratch");
  await phase(page, "scratch", "idle");
  await check("Rubbellose: Gewinn kommt aus dem Losbild (gespeicherter Betrag zählt nicht), Treffer hervorgehoben", async () => {
    await page.locator('.sc-mini[data-id="s1"]').tap();
    await page.locator(".sc-reveal").tap();
    await phase(page, "scratch", "win");
    assert((await page.locator(".sc-field.is-win").count()) === 3, "3 gleiche nicht hervorgehoben");
    assert(/100/.test(await page.locator(".sc-status").textContent()), "falscher Betrag angezeigt");
    await page.locator(".sc-claim").tap();
    await page.waitForFunction(() => !document.querySelector(".sc-focus"));
    const s = await state(page);
    assert(s.balance === 1100, `Guthaben ${s.balance}`);
  });
  await check("Rubbellose: Niete – „Leider kein Gewinn“, kein Gewinn-Feuerwerk, roter Knopf", async () => {
    await page.locator('.sc-mini[data-id="s2"]').tap();
    await page.locator(".sc-reveal").tap();
    await phase(page, "scratch", "lose");
    assert(/LEIDER KEIN GEWINN/.test(await page.locator(".sc-status").textContent()));
    assert(!(await page.locator(".sc-claim").count()), "Einfordern bei Niete");
    await page.locator(".sc-drop").tap();
    await page.waitForFunction(() => !document.querySelector(".sc-focus"));
    const s = await state(page);
    assert(s.balance === 1100 && !s.games.scratch.tickets.some((t) => t.id === "s2") && s.stats.perGame.scratch.rounds === 2, "Niete falsch abgerechnet");
    assert(await noHorizontalScroll(page), "Querscrollen");
  });
  await check("Rubbellose: MULTI-Feld multipliziert (100 C × 5), Extrazahl verfünffacht (200 C × 5), 4 Münzen = 75 C", async () => {
    for (const [id, expect, calc] of [["s3", 500, /100 C × 5/], ["s4", 1000, /200 C × 5/], ["s5", 75, null]]) {
      const before = (await state(page)).balance;
      await page.locator(`.sc-mini[data-id="${id}"]`).tap();
      await page.locator(".sc-reveal").tap();
      await phase(page, "scratch", ["win", "push"]);
      const txt = await page.locator(".sc-status").textContent();
      assert(txt.includes(expect.toLocaleString("de-DE")), `${id}: ${txt}`);
      if (calc) {
        assert(calc.test(txt), `${id}: Rechnung fehlt (${txt})`);
        assert((await page.locator(".sc-field.is-multi.is-win, .sc-field.is-extra.is-win").count()) >= 1, `${id}: Bonus nicht hervorgehoben`);
      } else assert((await page.locator(".sc-field.is-coin.is-win").count()) === 4, "Münzen nicht hervorgehoben");
      await page.locator(".sc-claim").tap();
      await page.waitForFunction(() => !document.querySelector(".sc-focus"));
      const s2 = await state(page);
      assert(s2.balance === before + expect, `${id}: Guthaben ${s2.balance} ≠ ${before} + ${expect}`);
    }
    assert(await noHorizontalScroll(page), "Querscrollen");
  });
  await check("Keine Konsolenfehler (Rubbellose bekannt)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Layouts ----------
for (const size of ["small", "landscape", "tablet", "wide"]) {
  const { page, ctx, errors } = await newPage({ size });
  await check(`Layout ${size} (${VIEWPORTS[size].viewport.width}×${VIEWPORTS[size].viewport.height}): neue Spiele ohne Querscrollen, Bedienelemente sichtbar`, async () => {
    for (const id of ["plinko", "grabber", "horses", "cyclone", "blackjack", "lotto", "scratch"]) {
      await openGame(page, id);
      assert(await noHorizontalScroll(page), `${id}: horizontaler Scrollbalken`);
      const vis = await page.evaluate((sel) => {
        if (sel.includes("scratch")) {
          // Losverkauf: Kaufknöpfe fingertauglich und erreichbar, Tisch sichtbar
          const buys = [...document.querySelectorAll(`${sel} .sc-buy`)];
          const first = buys[0].getBoundingClientRect();
          const t = document.querySelector(`${sel} .sc-felt`).getBoundingClientRect();
          return buys.length === 7 && buys.every((b) => b.getBoundingClientRect().height >= 40) && first.right <= window.innerWidth + 2 && first.bottom <= window.innerHeight + 2 && t.height >= 120;
        }
        if (sel.includes("lotto")) {
          // Lotto-Studio scrollt: Zahlenfeld muss fingertauglich sein, Kaufknopf erreichbar
          const nums = [...document.querySelectorAll(`${sel} .lt-num`)];
          const buy = document.querySelector(`${sel} .lt-buy`);
          buy.scrollIntoView({ block: "center" });
          const rb = buy.getBoundingClientRect();
          return nums.length >= 20 && nums.every((n) => n.getBoundingClientRect().width >= 40 && n.getBoundingClientRect().height >= 40) && rb.height >= 40 && rb.right <= window.innerWidth + 2;
        }
        const btns = [...document.querySelectorAll(`${sel} .game-controls .btn-primary, ${sel} .game-controls .btn-gold`)];
        return btns.length && btns.some((b) => {
          const r = b.getBoundingClientRect();
          return r.width >= 40 && r.height >= 40 && r.bottom <= window.innerHeight + 2 && r.right <= window.innerWidth + 2;
        });
      }, root(id));
      assert(vis, `${id}: Hauptknopf nicht vollständig sichtbar oder < 40 px`);
    }
  });
  await check(`Keine Konsolenfehler (${size})`, async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Reduzierte Bewegung ----------
{
  const ctx = await browser.newContext({ ...VIEWPORTS.phone, reducedMotion: "reduce" });
  ctx.setDefaultTimeout(10000);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "#/play/plinko");
  await check("Reduzierte Bewegung: Plinko-Mehrfachwurf läuft ohne Fehler durch", async () => {
    await phase(page, "plinko", "idle");
    await page.locator(".game-controls .btn-gold").tap();
    await phase(page, "plinko", "idle", 30000);
    assert(!errors.length, errors.join(" | "));
  });
  await ctx.close();
}

// ---------- Fehlende Browserfunktionen ----------
{
  const { page, ctx, errors } = await newPage({
    init: () => {
      delete window.AudioContext;
      delete window.webkitAudioContext;
      delete window.ResizeObserver;
      Object.defineProperty(navigator, "vibrate", { value: undefined });
      Storage.prototype.setItem = () => {
        throw new Error("QuotaExceeded");
      };
    },
  });
  await check("Ohne Web Audio, ResizeObserver, Vibration und localStorage spielbar", async () => {
    await page.locator('.machine[data-game="slots-cosmo"]').tap();
    await phase(page, "slots-cosmo", "idle");
    await page.locator(".spin-btn").tap();
    await phase(page, "slots-cosmo", "spinning", 3000);
    await phase(page, "slots-cosmo", "idle", 8000);
    const s = await state(page);
    assert(s.stats.perGame["slots-cosmo"].rounds === 1, "Dreh nicht abgeschlossen");
    await page.locator('button[aria-label="Zurück zur Halle"]').tap();
    await page.locator('.machine[data-game="plinko"]').scrollIntoViewIfNeeded();
    await page.locator('.machine[data-game="plinko"]').tap();
    await phase(page, "plinko", "idle");
  });
  await check("Keine Konsolenfehler bei fehlenden Features", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Mehrere Tabs ----------
{
  const { page, ctx } = await newPage({ mobile: false });
  await check("Zweiter Tab sperrt den ersten (keine Spielstand-Kollision)", async () => {
    const p2 = await ctx.newPage();
    await p2.goto(BASE);
    await p2.waitForSelector(".machine");
    await page.waitForSelector(".modal:has-text('Anderer Tab aktiv')", { timeout: 3000 });
  });
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${passes} bestanden, ${failures} fehlgeschlagen`);
process.exit(failures ? 1 : 0);
