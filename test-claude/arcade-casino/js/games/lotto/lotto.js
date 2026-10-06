// Neon Lotto – Studio in der Palast-Lounge (V1.2).
// Scheine ausfüllen (4 Zahlen), kommende Ziehungen, Ergebnisse/Archiv und die
// Ziehungs-Show. Regeln und Mathematik: core/lotto.js, docs/ECONOMY.md.

import { h, clear } from "../../ui/dom.js";
import { DRAWS, DRAW_TYPES, MAX_TICKETS, PICK, pMatches, rtpOf, formatDrawTime, formatDrawDate, quickPick } from "../../core/lotto.js";
import { playShow, ballEl } from "./show.js";

function countdown(ms) {
  if (ms <= 0) return "jetzt";
  const m = Math.ceil(ms / 60000);
  if (m < 60) return `in ${m} Min.`;
  const hh = Math.floor(m / 60);
  if (hh < 48) return `in ${hh} Std. ${m % 60} Min.`;
  return `in ${Math.round(hh / 24)} Tagen`;
}

function oneIn(p) {
  return p > 0 ? `1 : ${Math.round(1 / p).toLocaleString("de-DE")}` : "–";
}

export default {
  mount(root, ctx) {
    const { lotto, play, haptic, fmt } = ctx;
    const data = ctx.data;
    let type = DRAW_TYPES.includes(data.type) ? data.type : "daily";
    let picked = new Set();
    let show = null;
    let dead = false;

    const wrap = h("div.game-stage.lotto-stage");
    root.append(wrap);

    // ---------- Aufbau ----------
    const tabs = h("div.segmented.lt-tabs", { role: "group", "aria-label": "Ziehung wählen" });
    const head = h("section.lt-draw-card");
    const grid = h("div.lt-grid", { role: "group", "aria-label": "Zahlen wählen" });
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
        play("ui.toggle");
        render();
      });
      tabs.append(b);
    }

    quickBtn.addEventListener("click", () => {
      picked = new Set(quickPick(type));
      play("chip.stack");
      haptic("tap");
      render();
    });
    clearBtn.addEventListener("click", () => {
      picked = new Set();
      play("ui.toggle");
      render();
    });
    buyBtn.addEventListener("click", buy);

    function buy() {
      if (picked.size !== PICK) return;
      const blocked = ctx.blockReason();
      if (blocked) {
        play("ui.error");
        ctx.toast(`${blocked} – keine Scheine.`, { icon: "⏸️" });
        return;
      }
      const r = lotto.buy(type, [...picked]);
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
        h("div.lt-draw-title", {}, h("strong", {}, def.name), h("small", {}, `${def.short} · ${String(def.hour).padStart(2, "0")}:00 Uhr · 4 aus ${def.pool}`)),
        next
          ? h(
              "div.lt-draw-next",
              {},
              h("span", {}, "Nächste Ziehung"),
              h("b", {}, formatDrawTime(next.at)),
              h("small", {}, `${countdown(next.at - Date.now())} · Annahmeschluss 1 Min. vorher`)
            )
          : null,
        h("div.lt-draw-prize", {}, h("span", {}, "Höchstgewinn"), h("b.num", {}, `${fmt(def.prizes[4])} C`), h("small", {}, `Schein ${fmt(def.price)} C`))
      );

      // Zahlenfeld
      clear(grid);
      grid.style.setProperty("--cols", def.pool === 20 ? 5 : 6);
      for (let n = 1; n <= def.pool; n++) {
        const on = picked.has(n);
        const b = h(`button.lt-num${on ? ".is-on" : ""}`, { type: "button", "aria-pressed": String(on), "aria-label": `Zahl ${n}` }, String(n));
        b.addEventListener("click", () => {
          if (picked.has(n)) picked.delete(n);
          else if (picked.size < PICK) picked.add(n);
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
      const full = list.length >= MAX_TICKETS;
      pickInfo.replaceChildren(
        h("span.lt-picked", {}, [...picked].sort((a, b) => a - b).map((n) => ballEl(n, { small: true })), picked.size < PICK ? h("small", {}, `noch ${PICK - picked.size} wählen`) : null),
        h("small.lt-count.num", {}, `${list.length}/${MAX_TICKETS} Scheine für diese Ziehung`)
      );
      const blocked = ctx.blockReason();
      buyBtn.disabled = picked.size !== PICK || full || !next || Boolean(blocked);
      buyBtn.textContent = blocked ? "Während der Pause gesperrt" : full ? `Limit erreicht (${MAX_TICKETS})` : `Schein kaufen · ${fmt(def.price)} C`;

      // eigene Scheine
      clear(mine);
      if (list.length) {
        mine.append(
          h("h3", {}, `Deine Scheine · ${formatDrawTime(next.at)}`),
          h("ul.lt-mylist", {}, list.map((t, i) => h("li.lt-myticket", {}, h("span.lt-ticket-no", {}, `#${i + 1}`), h("span.lt-ticket-nums", {}, t.nums.map((n) => ballEl(n, { small: true }))))))
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
                    h("span.lt-arch-nums", {}, d.nums.map((n) => ballEl(n, { small: true }))),
                    h(`span.lt-arch-res${d.payout ? ".is-win" : ""}`, {}, d.payout ? `+${fmt(d.payout)} C${d.claimed ? " · eingefordert" : ""}` : "kein Gewinn")
                  ),
                  h(
                    "ul.lt-arch-tickets",
                    {},
                    d.results.map((r) => h("li", {}, r.nums.map((n) => ballEl(n, { small: true, hit: set.has(n) })), h("small", {}, r.prize ? `${r.k} Richtige · ${fmt(r.prize)} C` : `${r.k} Richtige`)))
                  ),
                  h("small.lt-muted", {}, `Einsatz ${fmt(d.stake)} C · bester Schein ${best} Richtige`)
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
        return [4, 3, 2].map((k) => h("tr", {}, h("td", {}, `${k} Richtige`), h("td.num", {}, `${fmt(d.prizes[k])} C`), h("td.num", {}, oneIn(pMatches(d.pool, k)))));
      };
      return h(
        "details.lt-rules",
        {},
        h("summary", {}, "Gewinnplan & Wahrscheinlichkeiten"),
        DRAW_TYPES.map((id) =>
          h(
            "div",
            {},
            h("h4", {}, `${DRAWS[id].name} · 4 aus ${DRAWS[id].pool} · Schein ${fmt(DRAWS[id].price)} C`),
            h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Treffer"), h("th", {}, "Gewinn"), h("th", {}, "Chance je Schein"))), h("tbody", {}, rows(id))),
            h("small.lt-muted", {}, `Auszahlungsquote ${(rtpOf(id) * 100).toFixed(1).replace(".", ",")} % – ein Lotto ist ein Ausgabeposten, kein Verdienst.`)
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
          h("p", {}, `Kreuze ${PICK} verschiedene Zahlen an und kaufe einen Schein für die nächste Ziehung. Pro Ziehung sind höchstens ${MAX_TICKETS} Scheine möglich.`),
          h("p", {}, "Neon Lotto: täglich um 20 Uhr, 4 aus 20, Schein 50 Credits. Großes Neon Lotto: alle drei Tage um 21 Uhr, 4 aus 24, Schein 100 Credits, Höchstgewinn 120.000."),
          h("p", {}, "Das Ergebnis wird zum Ziehungszeitpunkt einmal ausgelost und gespeichert. Bist du gerade im Palast, läuft die Ziehung live; sonst wartet die Aufzeichnung im Posteingang. Gewinne forderst du selbst ein."),
          h("p", {}, "Lotto ist ein Ausgabeposten: Im Mittel kommt etwa 58–60 % des Einsatzes zurück.")
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
