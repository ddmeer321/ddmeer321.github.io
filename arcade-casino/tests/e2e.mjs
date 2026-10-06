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
/** Bilanz-Invariante: Guthaben = Start − Einsätze + Auszahlungen (+ Boni). */
async function assertLedger(page, start = 1000) {
  const s = await state(page);
  const extra = (s.stats.bonus || 0);
  assert(s.balance === start - s.stats.wagered + s.stats.won + extra, `Bilanz inkonsistent: ${s.balance} ≠ ${start} − ${s.stats.wagered} + ${s.stats.won} + ${extra}`);
  return s;
}
async function openGame(page, id) {
  await page.goto(BASE + `#/play/${id}`);
  await page.waitForFunction((sel) => document.querySelector(sel)?.dataset.phase, root(id), { timeout: 8000 }).catch(() => {});
  await page.waitForSelector(root(id), { timeout: 8000 });
}
const noHorizontalScroll = (page) => page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1);

const GAMES = ["slots-fruit", "slots-seven", "slots-cosmo", "blackjack", "roulette", "horses", "plinko", "grabber", "coinpusher", "hoops", "stacker", "cyclone"];

console.log("Neonpalast E2E (V1.1)");

// ---------- Hub & Navigation ----------
{
  const { page, ctx, errors } = await newPage();
  await check("Hub lädt mit allen 12 Automaten", async () => {
    const n = await page.locator(".machine").count();
    assert(n === GAMES.length, `erwartet ${GAMES.length}, gefunden ${n}`);
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
  await check("Migration V1.0 → V1.1: Guthaben, XP, Erfolge, Einstellungen, Statistik, Bestwerte bleiben", async () => {
    const s = await state(p2);
    assert(s.v === 2, `Version ${s.v}`);
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

// ---------- Layouts ----------
for (const size of ["small", "landscape", "tablet", "wide"]) {
  const { page, ctx, errors } = await newPage({ size });
  await check(`Layout ${size} (${VIEWPORTS[size].viewport.width}×${VIEWPORTS[size].viewport.height}): neue Spiele ohne Querscrollen, Bedienelemente sichtbar`, async () => {
    for (const id of ["plinko", "grabber", "horses", "cyclone", "blackjack"]) {
      await openGame(page, id);
      assert(await noHorizontalScroll(page), `${id}: horizontaler Scrollbalken`);
      const vis = await page.evaluate((sel) => {
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
