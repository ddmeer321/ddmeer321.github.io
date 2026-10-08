// Spielkontrolle & Hilfe (Dialoge). Neutral formuliert, ohne Druck in irgendeine
// Richtung. Pause und Auszeit sind nach Bestätigung verbindlich bis zum
// angezeigten Zeitpunkt.

import { h } from "./dom.js";
import { openModal } from "./modal.js";
import { play } from "../audio/audio.js";
import { PAUSE_OPTIONS, EXCLUSION_OPTIONS, REMINDER_OPTIONS, playStatus, formatUntil, formatRemaining } from "../core/control.js";

function statusBox(control, sessionMin) {
  const st = playStatus(control);
  if (!st.ok) {
    const what = st.kind === "pause" ? "Spielpause" : "Freiwillige Auszeit";
    return h("div.control-status.is-blocked", {}, `${what} aktiv bis ${formatUntil(st.until)} (noch ${formatRemaining(st.until - Date.now())}). Bis dahin können keine Spiele gestartet werden.`);
  }
  return h("div.control-status", {}, sessionMin >= 1 ? `Aktuelle Spielsitzung: ca. ${Math.round(sessionMin)} Minuten.` : "Keine Pause oder Auszeit aktiv.");
}

/**
 * @param {{control:object, sessionMin:number, onPause:(min:number)=>void, onExclude:(days:number)=>void, onReminder:(min:number)=>void}} o
 */
export function openControl(o) {
  const { control } = o;
  const blocked = !playStatus(control).ok;
  const pauseBtns = PAUSE_OPTIONS.map((m) =>
    h("button.btn.btn-cyan", { type: "button", onclick: () => confirmPause(m, o) }, `${m} Min.`)
  );
  const exclBtns = EXCLUSION_OPTIONS.map((d) =>
    h("button.btn", { type: "button", onclick: () => confirmExclusion(d, o) }, d === 1 ? "1 Tag" : `${d} Tage`)
  );
  const remind = h("div.segmented", { role: "group", "aria-label": "Pausen-Erinnerung" });
  for (const m of REMINDER_OPTIONS) {
    const b = h("button", { type: "button", "aria-pressed": String(control.remindMin === m) }, m ? `${m} Min.` : "Aus");
    b.addEventListener("click", () => {
      remind.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      o.onReminder(m);
      play("ui.toggle");
    });
    remind.append(b);
  }
  openModal({
    title: "Spielkontrolle",
    body: h(
      "div.help-text",
      {},
      statusBox(control, o.sessionMin),
      h("h3", {}, "Pause einlegen"),
      h("p", {}, "Während der Pause lassen sich keine Automaten starten. Die Pause endet automatisch."),
      h("div.control-options", {}, blocked ? [] : pauseBtns),
      h("h3", {}, "Freiwillige Auszeit"),
      h("p", {}, "Sperrt das Spielen für einen längeren Zeitraum. Eine bestätigte Auszeit lässt sich nicht vorzeitig aufheben."),
      h("div.control-options", {}, blocked && control.excludeUntil > Date.now() ? [] : exclBtns),
      h("h3", {}, "Erinnerung an Pausen"),
      h("p", {}, "Nach dieser Zeit ununterbrochenen Spielens fragt Neonpalast neutral nach einer Pause."),
      remind,
      h("h3", {}, "Hilfe"),
      h("button.btn.btn-ghost", { type: "button", onclick: () => setTimeout(openHelp, 0) }, "Hilfe & Informationen öffnen")
    ),
    actions: [{ label: "Schließen", cls: "btn-primary" }],
  });
}

export function confirmPause(minutes, o) {
  const until = Date.now() + minutes * 60000;
  openModal({
    title: "Pause starten?",
    body: h("p.help-text", {}, `Neonpalast pausiert bis ${formatUntil(until)} (${minutes} Minuten). In dieser Zeit können keine Spiele gestartet werden. Eine laufende Runde wird vorher normal abgerechnet. Die Pause lässt sich nicht vorzeitig beenden.`),
    actions: [
      { label: "Abbrechen", cls: "btn-ghost" },
      { label: "Pause starten", cls: "btn-cyan", onClick: () => o.onPause(minutes) },
    ],
  });
}

function confirmExclusion(days, o) {
  const until = Date.now() + days * 86400000;
  openModal({
    title: "Auszeit verbindlich starten?",
    body: h(
      "div.help-text",
      {},
      h("p", {}, h("strong", {}, `Bis ${formatUntil(until)}`), ` kannst du in Neonpalast keine Spiele starten (${days === 1 ? "1 Tag" : `${days} Tage`}).`),
      h("p", {}, "Die Auszeit lässt sich nach dem Bestätigen nicht vorzeitig aufheben – auch nicht in den Einstellungen. Das Zurücksetzen des Fortschritts beendet sie ebenfalls nicht."),
      h("p", {}, "Hinweis: Ohne Anmeldung gilt die Auszeit nur in diesem Browser. Bist du in der Spielebibliothek angemeldet (Cloud-Spielstand), gilt sie auf allen deinen Geräten. Wer sich auch bei echten Glücksspielen schützen möchte, findet unter „Hilfe“ seriöse Anlaufstellen.")
    ),
    actions: [
      { label: "Abbrechen", cls: "btn-ghost" },
      { label: "Auszeit starten", cls: "btn-gold", onClick: () => o.onExclude(days) },
    ],
  });
}

export function openHelp() {
  const link = (href, text) => h("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);
  openModal({
    title: "Hilfe & Informationen",
    body: h(
      "div.help-text",
      {},
      h("p", {}, "Neonpalast verwendet ausschließlich virtuelles Spielgeld. Credits haben keinen Geldwert, lassen sich weder kaufen noch auszahlen oder tauschen. Gewinne und Verluste sind rein fiktiv."),
      h("p", {}, "Trotzdem simuliert Neonpalast Casino-Mechaniken. Wenn dir Glücksspiel – virtuell oder echt – nicht mehr guttut, nimm das ernst."),
      h("h3", {}, "Mögliche Warnzeichen"),
      h(
        "ul.help-links",
        {},
        h("li", {}, "Du spielst länger oder um mehr, als du eigentlich wolltest."),
        h("li", {}, "Du versuchst, Verluste durch weiteres Spielen „zurückzuholen“."),
        h("li", {}, "Gedanken ans Spielen nehmen viel Raum ein; Pausen fallen schwer."),
        h("li", {}, "Du spielst, um Stress, Sorgen oder schlechte Stimmung zu verdrängen."),
        h("li", {}, "Du verheimlichst dein Spielverhalten oder Geldausgaben für echtes Glücksspiel.")
      ),
      h("h3", {}, "Hilfe in Deutschland (kostenlos & anonym)"),
      h(
        "ul.help-links",
        {},
        h("li", {}, "Telefonberatung zur Glücksspielsucht des Bundesinstituts für Öffentliche Gesundheit (BIÖG): ", h("a", { href: "tel:08001372700" }, "0800 1 37 27 00")),
        h("li", {}, link("https://www.check-dein-spiel.de/", "check-dein-spiel.de"), " – Selbsttest, Online-Beratung und Informationen"),
        h("li", {}, link("https://www.gluecksspiel-behoerde.de/de/fuer-spielende/gluecksspielsucht-beratungs-und-hilfsangebote", "Gemeinsame Glücksspielbehörde der Länder"), " – Übersicht über Beratungs- und Hilfsangebote")
      ),
      h("h3", {}, "Spielkontrolle in Neonpalast"),
      h("p", {}, "Über das Pausen-Symbol oben rechts kannst du jederzeit eine Pause oder eine verbindliche Auszeit einlegen und Erinnerungen einstellen.")
    ),
    actions: [{ label: "Schließen", cls: "btn-primary" }],
  });
}

/** Neutrale Session-Erinnerung. Keine Belohnung, kein Druck. */
export function openReminder({ minutes, onPause }) {
  openModal({
    title: "Zeit für eine Pause?",
    body: h("p.help-text", {}, `Du spielst seit etwa ${Math.round(minutes)} Minuten. Wie wär’s mit einer Pause?`),
    actions: [
      { label: "Weiterspielen", cls: "btn-ghost" },
      { label: "Pause einlegen …", cls: "btn-cyan", onClick: () => setTimeout(() => onPause(15), 0) },
    ],
  });
}
