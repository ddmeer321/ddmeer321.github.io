// Registry der ÖFFENTLICHEN Spiele + Laden/Prüfen ihrer config.json.
//
// PUBLIC_GAME_CONFIGS ist eine bewusst EXPLIZITE Allowlist: nur was hier steht,
// erscheint auf der Startseite. Es gibt absichtlich keine automatische Suche
// nach config.json-Dateien im Repo — dadurch kann ein Testbereich
// (test-claude/, test-chatgpt/) oder ein noch nicht fertiges Spiel nicht
// versehentlich öffentlich gelistet werden. Ein Spiel wird veröffentlicht,
// indem seine Zeile hier hinzugefügt wird — und nur dann.
//
// Diese Datei enthält kein DOM und keine Anzeige-Logik (siehe assets/js/library-games.js).

import { validateGameConfig } from "./schema.js";

export const PUBLIC_GAME_CONFIGS = [
  "games/neon-bot-arena/config.json",
  "games/snake/config.json",
];

async function fetchGameConfig(path) {
  // Gegen document.baseURI auflösen, damit die Pfade auch von Unterseiten aus
  // stimmen und nicht vom aktuellen Verzeichnis abhängen.
  const url = new URL(path, document.baseURI);
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Lädt alle öffentlichen Spiel-Configs, prüft sie einzeln und liefert nur die
 * gültigen zurück.
 *
 * Ein kaputtes oder fehlendes config.json betrifft immer nur das eine Spiel —
 * alle anderen Karten werden normal angezeigt.
 *
 * @returns {Promise<{ games: object[], problems: string[] }>}
 */
export async function loadPublicGames() {
  const problems = [];

  const results = await Promise.all(
    PUBLIC_GAME_CONFIGS.map(async (path) => {
      try {
        const raw = await fetchGameConfig(path);
        const result = validateGameConfig(raw, path);
        result.warnings.forEach((warning) => problems.push(warning));
        if (!result.ok) {
          result.errors.forEach((error) => problems.push(error));
          return null;
        }
        return result.game;
      } catch (err) {
        problems.push(`${path}: konnte nicht geladen werden (${err.message}).`);
        return null;
      }
    })
  );

  // Doppelte IDs würden spätestens bei künftigen Features (Changelog,
  // Contributors, Uploads) zu Verwechslungen führen — hier früh abfangen.
  const games = [];
  const seenIds = new Set();
  results.forEach((game) => {
    if (!game) return;
    if (seenIds.has(game.id)) {
      problems.push(`Doppelte Spiel-id "${game.id}" — nur der erste Eintrag wird angezeigt.`);
      return;
    }
    seenIds.add(game.id);
    games.push(game);
  });

  return { games, problems };
}
