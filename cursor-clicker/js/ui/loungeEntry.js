import { navigateWithSave } from "../core/save.js";

// Einstieg in die Trading-Lounge, nach demselben Muster wie der Fabrik-Knopf.
//
// Anders als die Fabrik haengt er nicht am Spielstand, sondern an einer
// Serverantwort: cc_darf_in_die_lounge(). Das ist dieselbe Funktion, an der
// auch die RLS-Regeln der Realtime-Kanaele haengen. Es gibt also genau EINE
// Stelle, die entscheidet, wer Trading sehen darf -- und wenn der Gate-
// Schalter umgelegt wird, zieht dieser Knopf ohne Aenderung mit.
//
// ER BLEIBT BEI JEDEM FEHLER VERSTECKT. Kein Netz, keine Anmeldung, Antwort
// kaputt: alles fuehrt dazu, dass gar nichts erscheint. Ein Knopf, der da ist
// und dann "kein Zugriff" sagt, waere die schlechtere Haelfte von beidem --
// er macht neugierig und enttaeuscht direkt danach.
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
      if (!(sitzung.data && sitzung.data.session)) return;
      const antwort = await sb.rpc("cc_darf_in_die_lounge");
      if (!antwort.error && antwort.data === true) link.hidden = false;
    } catch {
      // Versteckt lassen. Siehe Kommentar oben.
    }
  })();
}
