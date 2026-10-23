// Casino-Halle: baut die Bereiche mit ihren Automaten auf und hält eine kleine
// Ambient-Animation (Bokeh-Lichter) am Laufen, solange die Halle sichtbar ist.

import { h, clear } from "../ui/dom.js";
import { ART } from "./machines.js";
import { GAMES, ZONES, FIXTURES } from "../games/registry.js";
import { fmt } from "../ui/format.js";

export function createHub(root, { onOpen, onFixture, renderPerks, onStats, onSettings, onControl, getBest, tickerItems }) {
  const ambient = h("canvas.hall-ambient", { "aria-hidden": "true" });
  const perks = h("div.hall-perks");
  const tickerTrack = h("div.ticker-track");
  const ticker = h("div.hall-ticker", { "aria-hidden": "true" }, tickerTrack);
  const zonesEl = h("div.zones");
  const machines = new Map();

  const fixtures = new Map();
  for (const z of ZONES) {
    const floor = h("div.zone-floor");
    for (const f of FIXTURES.filter((x) => x.zone === z.id)) {
      const plate = h("span.machine-plate", {}, h("strong", {}, f.title), h("small.fixture-sub", {}, ""));
      const btn = h(
        `button.machine.m-fixture.fx-${f.id}`,
        { type: "button", dataset: { fixture: f.id }, "aria-label": f.title },
        h("span", { html: ART[f.art](`f-${f.id}`), style: { display: "block", width: "100%" } }),
        plate
      );
      btn.addEventListener("click", () => onFixture?.(f.id, btn));
      fixtures.set(f.id, btn);
      floor.append(btn);
    }
    for (const g of GAMES.filter((x) => x.zone === z.id)) {
      const btn = h(
        `button.machine${g.table ? ".m-table" : ""}${g.wide ? ".m-wide" : ""}`,
        { type: "button", dataset: { game: g.id }, "aria-label": `${g.title} öffnen – ${g.blurb}` },
        h("span", { html: ART[g.art](`m-${g.id}`), style: { display: "block", width: "100%" } }),
        h("span.machine-plate", {}, h("strong", {}, g.title), h("small", {}, g.blurb))
      );
      btn.addEventListener("click", () => onOpen(g, btn));
      machines.set(g.id, btn);
      floor.append(btn);
    }
    zonesEl.append(h(`section.zone.zone-${z.id}`, { "aria-label": z.title }, h("h2.zone-sign", {}, z.title), floor));
  }

  const hall = h(
    "div.hall",
    {},
    ambient,
    h(
      "header.hall-sign",
      {},
      h("h1", { html: 'NEON<span class="flick">P</span>ALAST' }),
      h("p", {}, "Arcade · Casino · nur Spielgeld")
    ),
    ticker,
    perks,
    zonesEl,
    h(
      "div.hall-footer",
      {},
      h("button.btn.btn-ghost", { type: "button", onclick: onStats }, "🏆 Erfolge & Statistik"),
      h("button.btn.btn-ghost", { type: "button", onclick: onSettings }, "⚙️ Einstellungen"),
      h("button.btn.btn-ghost", { type: "button", onclick: onControl }, "⏸️ Spielkontrolle & Hilfe")
    ),
    h(
      "p.hall-note",
      {},
      "Neonpalast verwendet ausschließlich virtuelles Spielgeld ohne realen Wert. Es gibt keine Käufe, keine Auszahlungen und keine Gewinne in echtem Geld. ",
      h("a", { href: "../index.html" }, "Zur Spielebibliothek"),
      " · ",
      // Absolute Pfade: die Halle liegt im oeffentlichen Spiel eine Ebene tief,
      // im Testbereich zwei -- die Rechtsseiten stehen aber immer im Wurzelverzeichnis.
      h("a", { href: "/datenschutz.html" }, "Datenschutz"),
      " · ",
      h("a", { href: "/impressum.html" }, "Impressum")
    )
  );
  root.append(hall);

  // ---------- Bestwert-Badges ----------
  function refreshBadges() {
    for (const g of GAMES) {
      if (!g.best) continue;
      const btn = machines.get(g.id);
      btn.querySelector(".machine-best")?.remove();
      const b = getBest(g.best);
      if (b > 0) btn.append(h("span.badge.machine-best.num", {}, `Best ${fmt(b)}`));
    }
  }

  // ---------- Ambient-Licht ----------
  const actx = ambient.getContext("2d");
  let dots = [];
  let raf = 0;
  let lastT = 0;
  let visible = false;
  let reduced = false;

  function sizeAmbient() {
    const r = hall.getBoundingClientRect();
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    ambient.width = Math.round(r.width * dpr);
    ambient.height = Math.round(r.height * dpr);
    actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(46, (r.width * r.height) / 26000));
    const colors = ["#ff3d9a", "#2de2e6", "#ffc53d", "#9b5cff"];
    dots = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * r.width,
      y: Math.random() * r.height,
      r: 1 + Math.random() * 3.5,
      vy: -(4 + Math.random() * 12),
      vx: (Math.random() - 0.5) * 6,
      a: 0.15 + Math.random() * 0.35,
      ph: Math.random() * 6.28,
      c: colors[i % colors.length],
    }));
  }

  function drawAmbient(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.1, (now - lastT) / 1000 || 0);
    if (now - lastT < 32) {
      raf = requestAnimationFrame(drawAmbient);
      return;
    }
    lastT = now;
    const w = ambient.width;
    const hh = ambient.height;
    actx.clearRect(0, 0, w, hh);
    const cw = hall.clientWidth;
    const ch = hall.clientHeight;
    for (const d of dots) {
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      d.ph += dt;
      if (d.y < -10) {
        d.y = ch + 10;
        d.x = Math.random() * cw;
      }
      actx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(d.ph * 1.3));
      actx.fillStyle = d.c;
      actx.beginPath();
      actx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      actx.fill();
    }
    actx.globalAlpha = 1;
    raf = requestAnimationFrame(drawAmbient);
  }

  function startAmbient() {
    if (reduced) {
      actx.clearRect(0, 0, ambient.width, ambient.height);
      return;
    }
    if (!raf) {
      lastT = performance.now();
      raf = requestAnimationFrame(drawAmbient);
    }
  }

  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => sizeAmbient());
    ro.observe(hall);
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && visible) startAmbient();
  });

  function refreshTicker() {
    const items = tickerItems();
    // zweimal hintereinander für nahtlose Endlosschleife
    tickerTrack.replaceChildren(...[...items, ...items].map((t) => h("span", {}, t)));
    tickerTrack.style.animationDuration = `${Math.max(18, items.join(" ").length * 0.22)}s`;
  }

  return {
    show() {
      visible = true;
      refreshTicker();
      clear(perks);
      const p = renderPerks();
      if (p) perks.append(...[].concat(p));
      refreshBadges();
      sizeAmbient();
      startAmbient();
    },
    hide() {
      visible = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    refreshPerks() {
      clear(perks);
      const p = renderPerks();
      if (p) perks.append(...[].concat(p));
    },
    setLocked(v) {
      hall.classList.toggle("is-locked", v);
    },
    setReduced(v) {
      reduced = v;
      if (visible) startAmbient();
    },
    machineEl: (id) => machines.get(id),
    fixtureEl: (id) => fixtures.get(id),
    /** Jukebox-Zustand in der Halle zeigen: gekauft/leuchtend, spielt, Titel. */
    setJukebox({ owned, playing, title, price }) {
      const el = fixtures.get("jukebox");
      if (!el) return;
      el.classList.toggle("is-owned", owned);
      el.classList.toggle("is-playing", playing);
      el.querySelector(".fixture-sub").textContent = owned ? (playing ? `♪ ${title}` : "Bereit · antippen") : `Zu verkaufen · ${price}`;
      el.setAttribute("aria-label", owned ? `Jukebox – ${playing ? `spielt ${title}` : "aus"}` : `Jukebox – zu verkaufen für ${price}`);
      const t = el.querySelector(".jb-title");
      if (t) t.textContent = owned ? (playing ? title.toUpperCase().slice(0, 18) : "BEREIT") : "JUKEBOX";
    },
    /** Lotto-Studio: nächste Ziehung, LIVE, wartende Gewinne. */
    setLotto({ line1, line2, line3, live, attention, blurb }) {
      const el = machines.get("lotto");
      if (!el) return;
      el.classList.toggle("is-live", Boolean(live));
      el.classList.toggle("has-attention", Boolean(attention));
      const set = (sel, v) => {
        const n = el.querySelector(sel);
        if (n && v !== undefined) n.textContent = v;
      };
      set(".lt-next", line1);
      set(".lt-time", line2);
      set(".lt-sub", line3);
      if (blurb !== undefined) el.querySelector(".machine-plate small").textContent = blurb;
    },
  };
}
