// Einstellungen und Statistik/Erfolge als Dialoge.

import { h } from "./dom.js";
import { openModal, closeModal } from "./modal.js";
import { fmt } from "./format.js";
import { play } from "../audio/audio.js";
import { haptic } from "../audio/feedback.js";
import { ACHIEVEMENTS, THEME_UNLOCKS, levelInfo } from "../core/progression.js";
import { GAMES } from "../games/registry.js";

function slider(label, hint, value, onInput) {
  const input = h("input.range", { type: "range", min: "0", max: "100", step: "5", value: String(Math.round(value * 100)), "aria-label": label });
  const set = () => input.style.setProperty("--fill", input.value + "%");
  set();
  input.addEventListener("input", () => {
    set();
    onInput(Number(input.value) / 100);
  });
  input.addEventListener("change", () => play("ui.tap"));
  return h("div.setting-row", {}, h("label", {}, label, hint ? h("span.hint", {}, hint) : null), input);
}

function toggle(label, hint, value, onChange, disabled = false) {
  const btn = h("button.switch", { type: "button", role: "switch", "aria-checked": String(value), "aria-label": label, disabled });
  btn.addEventListener("click", () => {
    const next = btn.getAttribute("aria-checked") !== "true";
    btn.setAttribute("aria-checked", String(next));
    onChange(next);
    play("ui.toggle");
    haptic("tap");
  });
  return h("div.setting-row", {}, h("label", {}, label, hint ? h("span.hint", {}, hint) : null), btn);
}

function segmented(label, options, value, onChange) {
  const wrap = h("div.segmented", { role: "group", "aria-label": label });
  for (const o of options) {
    const b = h("button", { type: "button", "aria-pressed": String(o.value === value), disabled: o.disabled, title: o.title || "" }, o.label);
    b.addEventListener("click", () => {
      if (o.disabled) return;
      wrap.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      onChange(o.value);
      play("ui.toggle");
    });
    wrap.append(b);
  }
  return h("div.setting-row", { style: { flexWrap: "wrap" } }, h("label", {}, label), wrap);
}

export function openSettings({ settings, update, level, onReset, onControl }) {
  const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const themeOpts = THEME_UNLOCKS.map((t) => ({
    value: t.id,
    label: t.level <= level ? t.name : `🔒 ${t.level}`,
    disabled: t.level > level,
    title: t.level > level ? `Ab Level ${t.level}` : t.name,
  }));
  const body = h(
    "div",
    {},
    onControl ? h("button.btn.btn-cyan.btn-block", { type: "button", style: { marginBottom: "8px" }, onclick: () => setTimeout(onControl, 0) }, "⏸️ Spielkontrolle: Pause, Auszeit & Hilfe") : null,
    slider("Gesamtlautstärke", null, settings.master, (v) => update({ master: v })),
    slider("Effekte", "Karten, Münzen, Walzen …", settings.sfx, (v) => update({ sfx: v })),
    slider("Hallen-Atmosphäre", "leiser Klangteppich in der Halle", settings.ambience, (v) => update({ ambience: v })),
    slider("Musik (Jukebox)", "deine Jukebox in der Palast-Lounge", settings.music ?? 0.6, (v) => update({ music: v })),
    toggle("Vibration", canVibrate ? "echte Haptik, wo das Gerät es kann" : "von diesem Gerät/Browser nicht unterstützt", settings.vibration && canVibrate, (v) => update({ vibration: v }), !canVibrate),
    toggle("Klang-Haptik", "kurze, dezente Impulse als Haptik-Ersatz", settings.audioHaptics, (v) => update({ audioHaptics: v })),
    segmented(
      "Bewegung",
      [
        { value: "auto", label: "Auto" },
        { value: "reduced", label: "Reduziert" },
        { value: "full", label: "Voll" },
      ],
      settings.motion,
      (v) => update({ motion: v })
    ),
    segmented("Hallen-Theme", themeOpts, settings.theme, (v) => update({ theme: v })),
    h(
      "p.help-text",
      {},
      "Alle Credits sind virtuelles Spielgeld ohne realen Wert. Der Spielstand wird nur lokal in diesem Browser gespeichert und ist nicht vor Änderungen durch dich selbst geschützt – das ist bei reinem Spielgeld auch nicht nötig."
    )
  );
  openModal({
    title: "Einstellungen",
    body,
    actions: [
      {
        label: "Fortschritt zurücksetzen",
        cls: "btn-danger btn-sm",
        keepOpen: true,
        onClick: () => confirmReset(onReset),
      },
      { label: "Fertig", cls: "btn-primary" },
    ],
  });
}

function confirmReset(onReset) {
  openModal({
    title: "Wirklich zurücksetzen?",
    body: h("p.help-text", {}, "Guthaben, Level, Erfolge, Statistiken und Bestwerte werden gelöscht. Einstellungen bleiben erhalten."),
    actions: [
      { label: "Abbrechen", cls: "btn-ghost" },
      { label: "Zurücksetzen", cls: "btn-danger", onClick: onReset },
    ],
  });
}

export function openStats({ state, onSettings }) {
  const info = levelInfo(state.xp);
  const tabs = h("div.tabs");
  const content = h("div");
  const sections = {
    Erfolge: () => {
      const done = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
      return [
        h("p.help-text", {}, `${done} von ${ACHIEVEMENTS.length} freigeschaltet`),
        h(
          "ul.ach-list",
          {},
          ACHIEVEMENTS.map((a) =>
            h(`li.ach${state.achievements[a.id] ? ".is-done" : ""}`, {}, h("span.ach-ico", { "aria-hidden": "true" }, a.icon), h("div", {}, h("strong", {}, a.title), h("small", {}, a.desc)))
          )
        ),
      ];
    },
    Statistik: () => {
      const s = state.stats;
      const rows = GAMES.map((g) => {
        const pg = s.perGame[g.id];
        return pg ? h("tr", {}, h("td", {}, g.title), h("td.num", {}, fmt(pg.rounds)), h("td.num", {}, fmt(pg.won - pg.wagered))) : null;
      }).filter(Boolean);
      return [
        h(
          "div.stat-grid",
          {},
          stat("Level", `${info.level}`),
          stat("XP bis Level " + (info.level + 1), `${fmt(info.need - info.into)}`),
          stat("Runden", fmt(s.rounds)),
          stat("Eingesetzt", fmt(s.wagered)),
          stat("Ausgezahlt", fmt(s.won)),
          stat("Boni erhalten", fmt(s.bonus || 0)),
          stat("Ausgegeben (Jukebox & Musik)", fmt(s.spent || 0)),
          stat("Größter Gewinn", fmt(s.biggestWin))
        ),
        rows.length
          ? h("div.help-text", {}, h("h3", {}, "Nach Spiel"), h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Spiel"), h("th", {}, "Runden"), h("th", {}, "Bilanz"))), h("tbody", {}, rows)))
          : h("p.help-text", {}, "Noch keine Runden gespielt."),
      ];
    },
    Bestwerte: () => [
      h(
        "div.stat-grid",
        {},
        stat("Neon Hoops – Punkte", fmt(state.bests.hoops || 0)),
        stat("Neon Hoops – Serie", fmt(state.bests["hoops-streak"] || 0)),
        stat("Turmbau – Höhe", fmt(state.bests.stacker || 0)),
        stat("Lichtwirbel – Serie", fmt(state.bests["cyclone-streak"] || 0)),
        stat("Münzkaskade – Münzen", fmt(state.counters["pusher-coins"] || 0))
      ),
    ],
  };
  const select = (name) => {
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === name)));
    content.replaceChildren(...sections[name]());
  };
  const seg = h("div.segmented");
  for (const name of Object.keys(sections)) {
    seg.append(
      h("button", {
        type: "button",
        onclick: () => {
          play("ui.toggle");
          select(name);
        },
      }, name)
    );
  }
  tabs.append(seg);
  select("Erfolge");

  const lvl = h(
    "div.panel",
    { style: { padding: "12px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px" } },
    h("span.level-ring", { style: { "--p": info.progress, width: "48px", height: "48px" } }, h("span", { style: { width: "38px", height: "38px", fontSize: "16px" } }, String(info.level))),
    h("div", { style: { flex: "1" } }, h("strong", {}, `Level ${info.level}`), h("div.help-text", {}, `${fmt(info.into)} / ${fmt(info.need)} XP`))
  );
  openModal({ title: "Erfolge & Statistik", body: h("div", {}, lvl, tabs, content), actions: [{ label: "Einstellungen", cls: "btn-ghost", onClick: () => setTimeout(onSettings, 0) }, { label: "Schließen", cls: "btn-primary" }] });
}

function stat(label, value) {
  return h("div.stat", {}, h("small", {}, label), h("strong.num", {}, value));
}

export { closeModal };
