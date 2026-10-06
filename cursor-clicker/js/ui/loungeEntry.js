import { navigateWithSave } from "../core/save.js";

// Einstieg in die Trading-Lounge, nach demselben Muster wie der Fabrik-Knopf.
//
// ER ERSCHEINT FUER JEDEN ANGEMELDETEN -- absichtlich, auch fuer Leute ohne
// Freigabe. Der Grund ist keine Bequemlichkeit, sondern eine Sackgasse:
// Freigegeben wird man nur, nachdem man einen Import beantragt hat, und den
// beantragt man auf genau dieser Seite. Waere der Knopf an die Freigabe
// gekoppelt, kaeme nie wieder jemand neu herein.
//
// Was jemand dann SIEHT, entscheidet die Seite selbst: ohne aktives
// Trading-Inventar den Import-Antrag, sonst die Lounge. Und was jemand DARF,
// entscheidet ohnehin der Server -- Kanaele und Aktionen haengen an
// denselben Regeln, egal wer den Knopf findet.
export function initLoungeEntry() {
  const link = document.getElementById("lounge-entry");
  if (!link) return;

  link.addEventListener("click", (e) => {
    e.preventDefault();
    if (link.hidden) return;
    link.setAttribute("aria-busy", "true");
    navigateWithSave(link.href);
  });

  (async function pruefen() {
    const sb = window.supabaseClient;
    if (!sb) return;
    try {
      const sitzung = await sb.auth.getSession();
      if (sitzung.data && sitzung.data.session) link.hidden = false;
    } catch {
      // Versteckt lassen -- ohne Anmeldung gibt es dort nichts zu holen.
    }
  })();
}
