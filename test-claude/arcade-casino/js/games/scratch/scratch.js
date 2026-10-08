// Rubbellose – Tisch in der Palast-Lounge.
// Links der Losverkauf, rechts der eigene Tisch, auf dem gekaufte Lose liegen.
// Ein Los antippen → es kommt groß nach vorn, der Tisch verschwimmt dahinter,
// und das Los wird mit Finger oder Maus freigerubbelt. Danach: Gewinn
// einfordern bzw. Niete ablegen. Ergebnis und Mathematik: tickets.js.

import { h, clear } from "../../ui/dom.js";
import * as S from "./tickets.js";

const LOOK = {
  neon7: { badge: "7", note: "3 gleiche Beträge gewinnen" },
  lucky: { badge: "🍀", note: "Deine Zahl = Gewinnzahl" },
  vault: { badge: "💎", note: "Finde den Diamanten" },
};
const BRUSH = 17; // Rubbel-Radius in CSS-Pixeln
const REVEAL_AT = 0.55; // Anteil eines Feldes, ab dem es als aufgedeckt gilt

const de = (n, d = 1) => n.toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (x) => `${de(x * 100)} %`;
const oneIn = (p) => `1 : ${de(1 / p)}`;

export default {
  mount(root, ctx) {
    const { play, haptic, fmt } = ctx;
    // Spielstand bereinigen (Gewinn immer aus dem Losbild, nichts wird neu gewürfelt)
    const clean = S.sanitizeData(ctx.data);
    for (const k of Object.keys(ctx.data)) delete ctx.data[k];
    Object.assign(ctx.data, clean);
    const sc = S.createScratch({ getData: () => ctx.data, economy: ctx.economy, saveNow: ctx.saveNow, save: ctx.save });

    let focus = null; // offene Großansicht
    let dead = false;

    // ---------- Aufbau ----------
    const shopList = h("div.sc-offers", { role: "list" });
    const count = h("small.sc-count.num");
    const shop = h(
      "aside.sc-shop",
      { "aria-label": "Losverkauf" },
      h("h3", {}, "Losverkauf"),
      shopList,
      count,
      rulesBox()
    );
    const pile = h("div.sc-pile", { role: "list", "aria-label": "Lose auf deinem Tisch" });
    const empty = h("p.sc-empty", {}, "Dein Tisch ist leer. Kauf links ein Los – es landet hier vor dir.");
    const table = h("section.sc-table", { "aria-label": "Dein Tisch" }, h("div.sc-felt", {}, empty, pile));
    const world = h("div.sc-world", {}, shop, table);
    const stage = h("div.game-stage.sc-stage", {}, world);
    root.append(stage);

    for (const id of S.TYPE_IDS) {
      const t = S.TYPES[id];
      const btn = h("button.btn.btn-gold.btn-sm.sc-buy", { type: "button", dataset: { type: id } }, `Kaufen · ${fmt(t.price)} C`);
      btn.addEventListener("click", () => buy(id, btn));
      shopList.append(
        h(
          `div.sc-offer.t-${id}`,
          { role: "listitem" },
          h("div.sc-offer-art", { "aria-hidden": "true" }, h("b", {}, LOOK[id].badge), h("span", {}, t.name)),
          h(
            "div.sc-offer-info",
            {},
            h("strong", {}, t.name),
            h("small", {}, LOOK[id].note),
            h("small", {}, `bis ${fmt(S.topPrize(id))} C · Gewinn ${oneIn(S.pAnyWin(id))}`)
          ),
          btn
        )
      );
    }

    function rulesBox() {
      return h(
        "details.sc-rules",
        {},
        h("summary", {}, "Gewinnpläne & Chancen"),
        S.TYPE_IDS.map((id) => {
          const t = S.TYPES[id];
          return h(
            "div",
            {},
            h("h4", {}, `${t.name} · ${fmt(t.price)} C`),
            h("p.sc-muted", {}, t.rule),
            h(
              "table",
              {},
              h("thead", {}, h("tr", {}, h("th", {}, "Gewinn"), h("th", {}, "Chance je Los"))),
              h(
                "tbody",
                {},
                t.prizes.map(([a, p]) => h("tr", {}, h("td.num", {}, a === t.price ? `${fmt(a)} C (Einsatz zurück)` : `${fmt(a)} C`), h("td.num", {}, oneIn(p)))),
                h("tr.sc-total", {}, h("td", {}, "irgendein Gewinn"), h("td.num", {}, oneIn(S.pAnyWin(id))))
              )
            ),
            h("small.sc-muted", {}, `Auszahlungsquote ${pct(S.rtpOf(id))} – Rubbellose sind ein Ausgabeposten.`)
          );
        }),
        h("p.sc-muted", {}, `Höchstens ${S.MAX_ON_TABLE} Lose liegen gleichzeitig auf dem Tisch. Das Ergebnis jedes Loses wird beim Kauf einmal ausgelost und gespeichert – Rubbeln deckt es nur auf.`)
      );
    }

    // ---------- Kaufen ----------
    function buy(type, btn) {
      const blocked = ctx.blockReason();
      if (blocked) {
        play("ui.error");
        ctx.toast(`${blocked} – keine Lose.`, { icon: "⏸️" });
        return;
      }
      const r = sc.buy(type);
      if (!r.ok) {
        play("ui.error");
        haptic("impulse");
        ctx.toast(r.reason, { icon: "⚠️", tone: "red" });
        return;
      }
      play("coin.insert");
      play("card.deal", { delay: 0.08 });
      haptic("tap");
      ctx.report("scratch:buy", { type });
      renderTable(r.ticket.id);
      const b = btn.getBoundingClientRect();
      ctx.particles.floatText(b.left + b.width / 2, b.top, `−${fmt(r.ticket.price)}`, "#b7a8d6");
    }

    // ---------- Tisch ----------
    function progressOf(t) {
      const n = t.revealed.filter(Boolean).length;
      return n === 0 ? "neu" : n === t.revealed.length ? "aufgedeckt" : `${n}/${t.revealed.length} Felder`;
    }

    function renderTable(newId = null) {
      if (dead) return;
      clear(pile);
      const list = sc.tickets();
      empty.hidden = list.length > 0;
      for (const t of list) {
        const open = sc.isOpen(t.id);
        const mini = h(
          `button.sc-mini.t-${t.type}${open ? ".is-open" : ""}${t.id === newId ? ".is-new" : ""}`,
          {
            type: "button",
            role: "listitem",
            dataset: { id: t.id },
            style: { "--rot": `${t.rot}deg`, "--dx": `${t.dx}px`, "--dy": `${t.dy}px` },
            "aria-label": `${S.TYPES[t.type].name} – ${progressOf(t)}`,
          },
          h("span.sc-mini-head", {}, h("b", {}, LOOK[t.type].badge), S.TYPES[t.type].name),
          h(`span.sc-mini-foil${t.revealed.some(Boolean) ? ".is-scratched" : ""}`, { "aria-hidden": "true" }),
          h("span.sc-mini-state", {}, open ? "aufgedeckt · einfordern" : progressOf(t))
        );
        mini.addEventListener("click", () => openTicket(t.id));
        pile.append(mini);
      }
      count.textContent = `${list.length}/${S.MAX_ON_TABLE} Lose auf dem Tisch`;
      const full = list.length >= S.MAX_ON_TABLE;
      const blocked = ctx.blockReason();
      shopList.querySelectorAll(".sc-buy").forEach((b) => {
        const t = S.TYPES[b.dataset.type];
        b.disabled = full || Boolean(blocked) || ctx.economy.balance < t.price;
        b.textContent = blocked ? "Pause" : full ? "Tisch voll" : `Kaufen · ${fmt(t.price)} C`;
      });
      if (!focus) ctx.setPhase("idle");
    }

    // ---------- Großansicht & Rubbeln ----------
    function fieldsFor(t) {
      const L = t.layout;
      const def = S.TYPES[t.type];
      if (def.mechanic === "match3") return L.cells.map((a) => ({ main: fmt(a), sub: "C", win: t.prize > 0 && a === t.prize }));
      if (def.mechanic === "numbers") {
        const hit = L.own.find((o) => L.win.includes(o.n));
        return [
          ...L.win.map((n) => ({ main: String(n), sub: "", win: hit?.n === n, cls: "is-winno" })),
          ...L.own.map((o) => ({ main: String(o.n), sub: `${fmt(o.amount)} C`, win: hit === o })),
        ];
      }
      return L.cells.map((c) => ({ main: c.s, sub: c.s === S.DIAMOND ? `${fmt(c.amount)} C` : "", win: c.s === S.DIAMOND, cls: "is-symbol" }));
    }

    function openTicket(id) {
      const t = sc.get(id);
      if (!t || focus) return;
      const def = S.TYPES[t.type];
      play("card.flip");
      haptic("tick");
      const fields = fieldsFor(t);
      const cells = fields.map((f, i) =>
        h(`div.sc-field${f.cls ? "." + f.cls : ""}`, { dataset: { i } }, h("b", {}, f.main), f.sub ? h("small", {}, f.sub) : null)
      );
      let area;
      if (def.mechanic === "numbers") {
        area = h(
          "div.sc-area.m-numbers",
          {},
          h("div.sc-winrow", {}, h("span.sc-label", {}, "Gewinnzahlen"), cells[0], cells[1]),
          h("div.sc-label.sc-own-label", {}, "Deine Zahlen"),
          h("div.sc-grid.g-3", {}, cells.slice(2))
        );
      } else area = h(`div.sc-area.m-${def.mechanic}`, {}, h(`div.sc-grid.g-3`, {}, cells));
      const foil = h("canvas.sc-foil", { "aria-hidden": "true" });
      area.append(foil);
      const status = h("div.sc-status", { role: "status", "aria-live": "polite" }, "Rubbeln mit Finger oder Maus");
      const card = h(
        `div.sc-card.t-${t.type}`,
        {},
        h("header.sc-card-head", {}, h("b.sc-badge", { "aria-hidden": "true" }, LOOK[t.type].badge), h("strong", {}, def.name), h("span.num", {}, `${fmt(def.price)} C`)),
        h("p.sc-rule", {}, def.rule),
        area,
        status
      );
      const actions = h("div.sc-actions");
      const layer = h("div.sc-focus", { role: "dialog", "aria-modal": "true", "aria-label": `${def.name} aufrubbeln` }, card, actions);
      root.append(layer);
      world.classList.add("is-blurred");
      world.inert = true;

      // ----- Rubbel-Schicht -----
      const g = foil.getContext("2d");
      let rects = []; // Feldrechtecke relativ zur Fläche
      let samples = []; // je Feld: Messpunkte [x, y, frei?]
      let dpr = 1;
      let scratching = false;
      let last = null;
      let sound = null;
      const trail = []; // bisherige Rubbelpunkte – werden nach einem Neu-Layout wieder eingespielt

      // Geometrie über offset* (unabhängig von Einblend-Animationen/Transforms)
      function offsetIn(el) {
        let x = 0;
        let y = 0;
        for (let n = el; n && n !== area; n = n.offsetParent) {
          x += n.offsetLeft;
          y += n.offsetTop;
        }
        return { x, y, w: el.offsetWidth, h: el.offsetHeight };
      }
      function layoutFoil() {
        const aw = area.clientWidth;
        const ah = area.clientHeight;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        foil.width = Math.max(1, Math.round(aw * dpr));
        foil.height = Math.max(1, Math.round(ah * dpr));
        rects = cells.map(offsetIn);
        samples = rects.map((r) => {
          const pts = [];
          for (let iy = 0; iy < 5; iy++) for (let ix = 0; ix < 6; ix++) pts.push([r.x + ((ix + 0.5) / 6) * r.w, r.y + ((iy + 0.5) / 5) * r.h, false]);
          return pts;
        });
        paintFoil(aw, ah);
        for (const [x, y] of trail) stamp(x, y, false);
      }
      function paintFoil(w, hh) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.globalCompositeOperation = "source-over";
        const grad = g.createLinearGradient(0, 0, w, hh);
        grad.addColorStop(0, "#d9dce6");
        grad.addColorStop(0.45, "#9aa0b2");
        grad.addColorStop(0.55, "#c5c9d6");
        grad.addColorStop(1, "#80869a");
        g.fillStyle = grad;
        for (const r of rects) g.fillRect(r.x, r.y, r.w, r.h);
        // feines Muster + Beschriftung je Feld
        g.fillStyle = "rgba(255,255,255,.18)";
        for (const r of rects) for (let yy = r.y + 4; yy < r.y + r.h; yy += 7) for (let xx = r.x + ((yy / 7) % 2) * 4 + 3; xx < r.x + r.w; xx += 9) g.fillRect(xx, yy, 1.5, 1.5);
        g.fillStyle = "rgba(40,40,60,.38)";
        g.font = "900 11px system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        for (const r of rects) g.fillText("★ RUBBELN ★", r.x + r.w / 2, r.y + r.h / 2);
        // bereits aufgedeckte Felder (z. B. nach dem Neuladen) wieder frei
        t.revealed.forEach((v, i) => v && clearField(i));
      }
      function clearField(i) {
        const r = rects[i];
        if (!r) return;
        g.clearRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
        cells[i].classList.add("is-revealed");
      }
      function stamp(x, y, record = true) {
        if (record) trail.push([x, y]);
        g.globalCompositeOperation = "destination-out";
        g.beginPath();
        g.arc(x, y, BRUSH, 0, Math.PI * 2);
        g.fill();
        let changed = false;
        samples.forEach((pts, i) => {
          if (t.revealed[i]) return;
          for (const p of pts) if (!p[2] && (p[0] - x) ** 2 + (p[1] - y) ** 2 <= BRUSH * BRUSH) p[2] = true;
          if (pts.filter((p) => p[2]).length / pts.length >= REVEAL_AT) {
            clearField(i);
            changed = true;
            play("ui.tap", { pitch: 1.3 + i * 0.04, vol: 0.5 });
            haptic("tick");
            if (sc.reveal(t.id, i)) finish();
          }
        });
        if (changed) updateStatus();
      }
      function strokeTo(x, y) {
        if (!last) return stamp(x, y);
        const dx = x - last[0];
        const dy = y - last[1];
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (BRUSH / 2)));
        for (let k = 1; k <= steps && focus?.id === t.id && !focus.done; k++) stamp(last[0] + (dx * k) / steps, last[1] + (dy * k) / steps);
      }
      const pos = (e) => {
        const r = foil.getBoundingClientRect(); // auf CSS-Maß der Fläche zurückrechnen (falls skaliert)
        return [((e.clientX - r.left) * foil.clientWidth) / (r.width || 1), ((e.clientY - r.top) * foil.clientHeight) / (r.height || 1)];
      };
      foil.addEventListener("pointerdown", (e) => {
        if (focus?.done) return;
        e.preventDefault();
        foil.setPointerCapture?.(e.pointerId);
        scratching = true;
        last = null;
        const [x, y] = pos(e);
        strokeTo(x, y);
        last = [x, y];
        sound = ctx.loop?.({ filter: "highpass", f: 2600, q: 0.7, gain: 0.03 }) || null;
      });
      foil.addEventListener("pointermove", (e) => {
        if (!scratching || focus?.done) return;
        const [x, y] = pos(e);
        strokeTo(x, y);
        last = [x, y];
      });
      const end = () => {
        scratching = false;
        last = null;
        sound?.stop();
        sound = null;
      };
      foil.addEventListener("pointerup", end);
      foil.addEventListener("pointercancel", end);

      // ----- Knöpfe -----
      const revealBtn = h("button.btn.btn-ghost.sc-reveal", { type: "button" }, "Alles aufdecken");
      const backBtn = h("button.btn.btn-ghost.sc-back-table", { type: "button" }, "Zurück zum Tisch");
      revealBtn.addEventListener("click", () => {
        sc.revealAll(t.id);
        t.revealed.forEach((_, i) => clearField(i));
        play("card.flip");
        finish();
      });
      backBtn.addEventListener("click", () => closeFocus());
      actions.append(revealBtn, backBtn);

      function updateStatus() {
        if (focus?.done) return;
        const n = t.revealed.filter(Boolean).length;
        status.textContent = n ? `${n} von ${t.revealed.length} Feldern frei` : "Rubbeln mit Finger oder Maus";
      }

      function finish() {
        if (!focus || focus.done) return;
        focus.done = true;
        end();
        foil.classList.add("is-gone");
        cells.forEach((c, i) => fields[i].win && c.classList.add("is-win"));
        clear(actions);
        const net = t.prize - t.price;
        if (t.prize > 0) {
          status.replaceChildren(h("b.sc-result.is-win", {}, net > 0 ? "GEWONNEN" : "EINSATZ ZURÜCK"), h("span.num", {}, ` ${fmt(t.prize)} C`));
          const claim = h("button.btn.btn-gold.btn-lg.sc-claim", { type: "button" }, net > 0 ? "Gewinn einfordern" : "Einsatz einfordern");
          claim.addEventListener("click", () => {
            if (claim.disabled) return;
            claim.disabled = true; // Doppelklick: zweiter Klick trifft einen gesperrten Knopf
            const paid = sc.resolve(t.id);
            if (paid > 0) {
              const r = claim.getBoundingClientRect();
              if (paid > t.price) ctx.celebrate({ stake: t.price, payout: paid, x: r.left + r.width / 2, y: r.top, title: "Eingefordert!", detail: def.name });
              else {
                play("coin.land");
                haptic("tap");
                ctx.particles.coinsToBalance(r.left + r.width / 2, r.top, 6);
              }
            }
            closeFocus(true);
          });
          actions.append(claim);
          play(net > 0 ? "win.small" : "coin.clink");
          ctx.setPhase(net > 0 ? "win" : "push");
          setTimeout(() => !dead && claim.focus(), 60);
        } else {
          status.replaceChildren(h("b.sc-result.is-lose", {}, "LEIDER KEIN GEWINN"));
          const drop = h("button.btn.btn-danger.btn-lg.sc-drop", { type: "button" }, "Los ablegen");
          drop.addEventListener("click", () => {
            if (drop.disabled) return;
            drop.disabled = true;
            sc.resolve(t.id);
            play("ui.back");
            closeFocus(true);
          });
          actions.append(drop);
          play("lotto.end", { vol: 0.6 });
          ctx.setPhase("lose");
          setTimeout(() => !dead && drop.focus(), 60);
        }
      }

      const onKey = (e) => {
        if (e.key === "Escape") closeFocus();
      };
      const onResize = () => focus?.id === t.id && !focus.done && layoutFoil();
      document.addEventListener("keydown", onKey);
      window.addEventListener("resize", onResize);
      // Layout kann sich nach dem Einblenden noch setzen (Schriften, Emoji) – dann neu ausrichten
      card.addEventListener("animationend", onResize, { once: true });
      document.fonts?.ready?.then(onResize);
      const ro = typeof ResizeObserver === "function" ? new ResizeObserver(onResize) : null;
      ro?.observe(area);
      focus = {
        id: t.id,
        done: false,
        layer,
        cleanup() {
          end();
          document.removeEventListener("keydown", onKey);
          window.removeEventListener("resize", onResize);
          ro?.disconnect();
        },
      };
      ctx.setPhase("scratch");
      layoutFoil();
      updateStatus();
      if (sc.isOpen(t.id)) finish(); // schon komplett aufgedeckt (z. B. weggelegt und zurückgekommen)
      revealBtn.focus({ preventScroll: true });
    }

    function closeFocus(resolved = false) {
      if (!focus) return;
      const f = focus;
      focus = null;
      f.cleanup();
      f.layer.classList.add("is-leaving");
      world.classList.remove("is-blurred");
      world.inert = false;
      setTimeout(() => f.layer.remove(), ctx.reducedMotion() ? 0 : 220);
      if (!resolved) play("ui.back");
      renderTable();
    }

    ctx.setHelp(() =>
      ctx.openModal({
        title: "Rubbellose",
        body: h(
          "div.help-text",
          {},
          h("p", {}, "Kauf links im Losverkauf ein Los – es landet auf deinem Tisch. Tipp ein Los an, um es nach vorn zu holen, und rubbel die Felder mit Finger oder Maus frei. „Alles aufdecken“ deckt sofort alles auf."),
          S.TYPE_IDS.map((id) => h("p", {}, h("b", {}, `${S.TYPES[id].name} (${fmt(S.TYPES[id].price)} C): `), `${S.TYPES[id].rule}. Höchstgewinn ${fmt(S.topPrize(id))} C, irgendein Gewinn ${oneIn(S.pAnyWin(id))}, Auszahlungsquote ${pct(S.rtpOf(id))}.`)),
          h("p", {}, "Das Ergebnis jedes Loses wird beim Kauf einmal ausgelost und gespeichert. Rubbeln, Weglegen oder Neuladen ändern nichts daran. Nieten sind zufällige Nieten – es werden keine „Beinahe-Gewinne“ eingebaut."),
          h("p", {}, `Gewinne forderst du selbst ein. Höchstens ${S.MAX_ON_TABLE} Lose liegen gleichzeitig auf dem Tisch.`)
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      })
    );

    const offBalance = () => !focus && renderTable();
    const unsub = ctx.economy.subscribe?.(offBalance);
    renderTable();

    return {
      destroy() {
        dead = true;
        if (focus) {
          focus.cleanup();
          focus = null;
        }
        unsub?.();
      },
    };
  },
};
