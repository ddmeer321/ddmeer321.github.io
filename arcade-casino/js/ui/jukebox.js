// Jukebox-Oberfläche (V1.2): Kaufdialog und Musikpanel.
// Der Kauf ist bewusst ein eigener, bestätigter Moment; das Panel zeigt die
// eigene Bibliothek, den Abspieler, Einstellungen und weitere Stücke.

import { h, clear } from "./dom.js";
import { fmt } from "./format.js";
import { openModal, closeModal } from "./modal.js";
import { TRACKS, trackById } from "../audio/tracks.js";
import { JUKEBOX_PRICE, SONG_PRICE } from "../core/jukebox.js";

const PREVIEW_MS = 12000;

function songRow(t, { right, current, playing, badge }) {
  return h(
    `li.jb-song${current ? ".is-current" : ""}${playing ? ".is-playing" : ""}`,
    { style: { "--song": t.color } },
    h("span.jb-dot", { "aria-hidden": "true" }, playing ? "♪" : ""),
    h("div.jb-song-text", {}, h("strong", {}, t.title, badge ? h("span.jb-badge", {}, badge) : null), h("small", {}, `${t.style} · ${t.bpm} BPM · ${t.key}`)),
    right
  );
}

/** Kaufdialog für die Jukebox (vor dem Besitz). */
export function openJukeboxOffer({ balance, onBuy, onPreview, onStopPreview }) {
  const starters = TRACKS.filter((t) => t.kind === "starter");
  const shop = TRACKS.filter((t) => t.kind === "shop");
  const specials = TRACKS.filter((t) => t.kind === "special");
  const can = balance >= JUKEBOX_PRICE;
  let previewing = false;
  const previewBtn = h("button.btn.btn-ghost.btn-sm", { type: "button" }, "▶ Probehören");
  previewBtn.addEventListener("click", () => {
    previewing = !previewing;
    previewBtn.textContent = previewing ? "■ Probe stoppen" : "▶ Probehören";
    if (previewing) onPreview(starters[0].id, () => {
      previewing = false;
      previewBtn.textContent = "▶ Probehören";
    });
    else onStopPreview();
  });
  openModal({
    title: "Jukebox",
    onClose: () => {
      if (previewing) onStopPreview();
    },
    body: h(
      "div.help-text.jb-offer",
      {},
      h("p", {}, "Eine echte Jukebox für deine Palast-Lounge. Einmal gekauft, gehört sie dir dauerhaft: Sie leuchtet in der Halle und spielt deine Musik, während du durch den Neonpalast gehst."),
      h(
        "ul.jb-facts",
        {},
        h("li", {}, h("b", {}, `${starters.length} Stücke inklusive: `), starters.map((t) => t.title).join(", ")),
        h("li", {}, h("b", {}, `${shop.length} weitere Stücke `), `– jedes kostet gleich viel: ${fmt(SONG_PRICE)} Credits. Geschmack ist Geschmack.`),
        h("li", {}, h("b", {}, `${specials.length} besondere Stücke `), "– nicht käuflich, sie kommen über Meilensteine dazu."),
        h("li", {}, "In Spielen läuft die Musik leiser weiter (einstellbar).")
      ),
      h("div.jb-offer-row", {}, previewBtn, h("span.jb-offer-price.num", {}, `${fmt(JUKEBOX_PRICE)} Credits`)),
      can ? null : h("p.jb-warn", {}, `Dir fehlen noch ${fmt(JUKEBOX_PRICE - balance)} Credits.`)
    ),
    actions: [
      { label: "Abbrechen", cls: "btn-ghost" },
      can ? { label: `Jukebox kaufen · ${fmt(JUKEBOX_PRICE)}`, cls: "btn-gold", onClick: onBuy } : { label: "Noch zu teuer", cls: "btn-ghost", onClick: () => {} },
    ],
  });
}

/**
 * Musikpanel. `api`: { jukebox, status(), play(id), toggle(), next(), prev(),
 * preview(id, done), stopPreview(), buySong(id) → {ok, reason}, balance(),
 * volume(), setVolume(v), progress() → {level, gamesPlayed}, subscribe(fn) → unsubscribe }
 */
export function openJukeboxPanel(api) {
  const body = h("div.jb-panel");
  let previewId = null;
  let unsub = () => {};

  function render() {
    const st = api.status();
    const jb = api.jukebox;
    const j = jb.state();
    const cur = trackById(j.current);
    clear(body);

    // Abspieler
    const now = h(
      "section.jb-now",
      { style: { "--song": cur?.color || "var(--gold)" } },
      h("div.jb-now-text", {}, h("small", {}, st.playing ? "Läuft gerade" : "Ausgewählt"), h("strong", {}, cur?.title || "–"), h("span", {}, cur ? `${cur.style}${st.playing && st.section ? ` · ${st.section}` : ""}` : "")),
      h(
        "div.jb-controls",
        {},
        h("button.btn.btn-ghost.btn-icon", { type: "button", "aria-label": "Vorheriges Stück", onclick: () => api.prev() }, "⏮"),
        h(`button.btn.btn-icon.jb-play${st.playing ? ".btn-gold" : ".btn-primary"}`, { type: "button", "aria-label": st.playing ? "Pause" : "Abspielen", onclick: () => api.toggle() }, st.playing ? "⏸" : "▶"),
        h("button.btn.btn-ghost.btn-icon", { type: "button", "aria-label": "Nächstes Stück", onclick: () => api.next() }, "⏭")
      )
    );

    const shuffle = h("button", { type: "button", "aria-pressed": String(j.shuffle), onclick: () => { jb.setShuffle(!j.shuffle); render(); } }, j.shuffle ? "Zufall an" : "Zufall aus");
    const modes = [["duck", "leiser"], ["full", "normal"], ["off", "aus"]];
    const inGames = h(
      "div.segmented",
      { role: "group", "aria-label": "Musik in Spielen" },
      modes.map(([id, label]) => h("button", { type: "button", "aria-pressed": String(j.inGames === id), onclick: () => { jb.setInGames(id); render(); } }, label))
    );
    const vol = h("input", { type: "range", min: "0", max: "100", value: String(Math.round(api.volume() * 100)), id: "jb-volume", "aria-label": "Musiklautstärke" });
    vol.addEventListener("input", () => api.setVolume(Number(vol.value) / 100));
    const settings = h(
      "section.jb-settings",
      {},
      h("label.jb-set", { for: "jb-volume" }, h("span", {}, "Lautstärke"), vol),
      h("div.jb-set", {}, h("span", {}, "In Spielen"), inGames),
      h("div.jb-set", {}, h("span", {}, "Reihenfolge"), h("div.segmented", {}, shuffle))
    );

    // Bibliothek
    const lib = jb.library();
    const libList = h(
      "ul.jb-list",
      { "aria-label": "Deine Stücke" },
      lib.map((t) =>
        songRow(t, {
          current: t.id === j.current,
          playing: st.playing && st.id === t.id,
          badge: t.kind === "special" ? "besonders" : t.audio ? "Studio" : null,
          right: h("button.btn.btn-sm.btn-ghost", { type: "button", "aria-label": `${t.title} abspielen`, onclick: () => api.play(t.id) }, st.playing && st.id === t.id ? "läuft" : "▶"),
        })
      )
    );

    // Weitere Stücke
    const shop = TRACKS.filter((t) => t.kind === "shop" && !jb.has(t.id));
    const bal = api.balance();
    const shopList = shop.length
      ? h(
          "ul.jb-list.jb-shop",
          {},
          shop.map((t) =>
            songRow(t, {
              playing: previewId === t.id,
              badge: t.audio ? "Studio" : null,
              right: h(
                "div.jb-shop-actions",
                {},
                h("button.btn.btn-sm.btn-ghost", { type: "button", "aria-label": `${t.title} probehören`, onclick: () => togglePreview(t.id) }, previewId === t.id ? "■" : "Probe"),
                h(`button.btn.btn-sm${bal >= SONG_PRICE ? ".btn-gold" : ".btn-ghost"}`, { type: "button", disabled: bal < SONG_PRICE, onclick: () => confirmBuy(t) }, fmt(SONG_PRICE))
              ),
            })
          )
        )
      : h("p.jb-empty", {}, "Du hast alle käuflichen Stücke. Stark!");

    // Besondere Stücke
    const progress = api.progress();
    const specials = TRACKS.filter((t) => t.kind === "special" && !jb.has(t.id));
    const specialList = specials.length
      ? h(
          "ul.jb-list.jb-locked",
          {},
          specials.map((t) => {
            const p =
              t.unlock.type === "level" ? `Level ${progress.level}/${t.unlock.value}`
              : t.unlock.type === "achievements" ? `${Math.min(progress.achievements || 0, t.unlock.value)}/${t.unlock.value} Erfolge`
              : `${progress.gamesPlayed}/${t.unlock.value} Automaten`;
            const li = songRow(t, { badge: t.audio ? "Studio" : null, right: h("span.jb-lock", { "aria-label": "gesperrt" }, "🔒") });
            li.querySelector("small").textContent = `${t.unlock.text} · ${p}`;
            return li;
          })
        )
      : null;

    body.append(
      now,
      settings,
      h("h3", {}, `Deine Bibliothek · ${lib.length}`),
      libList,
      h("h3", {}, `Weitere Stücke · je ${fmt(SONG_PRICE)} Credits`),
      shopList,
      specialList ? h("h3", {}, "Besondere Stücke") : null,
      specialList,
      h("p.jb-credit", {}, "Alle Stücke sind Eigenkompositionen für Neonpalast. Die meisten entstehen live im Browser; Studio-Aufnahmen werden beim Abspielen geladen.")
    );
  }

  function togglePreview(id) {
    if (previewId === id) {
      api.stopPreview();
      previewId = null;
    } else {
      previewId = id;
      api.preview(id, () => {
        previewId = null;
        render();
      });
    }
    render();
  }

  function confirmBuy(t) {
    if (previewId) {
      api.stopPreview();
      previewId = null;
    }
    // eigener kleiner Bestätigungsschritt innerhalb des Panels
    const box = h(
      "div.jb-confirm",
      { role: "alertdialog", "aria-label": `${t.title} freischalten?` },
      h("strong", {}, `„${t.title}“ freischalten?`),
      h("small", {}, `${t.style} · ${fmt(SONG_PRICE)} Credits · bleibt dauerhaft in deiner Bibliothek.`),
      h(
        "div.jb-confirm-actions",
        {},
        h("button.btn.btn-ghost.btn-sm", { type: "button", onclick: () => render() }, "Abbrechen"),
        h("button.btn.btn-gold.btn-sm", {
          type: "button",
          onclick: () => {
            const r = api.buySong(t.id);
            render();
            if (r.ok) {
              const li = [...body.querySelectorAll(".jb-song strong")].find((n) => n.firstChild?.textContent === t.title)?.closest(".jb-song");
              li?.classList.add("is-new");
              li?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }
          },
        }, "Freischalten")
      )
    );
    body.prepend(box);
    box.querySelector(".btn-gold").focus();
  }

  openModal({
    title: "Jukebox",
    body,
    onClose: () => {
      unsub();
      if (previewId) api.stopPreview();
    },
  });
  render();
  unsub = api.subscribe(render);
}

export { closeModal as closeJukebox };
