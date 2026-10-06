// Neon Lotto – Studio in der Palast-Lounge (V1.2.1).
// Scheine ausfüllen (täglich 4 aus 40, groß 6 aus 49 + Neonzahl), kommende
// Ziehungen, Ergebnisse/Archiv und die Ziehungs-Show. Regeln und Mathematik: core/lotto.js, docs/ECONOMY.md.

import { h, clear } from "../../ui/dom.js";
import { DRAWS, DRAW_TYPES, MAX_TICKETS, combinations, pClass, pAnyWin, rtpOf, topPrize, rulesLabel, rulesFor, rulesVersionOf, formatDrawTime, formatDrawDate, quickPick } from "../../core/lotto.js";
import { playShow, ballEl, neonEl, resultText } from "./show.js";

function countdown(ms) {
  if (ms <= 0) return "jetzt";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `in ${m} Min.`;
  const hh = Math.floor(m / 60);
  if (hh < 48) return `in ${hh} Std. ${m % 60} Min.`;
  return `in ${Math.round(hh / 24)} Tagen`;
}

const pct = (x) => `${(x * 100).toFixed(1).replace(".", ",")} %`;

function oneIn(p) {
  return p > 0 ? `1 : ${Math.round(1 / p).toLocaleString("de-DE")}` : "–";
}

export default {
  mount(root, ctx) {
    const { lotto, play, haptic, fmt } = ctx;
    const data = ctx.data;
    let type = DRAW_TYPES.includes(data.type) ? data.type : "daily";
    let picked = new Set();
    let neon = null; // gewählte Neonzahl (nur Großes Neon Lotto)
    let show = null;
    let dead = false;

    const wrap = h("div.game-stage.lotto-stage");
    root.append(wrap);

    // ---------- Aufbau ----------
    const tabs = h("div.segmented.lt-tabs", { role: "group", "aria-label": "Ziehung wählen" });
    const head = h("section.lt-draw-card");
    const grid = h("div.lt-grid", { role: "group", "aria-label": "Zahlen wählen" });
    const neonGrid = h("div.lt-neongrid", { role: "group", "aria-label": "Neonzahl wählen" });
    const neonPick = h("div.lt-neonpick", {}, h("span", {}, "Neonzahl 0–9"), neonGrid);
    const pickInfo = h("div.lt-pickinfo");
    const buyBtn = h("button.btn.btn-gold.btn-lg.lt-buy", { type: "button" });
    const quickBtn = h("button.btn.btn-ghost", { type: "button" }, "🎲 Zufallszahlen");
    const clearBtn = h("button.btn.btn-ghost", { type: "button" }, "Leeren");
    const mine = h("section.lt-mine");
    const pending = h("section.lt-pending");
    const archive = h("section.lt-archive");
    const builder = h(
      "section.lt-builder",
      {},
      h("h3", {}, "Neuer Schein"),
      grid,
      neonPick,
      pickInfo,
      h("div.lt-builder-actions", {}, quickBtn, clearBtn, buyBtn)
    );
    wrap.append(h("div.lt-col", {}, tabs, head, pending, builder, mine), h("div.lt-col", {}, archive, rulesBox()));

    for (const id of DRAW_TYPES) {
      const b = h("button", { type: "button", dataset: { type: id } }, DRAWS[id].name);
      b.addEventListener("click", () => {
        if (type === id) return;
        type = id;
        data.type = id;
        picked = new Set();
        neon = null;
        play("ui.toggle");
        render();
      });
      tabs.append(b);
    }

    quickBtn.addEventListener("click", () => {
      const q = quickPick(type);
      picked = new Set(q.nums);
      neon = q.neon;
      play("chip.stack");
      haptic("tap");
      render();
    });
    clearBtn.addEventListener("click", () => {
      picked = new Set();
      neon = null;
      play("ui.toggle");
      render();
    });
    buyBtn.addEventListener("click", buy);

    const complete = () => {
      const def = DRAWS[type];
      return picked.size === def.pick && (!def.neon || neon !== null);
    };

    function buy() {
      if (!complete()) return;
      const blocked = ctx.blockReason();
      if (blocked) {
        play("ui.error");
        ctx.toast(`${blocked} – keine Scheine.`, { icon: "⏸️" });
        return;
      }
      const r = lotto.buy(type, [...picked], neon ?? undefined);
      if (!r.ok) {
        play("ui.error");
        haptic("impulse");
        ctx.toast(r.reason, { icon: "⚠️", tone: "red" });
        return;
      }
      play("chip");
      play("coin.insert", { delay: 0.05 });
      haptic("impulse");
      ctx.report("lotto:ticket", { type });
      picked = new Set();
      neon = null;
      render();
      const last = mine.querySelector(".lt-myticket:last-child");
      last?.classList.add("is-new");
    }

    // ---------- Darstellung ----------
    function render() {
      if (dead) return;
      const def = DRAWS[type];
      const next = lotto.nextDraw(type);
      const list = next ? lotto.ticketsFor(next.id) : [];
      tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.type === type)));

      clear(head);
      head.classList.toggle("is-grand", type === "grand");
      head.append(
        h("div.lt-draw-title", {}, h("strong", {}, def.name), h("small", {}, `${def.short} · ${String(def.hour).padStart(2, "0")}:00 Uhr · ${rulesLabel(def)}`)),
        next
          ? h(
              "div.lt-draw-next",
              {},
              h("span", {}, "Nächste Ziehung"),
              h("b", {}, formatDrawTime(next.at)),
              h("small", {}, `${countdown(next.at - Date.now())} · Annahmeschluss 1 Min. vorher`)
            )
          : null,
        h("div.lt-draw-prize", {}, h("span", {}, "Höchstgewinn"), h("b.num", {}, `${fmt(topPrize(def))} C`), h("small", {}, `Schein ${fmt(def.price)} C · 1 : ${Math.round(1 / Math.min(...def.classes.map((c) => pClass(def, c)))).toLocaleString("de-DE")}`))
      );

      // Zahlenfeld
      clear(grid);
      grid.style.setProperty("--cols", 7);
      for (let n = 1; n <= def.pool; n++) {
        const on = picked.has(n);
        const b = h(`button.lt-num${on ? ".is-on" : ""}`, { type: "button", "aria-pressed": String(on), "aria-label": `Zahl ${n}` }, String(n));
        b.addEventListener("click", () => {
          if (picked.has(n)) picked.delete(n);
          else if (picked.size < def.pick) picked.add(n);
          else {
            play("ui.error");
            return;
          }
          play("ui.tap", { pitch: 0.9 + n / 40 });
          haptic("tick");
          render();
        });
        grid.append(b);
      }
      // Neonzahl (nur wenn das Regelwerk eine kennt)
      clear(neonGrid);
      neonPick.hidden = !def.neon;
      for (let n = 0; n < (def.neon || 0); n++) {
        const on = neon === n;
        const b = h(`button.lt-neon${on ? ".is-on" : ""}`, { type: "button", "aria-pressed": String(on), "aria-label": `Neonzahl ${n}` }, String(n));
        b.addEventListener("click", () => {
          neon = neon === n ? null : n;
          play("ui.tap", { pitch: 1.3 + n / 30 });
          haptic("tick");
          render();
        });
        neonGrid.append(b);
      }
      const full = list.length >= MAX_TICKETS;
      const missing = [];
      if (picked.size < def.pick) missing.push(`noch ${def.pick - picked.size} ${def.pick - picked.size === 1 ? "Zahl" : "Zahlen"}`);
      if (def.neon && neon === null) missing.push("Neonzahl");
      pickInfo.replaceChildren(
        h(
          "span.lt-picked",
          {},
          [...picked].sort((a, b) => a - b).map((n) => ballEl(n, { small: true })),
          def.neon && neon !== null ? neonEl(neon, { small: true }) : null,
          missing.length ? h("small", {}, `${missing.join(" + ")} wählen`) : null
        ),
        h("small.lt-count.num", {}, `${list.length}/${MAX_TICKETS} Scheine für diese Ziehung`)
      );
      const blocked = ctx.blockReason();
      buyBtn.disabled = !complete() || full || !next || Boolean(blocked);
      buyBtn.textContent = blocked ? "Während der Pause gesperrt" : full ? `Limit erreicht (${MAX_TICKETS})` : `Schein kaufen · ${fmt(def.price)} C`;

      // eigene Scheine
      clear(mine);
      if (list.length) {
        mine.append(
          h("h3", {}, `Deine Scheine · ${formatDrawTime(next.at)}`),
          h("ul.lt-mylist", {}, list.map((t, i) => h("li.lt-myticket", {}, h("span.lt-ticket-no", {}, `#${i + 1}`), h("span.lt-ticket-nums", {}, t.nums.map((n) => ballEl(n, { small: true })), Number.isInteger(t.neon) ? neonEl(t.neon, { small: true }) : null))))
        );
      }

      // Ergebnisse, die noch angesehen/eingefordert werden können
      clear(pending);
      const open = lotto.archive().filter((d) => !d.seen || (d.payout > 0 && !d.claimed));
      if (open.length) {
        pending.append(
          h("h3", {}, "Ausgewertete Ziehungen"),
          h(
            "ul.lt-openlist",
            {},
            open.map((d) =>
              h(
                "li.lt-open",
                {},
                h("div", {}, h("strong", {}, `${DRAWS[d.type].name}`), h("small", {}, `Ziehung vom ${formatDrawDate(d.at)} · ${d.tickets.length} ${d.tickets.length === 1 ? "Schein" : "Scheine"}`)),
                h("button.btn.btn-primary.btn-sm", { type: "button", onclick: () => startShow(d.id, false) }, "Ziehung ansehen")
              )
            )
          )
        );
      }

      // Archiv
      clear(archive);
      const past = lotto.archive().filter((d) => d.seen);
      archive.append(h("h3", {}, "Archiv"));
      if (!past.length) archive.append(h("p.lt-muted", {}, "Noch keine abgeschlossenen Ziehungen."));
      else
        archive.append(
          h(
            "ul.lt-archlist",
            {},
            past.slice(0, 20).map((d) => {
              const set = new Set(d.nums);
              const best = Math.max(0, ...d.results.map((r) => r.k));
              const rules = rulesFor(d.type, rulesVersionOf(d));
              const neonOf = (n, hit) => (rules.neon && Number.isInteger(n) ? neonEl(n, { small: true, hit }) : null);
              return h(
                "li.lt-arch",
                {},
                h(
                  "details",
                  {},
                  h(
                    "summary",
                    {},
                    h("span.lt-arch-date", {}, `${formatDrawDate(d.at)} · ${DRAWS[d.type].short}`),
                    h("span.lt-arch-nums", {}, d.nums.map((n) => ballEl(n, { small: true })), neonOf(d.neon, false)),
                    h(`span.lt-arch-res${d.payout ? ".is-win" : ""}`, {}, d.payout ? `+${fmt(d.payout)} C${d.claimed ? " · eingefordert" : ""}` : "kein Gewinn")
                  ),
                  h(
                    "ul.lt-arch-tickets",
                    {},
                    d.results.map((r) => h("li", {}, r.nums.map((n) => ballEl(n, { small: true, hit: set.has(n) })), neonOf(r.neon, r.neonHit), h("small", {}, r.prize ? `${resultText(r)} · ${fmt(r.prize)} C` : r.k ? `${r.k} Richtige${r.neonHit ? " + Neonzahl" : ""}` : resultText(r))))
                  ),
                  h("small.lt-muted", {}, `${rulesLabel(rules)} · Einsatz ${fmt(d.stake)} C · bester Schein ${best} Richtige`)
                )
              );
            })
          )
        );
      ctx.setPhase(show ? "show" : "idle");
    }

    function rulesBox() {
      const rows = (id) => {
        const d = DRAWS[id];
        return [
          ...d.classes.map((c) => h("tr", {}, h("td", {}, c.label), h("td.num", {}, `${fmt(c.prize)} C`), h("td.num", {}, oneIn(pClass(d, c))))),
          h("tr.lt-total", {}, h("td", {}, "irgendein Gewinn"), h("td.num", {}, ""), h("td.num", {}, oneIn(pAnyWin(d)))),
        ];
      };
      return h(
        "details.lt-rules",
        {},
        h("summary", {}, "Gewinnplan & Wahrscheinlichkeiten"),
        DRAW_TYPES.map((id) =>
          h(
            "div",
            {},
            h("h4", {}, `${DRAWS[id].name} · ${rulesLabel(DRAWS[id])} · Schein ${fmt(DRAWS[id].price)} C`),
            h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Treffer"), h("th", {}, "Gewinn"), h("th", {}, "Chance je Schein"))), h("tbody", {}, rows(id))),
            h("small.lt-muted", {}, `Auszahlungsquote ${pct(rtpOf(id))} – ein Lotto ist ein Ausgabeposten, kein Verdienst.`)
          )
        ),
        h("p.lt-muted", {}, `Höchstens ${MAX_TICKETS} Scheine pro Ziehung. Das Ergebnis jeder Ziehung wird einmal zum Ziehungszeitpunkt ausgelost und gespeichert; die Show zeigt es nur. Live dabei sein ist ein Bonus – wer nicht da ist, verpasst nichts: Die Auswertung wartet im Posteingang.`)
      );
    }

    // ---------- Show ----------
    function startShow(id, live) {
      const d = lotto.draw(id);
      if (!d || show) return;
      ctx.musicDuck?.(0.2);
      show = playShow({
        container: root,
        draw: d,
        live,
        reduced: ctx.reducedMotion(),
        play,
        loop: ctx.loop,
        fmt,
        setPhase: ctx.setPhase,
        claim: (drawId) => lotto.claim(drawId),
        onClaimed: (paid, dr, el) => {
          const r = el.getBoundingClientRect();
          if (paid > dr.stake) {
            ctx.celebrate({ stake: dr.stake, payout: paid, x: r.left + r.width / 2, y: r.top, title: "Eingefordert!", detail: `${DRAWS[dr.type].name}` });
          } else {
            // Teil-Rückzahlung: ehrlich, ohne Gewinn-Inszenierung
            play("coin.land");
            haptic("tap");
            ctx.particles.coinsToBalance(r.left + r.width / 2, r.top, 6);
          }
        },
        onDone: () => {
          lotto.markSeen(id, { live });
          show = null;
          ctx.musicDuck?.(1);
          render();
        },
      });
      ctx.setPhase("show");
    }

    // Zähler aktuell halten (Countdown), ohne Dauer-Animation
    const timer = setInterval(() => {
      if (!show) render();
    }, 30000);

    ctx.setHelp(() =>
      ctx.openModal({
        title: "Neon Lotto",
        body: h(
          "div.help-text",
          {},
          h("p", {}, `Kreuze deine Zahlen an und kaufe einen Schein für die nächste Ziehung. Pro Ziehung sind höchstens ${MAX_TICKETS} Scheine möglich.`),
          h("p", {}, `Neon Lotto: täglich um 20 Uhr, 4 aus 40, Schein ${fmt(DRAWS.daily.price)} Credits, Höchstgewinn ${fmt(topPrize(DRAWS.daily))} (1 : ${fmt(combinations(DRAWS.daily))}).`),
          h("p", {}, `Großes Neon Lotto: alle drei Tage um 21 Uhr, 6 aus 49 und zusätzlich eine Neonzahl von 0 bis 9, Schein ${fmt(DRAWS.grand.price)} Credits. Erst werden die sechs Zahlen gezogen, danach separat die Neonzahl. Höchstgewinn ${fmt(topPrize(DRAWS.grand))} für 6 Richtige + Neonzahl (1 : ${fmt(combinations(DRAWS.grand))}).`),
          h("p", {}, "Das Ergebnis wird zum Ziehungszeitpunkt einmal ausgelost und gespeichert. Bist du gerade im Palast, läuft die Ziehung live; sonst wartet die Aufzeichnung im Posteingang. Gewinne forderst du selbst ein."),
          h("p", {}, `Lotto ist ein Ausgabeposten: Im Mittel kommen ${pct(rtpOf("daily"))} (täglich) bzw. ${pct(rtpOf("grand"))} (groß) des Einsatzes zurück. Alle Gewinnklassen stehen unter „Gewinnplan & Wahrscheinlichkeiten“.`)
        ),
        actions: [{ label: "Verstanden", cls: "btn-primary" }],
      })
    );

    render();
    if (ctx.pendingShow) setTimeout(() => !dead && startShow(ctx.pendingShow.id, ctx.pendingShow.live), 120);

    return {
      showDraw(id, live = false) {
        startShow(id, live);
      },
      refresh: render,
      destroy() {
        dead = true;
        clearInterval(timer);
        show?.abort();
        show = null;
        ctx.musicDuck?.(1);
      },
    };
  },
};
