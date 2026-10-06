// Gemeinsame Konstanten fuer die Biti-Figur - genutzt von biti-figure-2d.js,
// biti-figure-3d.js und jeder Seite, die eine Figur anzeigt oder bearbeitet
// (test-claude/biti-charakter-creator.html, test-claude/profil.html). Reine
// Daten, kein DOM-Zugriff, damit dieselbe Datei ueberall zuerst geladen
// werden kann.
(function () {
  if (window.BitiFigureData) return;

  var DEFAULT_CHAR = {
    name: "Spieler 1",
    skin: "#f4b988",
    eye: "#3a2418",
    hair: "#c23a1c",
    top: "#e8722a",
    accent: "#dba32a",
    hairStyle: "flamme",
    accessory: "umhang",
    pose: "stehen",
    mouth: "gerade",
    width: 0.4,
    size: 1,
    bodyType: "junge",
  };

  var PALETTES = {
    skin: ["#ffe3c4", "#f4b988", "#d99968", "#c98456", "#b97a52", "#8a5a3a", "#5a3826"],
    eye: ["#3a2418", "#2d4a6e", "#2f6b46", "#7a4a2a", "#5b3f7a", "#1a1a1a", "#8a2e2e"],
    hair: ["#241e26", "#6e3d29", "#c23a1c", "#d89a48", "#d7d1c7", "#5a4a8f", "#2e6b5e", "#c94f8a"],
    top: ["#e8722a", "#2f73ae", "#3c8d69", "#7655a7", "#c43f62", "#d29432", "#3a3a4a", "#1a8a8a"],
    accent: ["#dba32a", "#78d5cf", "#edd8a2", "#bd81ec", "#f28a72", "#e8e8e8", "#6bd66b"],
  };

  // Winkel in Grad (2D, SVG rotate) bzw. daraus abgeleitet in Rad (3D):
  // linker Arm bekommt +winkel, rechter -winkel, damit beide spiegel-
  // symmetrisch schwenken statt beide in dieselbe Richtung.
  var POSE_ANGLES_DEG = { stehen: 8, kampf: 112, jubel: 180 };

  // Zwei getrennte Frisuren-Listen statt einer gemeinsamen - je nach
  // "Aussehen" zeigt die Frisur-Auswahl nur die passende Liste. Kein Eintrag
  // taucht in beiden Listen auf.
  var HAIR_STYLES_JUNGE = [
    { id: "flamme", label: "Flamme" },
    { id: "rund", label: "Rund" },
    { id: "seitlich", label: "Seitlich" },
    { id: "kurz", label: "Kurz" },
  ];
  var HAIR_STYLES_MAEDCHEN = [
    { id: "offen", label: "Offen" },
    { id: "zopf", label: "Zopf" },
    { id: "dutt", label: "Dutt" },
  ];
  function hairStylesFor(bodyType) {
    return bodyType === "maedchen" ? HAIR_STYLES_MAEDCHEN : HAIR_STYLES_JUNGE;
  }

  var ACCESSORIES = [
    { id: "keins", label: "Keins" },
    { id: "umhang", label: "Umhang" },
    { id: "schal", label: "Schal" },
    { id: "schultern", label: "Schultern" },
  ];
  var POSES = [
    { id: "stehen", label: "Stehen" },
    { id: "kampf", label: "Kampf" },
    { id: "jubel", label: "Jubel" },
    { id: "laufen", label: "Laufen" },
  ];
  var MOUTHS = [
    { id: "hoch", label: "Lächeln" },
    { id: "gerade", label: "Neutral" },
    { id: "runter", label: "Traurig" },
  ];
  // "Aussehen" (Maedchen/Junge) veraendert den Koerper-Mesh selbst NICHT -
  // nur eigene Frisuren + Kleidungssilhouette (Rock). Farben und Accessoire
  // bleiben komplett unberuehrt und frei waehlbar.
  var BODY_TYPES = [
    { id: "maedchen", label: "Mädchen" },
    { id: "junge", label: "Junge" },
  ];

  // Fuellt fehlende Felder (z.B. aus einem aelteren gespeicherten Stand) mit
  // den Standardwerten auf, statt dass ein unvollstaendiges Objekt spaeter zu
  // "undefined"-Farben oder fehlenden Frisuren fuehrt.
  function withDefaults(partial) {
    return Object.assign({}, DEFAULT_CHAR, partial || {});
  }

  window.BitiFigureData = {
    DEFAULT_CHAR: DEFAULT_CHAR,
    PALETTES: PALETTES,
    POSE_ANGLES_DEG: POSE_ANGLES_DEG,
    HAIR_STYLES_JUNGE: HAIR_STYLES_JUNGE,
    HAIR_STYLES_MAEDCHEN: HAIR_STYLES_MAEDCHEN,
    hairStylesFor: hairStylesFor,
    ACCESSORIES: ACCESSORIES,
    POSES: POSES,
    MOUTHS: MOUTHS,
    BODY_TYPES: BODY_TYPES,
    withDefaults: withDefaults,
  };
})();
