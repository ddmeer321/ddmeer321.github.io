// Service Worker der Spielebibliothek.
//
// ============================ NOT-AUS ============================
// Geht etwas schief: unten ABSCHALTEN auf true setzen, VERSION erhoehen,
// pushen. Der Service Worker raeumt dann sich selbst und alle Zwischen-
// speicher weg und meldet sich ab. Kein Nutzer muss etwas tun.
// =================================================================
//
// GRUNDHALTUNG: NETZ ZUERST, Zwischenspeicher nur als Netz-Ersatz. Ein
// Service Worker ist das Klebrigste, was man auf eine Seite legen kann - er
// bleibt, bis er ersetzt wird. Deshalb kann diese Fassung die Seite
// nicht einfrieren: Solange das Netz da ist, kommt alles frisch von dort.
// Einzige Ausnahme sind Adressen mit ?v= - die sind per Konvention
// unveraenderlich, ein Versionssprung erzeugt eine neue Adresse.
//
// DREI DATEISORTEN AENDERN SICH OHNE VERSIONSSPRUNG. Die muessen immer aus
// dem Netz kommen, sonst liesse sich der Wartungsmodus nicht mehr umlegen
// und ein neues Spiel erschiene nie:
//   assets/js/wartung.js     (aktiv: true/false wird im Inhalt geaendert)
//   config/*.js              (als ES-Modul importiert, ohne Version)
//   games/*/config.json      (per Pfad geladen, ohne Version)

const VERSION = "v2";
const ABSCHALTEN = false;
const CACHE = "spielebibliothek-" + VERSION;

// Diese Bereiche fasst der Service Worker NIE an. Testbereiche und Admin
// haben eigene Regeln und eigene Sperren; Neon Bot Arena kommt aus einem
// anderen Repo und folgt anderen Versionsregeln.
const TABU = [
  /^\/test-claude\//, /^\/test-chatgpt\//, /^\/admin\//,
  /^\/neon-bot-arena\//, /^\/security-check/,
];

const IMMER_FRISCH = [
  /^\/assets\/js\/wartung\.js/,
  /^\/config\/[^/]+\.js/,
  /^\/games\/[^/]+\/config\.json/,
];

// Absichtlich winzig und ohne ?v=: Alles andere lernt der Zwischenspeicher
// beim ersten Besuch. Eine handgepflegte Liste versionierter Dateien waere
// bei jedem Deploy eine neue Fehlerquelle - und ohne Build-Schritt pflegt
// sie niemand zuverlaessig.
const VORRAT = ["/offline.html", "/manifest.json", "/assets/img/app-icon-192.png"];

function passt(liste, pfad) { return liste.some((r) => r.test(pfad)); }

// /reaction/ und /reaction/index.html sind dieselbe Seite, aber ZWEI
// Schluessel im Zwischenspeicher. Wer ueber die Startseite kommt, landet auf
// der zweiten Form (game.entry), wer die Adresse tippt, auf der ersten.
// Ohne diesen Ausgleich zeigt ein Link offline ins Leere, obwohl die Seite
// laengst da ist - genau so ist es passiert.
async function ausDemVorrat(anfrage) {
  const treffer = await caches.match(anfrage);
  if (treffer) return treffer;
  const u = new URL(anfrage.url);
  const andere = u.pathname.endsWith("/")
    ? u.pathname + "index.html"
    : u.pathname.replace(/\/index\.html$/, "/");
  if (andere === u.pathname) return null;
  return (await caches.match(u.origin + andere + u.search)) || null;
}

// Letzte Rettung, falls selbst offline.html nicht im Vorrat liegt: iOS
// raeumt kalte Eintraege weg, und diese Datei wird beim normalen Surfen nie
// angefragt - sie ist also der erste Kandidat. Ohne das bekaeme
// respondWith() undefined und der Browser zeigt seine eigene Fehlerseite.
function ersatzseite() {
  return new Response(
    '<!doctype html><html lang=de><meta charset=utf-8>' +
    '<meta name=viewport content="width=device-width,initial-scale=1">' +
    '<title>Offline</title><style>body{margin:0;min-height:100vh;display:grid;' +
    'place-items:center;padding:24px;background:#fff6ea;color:#241c3d;text-align:center;' +
    'font:16px/1.6 ui-rounded,system-ui,-apple-system,sans-serif}a{display:block;margin:8px 0;' +
    'padding:13px 18px;border-radius:14px;background:#fff;border:1px solid rgba(36,28,61,.1);' +
    'color:#241c3d;text-decoration:none;font-weight:800}</style><div><h1>Gerade kein Netz</h1>' +
    '<p>Zwei Spiele gehen trotzdem:</p>' +
    '<a href="/reaction/index.html">\u26a1 REACTION!</a>' +
    '<a href="/tic-tac-toe/index.html">\u2b55 Tic-Tac-Toe</a></div>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

self.addEventListener("install", (e) => {
  if (ABSCHALTEN) return;
  // Einzeln statt addAll: Scheitert EINE Datei, wuerde addAll die ganze
  // Installation verwerfen - und dann gaebe es gar keinen Service Worker.
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const datei of VORRAT) { try { await c.add(datei); } catch (_) {} }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    if (ABSCHALTEN) {
      for (const n of await caches.keys()) await caches.delete(n);
      await self.registration.unregister();
      return;
    }
    for (const n of await caches.keys()) if (n !== CACHE) await caches.delete(n);
    await self.clients.claim();
  })());
});

async function ausDemNetz(anfrage, speichern) {
  const antwort = await fetch(anfrage);
  // Nur vollstaendige eigene Antworten ablegen. Teilantworten (206) und
  // Fremdantworten gehoeren nicht in diesen Zwischenspeicher.
  if (speichern && antwort && antwort.status === 200 && antwort.type === "basic") {
    const kopie = antwort.clone();
    caches.open(CACHE).then((c) => c.put(anfrage, kopie));
  }
  return antwort;
}

self.addEventListener("fetch", (e) => {
  if (ABSCHALTEN) return;
  const anfrage = e.request;
  if (anfrage.method !== "GET") return;

  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return;   // Supabase, jsDelivr, Cloudflare
  if (passt(TABU, url.pathname)) return;

  // Seiten: immer erst das Netz fragen. Offline die zuletzt gesehene
  // Fassung, und wenn es die nicht gibt, eine ehrliche Ersatzseite.
  if (anfrage.mode === "navigate") {
    e.respondWith((async () => {
      try { return await ausDemNetz(anfrage, true); }
      catch (_) { return (await ausDemVorrat(anfrage)) || (await caches.match("/offline.html")) || ersatzseite(); }
    })());
    return;
  }

  if (passt(IMMER_FRISCH, url.pathname)) {
    e.respondWith((async () => {
      try { return await ausDemNetz(anfrage, true); }
      catch (_) { return (await caches.match(anfrage)) || Response.error(); }
    })());
    return;
  }

  // ?v= heisst: diese Adresse aendert sich nie. Also darf sie aus dem
  // Zwischenspeicher kommen, ohne das Netz zu fragen.
  if (url.searchParams.has("v")) {
    e.respondWith((async () => {
      const da = await caches.match(anfrage);
      if (da) return da;
      try { return await ausDemNetz(anfrage, true); }
      catch (_) { return Response.error(); }
    })());
    return;
  }

  e.respondWith((async () => {
    try { return await ausDemNetz(anfrage, true); }
    catch (_) { return (await caches.match(anfrage)) || Response.error(); }
  })());
});
