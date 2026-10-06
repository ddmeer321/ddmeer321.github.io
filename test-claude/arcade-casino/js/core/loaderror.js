// Unterscheidet beim Starten eines Automaten zwischen „Datei kam nicht an“
// (Netzwerk, GitHub Pages 503, offline) und einem echten Fehler im Spielcode (V1.2.1).
//
// Browser melden fehlgeschlagene dynamische Importe als TypeError mit
// unterschiedlichem Text:
//   Chrome/Edge: „Failed to fetch dynamically imported module: …“
//   Firefox:     „error loading dynamically imported module: …“
//   Safari:      „Importing a module script failed.“
// Syntax- oder Laufzeitfehler im Modul sind dagegen SyntaxError/ReferenceError/…
// Im Zweifel gilt ein Fehler als echter Defekt („außer Betrieb“).

const LOAD_MESSAGE = /failed to fetch|dynamically imported module|importing a module script failed|error loading|networkerror|load failed/i;

export function isModuleLoadError(err, online = typeof navigator === "undefined" ? true : navigator.onLine !== false) {
  if (!online) return true;
  return Boolean(err) && err.name === "TypeError" && LOAD_MESSAGE.test(String(err.message || ""));
}
