// Baut die Spielkarten der Startseite aus den config.json-Dateien.
//
// Arbeitsteilung:
//   config/games.js      → WELCHE Spiele öffentlich sind (Allowlist) + Laden
//   config/schema.js     → OB eine config.json gültig ist
//   config/types.js      → WAS "type" bedeutet (Anzeigetext)
//   config/statuses.js   → WAS "status" bedeutet (Anzeigetext + Badge-Klasse)
//   config/features.js   → WAS "features" bedeuten (Anzeigetext + Reihenfolge)
//   diese Datei          → WIE daraus eine Karte im bestehenden Design wird
//
// Sicherheit: Config-Werte werden ausschließlich über textContent bzw. über
// geprüfte relative Pfade gesetzt — kein innerHTML mit Config-Daten, kein
// eval(), kein Function()-Konstruktor.

import { loadPublicGames } from "../../config/games.js";
import { getGameType } from "../../config/types.js";
import { getStatusBadge } from "../../config/statuses.js";
import { getGameFeature } from "../../config/features.js";

// Reiner Anzeigetext, für alle Karten gleich — bewusst hier und nicht in den
// einzelnen config.json-Dateien.
const CTA_LABEL = "Ansehen & spielen →";
const FALLBACK_ICON = "🎮";

function createArt(game) {
  const art = document.createElement("div");
  art.className = "game-card-art";

  // Links: Art/Kategorie des Spiels.
  const type = getGameType(game.type);
  if (type) {
    const tag = document.createElement("span");
    tag.className = "game-card-tag";
    tag.textContent = type.label;
    art.appendChild(tag);
  }

  // Rechts: optionaler Status. Ohne sinnvollen Status — oder wenn das
  // Ablaufdatum aus "statusUntil" vorbei ist — entsteht hier bewusst gar
  // kein Element.
  const badge = getStatusBadge(game.status, game.statusUntil);
  if (badge) {
    const statusEl = document.createElement("span");
    statusEl.className = `game-card-status ${badge.badgeClass}`;
    statusEl.textContent = badge.label;
    art.appendChild(statusEl);
  }

  if (game.thumbnail) {
    const img = document.createElement("img");
    img.src = game.thumbnail;
    img.alt = game.thumbnailAlt || "";
    img.loading = "lazy";
    art.appendChild(img);
  } else {
    const emoji = document.createElement("span");
    emoji.className = "game-card-emoji";
    emoji.textContent = game.icon || FALLBACK_ICON;
    art.appendChild(emoji);
  }

  return art;
}

// Kleine Fähigkeits-Chips ("features"). Bewusst eine echte Liste statt
// aneinandergereihter <span>: für Screenreader ist "Liste mit 3 Einträgen"
// die richtige Ansage, und die Chips ersetzen ja teilweise die Beschreibung.
//
// Die Reihenfolge kommt aus config/features.js und ist bereits in
// schema.js angewandt worden — hier wird nur noch übersetzt und gezeichnet.
function createFeatures(game) {
  const ids = Array.isArray(game.features) ? game.features : [];
  if (!ids.length) return null;

  const list = document.createElement("ul");
  list.className = "game-card-features";
  ids.forEach((id) => {
    const feature = getGameFeature(id);
    if (!feature) return; // sollte nach schema.js nicht vorkommen
    const item = document.createElement("li");
    item.className = "game-card-feature";
    item.textContent = feature.label;
    list.appendChild(item);
  });

  return list.children.length ? list : null;
}

function createBody(game) {
  const body = document.createElement("div");
  body.className = "game-card-body";

  const title = document.createElement("h3");
  title.textContent = game.name;
  body.appendChild(title);

  if (game.description) {
    const text = document.createElement("p");
    text.textContent = game.description;
    body.appendChild(text);
  }

  // Unter der Beschreibung, über dem Aufruf zum Spielen: die Chips sagen aus,
  // was das Spiel kann, und gehören damit zum Beschreibungsteil der Karte —
  // nicht zum Bild, auf dem schon Typ und Status sitzen.
  const features = createFeatures(game);
  if (features) body.appendChild(features);

  const cta = document.createElement("span");
  cta.className = "game-card-cta";
  cta.textContent = CTA_LABEL;
  body.appendChild(cta);

  return body;
}

function createCard(game) {
  const card = document.createElement("a");
  card.className = "game-card";
  card.href = game.entry; // von schema.js als sicherer relativer Pfad geprüft
  card.dataset.gameId = game.id;
  card.appendChild(createArt(game));
  card.appendChild(createBody(game));
  return card;
}

async function renderGames() {
  const grid = document.getElementById("game-grid");
  if (!grid) return;

  const { games, problems } = await loadPublicGames();

  // Probleme gehören in die Konsole, nicht auf die Seite — eine fehlerhafte
  // Config soll für Besucher unsichtbar bleiben, für uns aber auffindbar sein.
  problems.forEach((problem) => console.warn("Spielebibliothek:", problem));

  if (!games.length) {
    console.warn("Spielebibliothek: keine gültige Spiel-Config geladen.");
    return; // statischer Inhalt des Grids (Platzhalter) bleibt stehen
  }

  const fragment = document.createDocumentFragment();
  games.forEach((game) => fragment.appendChild(createCard(game)));

  // Vor den statischen Platzhalter ("Nächstes Spiel") einfügen, damit die
  // Reihenfolge der Registry erhalten bleibt.
  grid.prepend(fragment);
  grid.dataset.gamesLoaded = "true";
}

// Fehler hier dürfen nie den Rest der Seite (Login, Navigation) mitreißen.
renderGames().catch((err) => {
  console.warn("Spielebibliothek: Spielkarten konnten nicht aufgebaut werden.", err);
});
