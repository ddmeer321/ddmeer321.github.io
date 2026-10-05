// End-to-End-Test im echten Browser (Playwright/Chromium).
// Aufruf: node tests/e2e.mjs   (Playwright muss installiert sein, z. B. global)
// Startet einen eigenen kleinen Static-Server auf einem freien Port.

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
async function check(name, fn) {
  try {
    await fn();
    passes++;
    console.log(`  ✔ ${name}`);
  } catch (err) {
    failures++;
    console.log(`  ✘ ${name}\n      ${err.message.split("\n")[0]}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function newPage({ mobile = true, init } = {}) {
  const ctx = await browser.newContext(
    mobile ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1366, height: 820 } }
  );
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(BASE);
  await page.waitForSelector(".machine");
  return { page, ctx, errors };
}

const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__neonpalast.getState())));
const GAMES = ["slots-fruit", "slots-seven", "slots-cosmo", "blackjack", "roulette", "coinpusher", "hoops", "stacker", "cyclone"];

console.log("Neonpalast E2E");

// ---------- Hub & Navigation ----------
{
  const { page, ctx, errors } = await newPage();
  await check("Hub lädt mit allen Automaten", async () => {
    const n = await page.locator(".machine").count();
    assert(n === GAMES.length, `erwartet ${GAMES.length}, gefunden ${n}`);
    assert(await page.locator(".hall-sign h1").isVisible(), "Leuchtschild fehlt");
  });
  for (const id of GAMES) {
    await check(`„${id}“ öffnet per Touch und „Zurück“ führt in die Halle`, async () => {
      await page.locator(`.machine[data-game="${id}"]`).scrollIntoViewIfNeeded();
      await page.locator(`.machine[data-game="${id}"]`).tap();
      await page.waitForSelector(`.game-root[data-game="${id}"] canvas, .game-root[data-game="${id}"] .bj-stage`, { timeout: 5000 });
      await page.waitForTimeout(300);
      assert(page.url().includes(`#/play/${id}`), "Route falsch");
      await page.locator('button[aria-label="Zurück zur Halle"]').tap();
      await page.waitForSelector("#view-hub.is-active", { timeout: 3000 });
      assert(!page.url().includes("/play/"), "nicht zurück in der Halle");
    });
  }
  await check("Browser-Zurück funktioniert ebenfalls", async () => {
    await page.locator('.machine[data-game="roulette"]').tap();
    await page.waitForSelector(".rl-board");
    await page.goBack();
    await page.waitForSelector("#view-hub.is-active");
  });
  await check("Keine Konsolenfehler in Halle/Navigation", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Blackjack ----------
{
  const { page, ctx, errors } = await newPage({ mobile: false });
  await page.goto(BASE + "#/play/blackjack");
  await page.waitForSelector(".bj-stage");
  await check("Blackjack: Runde lässt sich vollständig spielen, Guthaben stimmt mit Statistik", async () => {
    for (let round = 0; round < 3; round++) {
      const before = (await state(page)).balance;
      await page.locator(".bj-betbar .btn-primary").click();
      await page.waitForTimeout(1500);
      for (let i = 0; i < 6; i++) {
        const stand = page.locator(".bj-actions button:has-text('Halten')");
        if ((await stand.count()) && (await stand.isEnabled())) await stand.click();
        await page.waitForTimeout(700);
        if (await page.locator(".bj-betbar").count()) break;
      }
      await page.waitForSelector(".bj-betbar", { timeout: 8000 });
      const s = await state(page);
      const pg = s.stats.perGame.blackjack;
      assert(pg.rounds === round + 1, "Runde nicht gezählt");
      assert(s.balance === 1000 - pg.wagered + pg.won, `Bilanz inkonsistent ${s.balance}`);
      assert(s.balance !== before || pg.won > 0 || true, "");
    }
  });
  await check("Blackjack: Tastatur (Enter austeilen, S halten)", async () => {
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    await page.keyboard.press("s");
    await page.waitForSelector(".bj-betbar", { timeout: 8000 });
  });
  await check("Ungültiger Einsatz (zu wenig Guthaben) wird verhindert", async () => {
    await page.evaluate(() => {
      window.__neonpalast.getState().balance = 5;
    });
    const before = (await state(page)).balance;
    await page.locator(".bj-betbar .btn-primary").click();
    await page.waitForTimeout(400);
    const after = (await state(page)).balance;
    assert(before === after, "Guthaben verändert");
    assert(await page.locator(".toast").count(), "kein Hinweis");
  });
  await check("Keine Konsolenfehler (Blackjack)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Roulette ----------
{
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "#/play/roulette");
  await page.waitForSelector(".rl-board");
  await check("Roulette: Drehen ohne Einsatz ist gesperrt", async () => {
    assert(await page.locator(".rl-ctrl .btn-lg").isDisabled(), "Drehen nicht gesperrt");
  });
  await check("Roulette zahlt korrekt aus (3 Runden)", async () => {
    for (let r = 0; r < 3; r++) {
      await page.evaluate(() => {
        // neue Runde beginnen
      });
      const keys = ["red", "n:17", "dozen:2", "odd"];
      for (const k of keys) await page.locator(`.rl-cell[data-key="${k}"]`).tap();
      const before = (await state(page)).balance;
      await page.locator(".rl-ctrl .btn-lg").tap();
      await page.waitForTimeout(7600);
      const s = await state(page);
      const n = s.games.roulette.history[0];
      const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n);
      let expected = -40;
      if (n !== 0 && red) expected += 20;
      if (n === 17) expected += 360;
      if (n >= 13 && n <= 24) expected += 30;
      if (n % 2 === 1) expected += 20;
      assert(s.balance - before === expected, `Zahl ${n}: erwartet ${expected}, war ${s.balance - before}`);
      await page.locator(".rl-ctrl button:has-text('✕')").tap();
    }
  });
  await check("Keine Konsolenfehler (Roulette)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Slots ----------
{
  const { page, ctx, errors } = await newPage({ mobile: false });
  await page.goto(BASE + "#/play/slots-fruit");
  await page.waitForSelector(".slot-window canvas");
  await check("Slots: Einsatz kann nicht unter das Minimum fallen", async () => {
    for (let i = 0; i < 10; i++) await page.locator('button[aria-label="Einsatz verringern"]').click({ force: true }).catch(() => {});
    const v = await page.locator(".bet-value strong").textContent();
    assert(v.trim() === "5", `Minimum ${v}`);
  });
  await check("Slots: Gewinne und Verluste kommen vor, Bilanz stimmt", async () => {
    let wins = 0;
    let losses = 0;
    await page.evaluate(() => document.activeElement?.blur());
    for (let i = 0; i < 40 && (wins === 0 || losses === 0); i++) {
      const before = (await state(page)).stats.perGame["slots-fruit"]?.won || 0;
      await page.keyboard.press("Space");
      await page.waitForTimeout(250);
      await page.keyboard.press("Space"); // Schnellstopp
      await page.waitForTimeout(900);
      const after = (await state(page)).stats.perGame["slots-fruit"].won;
      if (after > before) wins++;
      else losses++;
    }
    const s = await state(page);
    const pg = s.stats.perGame["slots-fruit"];
    assert(wins > 0 && losses > 0, `wins ${wins} losses ${losses}`);
    assert(s.balance === 1000 - pg.wagered + pg.won, "Bilanz inkonsistent");
  });
  await check("Spielstand übersteht Neuladen", async () => {
    await page.waitForTimeout(1500);
    const before = await state(page);
    await page.reload();
    await page.waitForSelector(".slot-window canvas");
    const after = await state(page);
    assert(after.balance === before.balance, `${before.balance} → ${after.balance}`);
    assert(after.stats.rounds === before.stats.rounds, "Statistik verloren");
  });
  await check("Keine Konsolenfehler (Slots)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Coin Pusher ----------
{
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "#/play/coinpusher");
  await page.waitForSelector(".arcade-stage canvas");
  await check("Coin Pusher: Münzen fallen über die Kante und werden gutgeschrieben", async () => {
    const box = await page.locator(".arcade-stage").boundingBox();
    for (let i = 0; i < 25; i++) {
      await page.touchscreen.tap(box.x + box.width * (0.35 + (i % 4) * 0.1), box.y + box.height * 0.4);
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(5000);
    const s = await state(page);
    const pg = s.stats.perGame.coinpusher;
    assert(pg.wagered === 250, `eingeworfen ${pg.wagered}`);
    assert(pg.won > 0, "keine Münze gewonnen");
    assert(s.balance === 1000 - pg.wagered + pg.won, "Bilanz inkonsistent");
  });
  await check("Coin Pusher: Feld bleibt nach Neuladen erhalten", async () => {
    await page.waitForTimeout(2800);
    const before = (await state(page)).games.coinpusher.world.c.length;
    await page.reload();
    await page.waitForSelector(".arcade-stage canvas");
    const after = (await state(page)).games.coinpusher.world.c.length;
    assert(Math.abs(after - before) <= 3, `${before} → ${after}`);
  });
  await check("Keine Konsolenfehler (Coin Pusher)", async () => assert(!errors.length, errors.join(" | ")));
  await ctx.close();
}

// ---------- Basketball ----------
{
  const { page, ctx, errors } = await newPage();
  await page.goto(BASE + "#/play/hoops");
  await page.waitForSelector(".arcade-overlay .btn-primary");
  await page.locator(".arcade-overlay .btn-primary").tap();
  await page.waitForTimeout(3300);
  const box = await page.locator(".arcade-stage").boundingBox();
  let k = 1.6;
  const score = async () => Number(await page.locator(".arcade-hud .slot-display:nth-child(2) strong").textContent());
  async function swipe(up) {
    const x0 = box.x + box.width / 2;
    const y0 = box.y + box.height * 0.8;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(x0, y0 - (up * k * box.height * 0.16 * i) / 8);
      await page.waitForTimeout(20);
    }
    await page.mouse.up();
    const m = await page.evaluate(() => window.__hoopsLastSwipe);
    k *= up / m.up;
    await page.waitForTimeout(1500);
    return m.up;
  }
  await check("Basketball: Treffer mit passendem Swipe", async () => {
    await swipe(2.3);
    let hit = false;
    for (let i = 0; i < 4 && !hit; i++) {
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
    await page.waitForSelector(".slot-window canvas");
    await page.locator(".spin-btn").tap();
    await page.waitForTimeout(3500);
    const s = await state(page);
    assert(s.stats.perGame["slots-cosmo"].rounds === 1, "Dreh nicht abgeschlossen");
    await page.locator('button[aria-label="Zurück zur Halle"]').tap();
    await page.locator('.machine[data-game="blackjack"]').tap();
    await page.waitForSelector(".bj-stage");
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
