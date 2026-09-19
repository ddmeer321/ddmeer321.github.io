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

const VERSION = "v1";
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

self.addEventListener("install", (e) => {
  if (ABSCHALTEN) return;
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(VORRAT)).then(() => self.skipWaiting()));
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
      catch (_) { return (await caches.match(anfrage)) || (await caches.match("/offline.html")); }
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
