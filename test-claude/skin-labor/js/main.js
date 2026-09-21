// Skin-Labor -- Vorschau, ob generierte SVG-Skins wertig aussehen.
//
// Hier wird KEIN Spiel gebaut. Hier wird genau eine Frage beantwortet:
// reicht "Waffenform + Finish + Palette + Seed" aus, damit es nach etwas
// aussieht -- oder wirkt es billig? Alles andere (Kisten, Geld, Inventar)
// kommt erst, wenn diese Frage mit Ja beantwortet ist.

(function () {
  "use strict";

  const { heller, dunkler } = window.FARBE;

  // ---------------------------------------------------------------- Paletten
  const PALETTEN = [
    { id: "asphalt", name: "Asphalt", farben: ["#4b525c", "#2c3138", "#8a929d", "#151a20", "#b9c1cb"] },
    { id: "kobalt", name: "Kobalt", farben: ["#1e4fd8", "#0b1f5e", "#4d86ff", "#071238", "#9dbcff"] },
    { id: "zunder", name: "Zunder", farben: ["#d8391b", "#7a1408", "#ff8a3d", "#2a0803", "#ffd08a"] },
    { id: "giftgruen", name: "Giftgrün", farben: ["#63d81b", "#1f5c08", "#b6ff5a", "#0c2603", "#e8ffc4"] },
    { id: "amethyst", name: "Amethyst", farben: ["#8b3fd8", "#3a0f66", "#c583ff", "#1c0533", "#ecd4ff"] },
    { id: "bernstein", name: "Bernstein", farben: ["#e0a020", "#6d4405", "#ffd166", "#2b1a02", "#fff0c4"] },
    { id: "eisblau", name: "Eisblau", farben: ["#6fc9e8", "#1a5f78", "#b6e9f8", "#0a2d3a", "#eafaff"] },
    { id: "tiefsee", name: "Tiefsee", farben: ["#0f4d52", "#04262a", "#1f8f8a", "#011417", "#7fded6"] },
    { id: "koralle", name: "Koralle", farben: ["#f0556f", "#7a1730", "#ff9bab", "#3d0616", "#ffe0e5"] },
    { id: "dschungel", name: "Dschungel", farben: ["#4a5c2a", "#2b3618", "#7d9146", "#1a2010", "#aebd7e"] },
    { id: "wueste", name: "Wüste", farben: ["#b89268", "#6b4f30", "#e0c49a", "#3a2a17", "#f5e6d0"] },
    { id: "monochrom", name: "Monochrom", farben: ["#e8eaee", "#31353c", "#9aa0aa", "#101318", "#ffffff"] },
  ];

  // Dieselben Stufen und Farben wie Cursor Clicker (js/data/rarities.js),
  // damit sich die Seite wie EIN System anfuehlt und nicht wie zwei.
  const SELTENHEITEN = [
    { id: "common", label: "Common", farbe: "#9ca3af", chance: 55 },
    { id: "uncommon", label: "Uncommon", farbe: "#4ade80", chance: 24 },
    { id: "rare", label: "Rare", farbe: "#38bdf8", chance: 12 },
    { id: "epic", label: "Epic", farbe: "#a855f7", chance: 6 },
    { id: "legendary", label: "Legendary", farbe: "#f59e0b", chance: 2.2 },
    { id: "mythic", label: "Mythic", farbe: "#f43f5e", chance: 0.6 },
    { id: "secret", label: "Secret", farbe: "#e879f9", chance: 0.2 },
  ];

  // Namen entstehen aus zwei Toepfen. 48 x 40 = 1920 Namen, von denen der
  // Seed einen aussucht -- niemand muss 250 Namen von Hand erfinden.
  const WORT_A = [
    "Asphalt", "Kobalt", "Zunder", "Nachtfalter", "Aschekrone", "Polarlicht", "Tiefschlaf",
    "Rostgarde", "Glutkern", "Silberfisch", "Dornenkreis", "Wolfsstunde", "Eisbruch",
    "Funkenflug", "Mitternacht", "Schattenriss", "Goldrausch", "Kaltfront", "Sternenstaub",
    "Splitterglas", "Hochofen", "Nebelbank", "Bernstein", "Rabenflug", "Salzkruste",
    "Lawine", "Halbmond", "Giftpilz", "Kreidefeld", "Donnerhall", "Trugbild", "Zwielicht",
    "Blutmond", "Frostbrand", "Kupferwurm", "Neonrausch", "Steinschlag", "Flutwelle",
    "Irrlicht", "Sandsturm", "Eisenherz", "Wildwuchs", "Tintenfisch", "Sonnenbrand",
    "Glasscherbe", "Papierkranich", "Grubenlicht", "Weltraumschrott",
  ];
  const WORT_B = [
    "", "", "", "", "", "", "", "",
    "II", "Prime", "Null", "Alpha", "Echo", "Delta", "Kollektiv", "Protokoll",
    "Doktrin", "Syndikat", "Ouvertüre", "Fragment", "Relikt", "Kaskade", "Zenit",
    "Nadir", "Vektor", "Paradox", "Chimäre", "Monsun", "Orakel", "Verdikt",
    "Anomalie", "Epilog", "Requiem", "Sirene", "Mirage", "Odyssee", "Phantom",
    "Katalyst", "Schisma", "Vakuum",
  ];

  // CS2-Abnutzungsstufen auf Deutsch. Derselbe Skin, anderer Gegenstand.
  const ZUSTAENDE = [
    { bis: 0.07, name: "Fabrikneu" },
    { bis: 0.15, name: "Minimale Gebrauchsspuren" },
    { bis: 0.38, name: "Feldgetestet" },
    { bis: 0.45, name: "Abgenutzt" },
    { bis: 1.01, name: "Kampfspuren" },
  ];

  function zustandVon(float) {
    return ZUSTAENDE.find((z) => float < z.bis).name;
  }

  function zufall(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6d2b79f5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function nameVon(seed) {
    const r = zufall(seed ^ 0x9e3779b9);
    const a = WORT_A[Math.floor(r() * WORT_A.length)];
    const b = WORT_B[Math.floor(r() * WORT_B.length)];
    return b ? `${a} ${b}` : a;
  }

  // ------------------------------------------------------------- SVG erzeugen
  let laufendeNummer = 0;

  function baueSvg(o) {
    const { waffe, finish, palette, float, seed } = o;
    const p = `sk${laufendeNummer++}`;
    const vb = waffe.viewBox;
    const f = finish.bauen(p, palette.farben, seed, vb);

    const alsPfade = (liste) => liste.map((d) => `<path d="${d}"/>`).join("");
    const lackPfade = alsPfade(waffe.lack);

    // Abnutzung: je hoeher der Float, desto mehr Rauschen kommt durch.
    // 0.00 laesst fast nichts durch, 1.00 fast alles.
    const schwelle = 0.96 - 0.62 * float;
    const kanten = (float * 0.85).toFixed(3);

    const defs = `
      ${f.defs || ""}${f.extraDefs || ""}
      <g id="${p}-lack">${lackPfade}</g>
      <clipPath id="${p}-form">${lackPfade}</clipPath>
      <linearGradient id="${p}-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".30"/>
        <stop offset=".17" stop-color="#ffffff" stop-opacity=".10"/>
        <stop offset=".45" stop-color="#000000" stop-opacity="0"/>
        <stop offset=".78" stop-color="#000000" stop-opacity=".24"/>
        <stop offset="1" stop-color="#000000" stop-opacity=".48"/>
      </linearGradient>
      <linearGradient id="${p}-abrieb" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ccd2dc"/><stop offset="1" stop-color="#767d88"/>
      </linearGradient>
      <linearGradient id="${p}-metall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7c8491"/>
        <stop offset=".28" stop-color="#4c535d"/>
        <stop offset=".52" stop-color="#2e343c"/>
        <stop offset=".74" stop-color="#3a414a"/>
        <stop offset="1" stop-color="#16191e"/>
      </linearGradient>
      <filter id="${p}-wf" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.05 0.1" numOctaves="4" seed="${(seed + 17) % 9999}" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  1 0 0 0 0"/>
        <feComponentTransfer>
          <feFuncA type="linear" slope="16" intercept="${(-16 * schwelle).toFixed(2)}"/>
        </feComponentTransfer>
      </filter>
      <mask id="${p}-wm">
        <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" filter="url(#${p}-wf)"/>
      </mask>`;

    return `<svg class="waffe" viewBox="${vb.join(" ")}" xmlns="http://www.w3.org/2000/svg" role="img"
        aria-label="${waffe.name} mit Finish ${finish.name} in ${palette.name}">
      <defs>${defs}</defs>
      <use href="#${p}-lack" fill="url(#${p}-paint)"/>
      ${f.ueber || ""}
      <use href="#${p}-lack" fill="url(#${p}-shade)"/>
      <use href="#${p}-lack" fill="url(#${p}-abrieb)" mask="url(#${p}-wm)"/>
      <use href="#${p}-lack" fill="none" stroke="#cdd4de" stroke-width="2.4"
           stroke-dasharray="15 11 5 17" stroke-dashoffset="${seed % 40}" opacity="${kanten}"/>
      <g fill="#171b21" stroke="#05070a" stroke-opacity=".4" stroke-width="1.3">${alsPfade(waffe.dunkel)}</g>
      <g fill="none" stroke="#000000" stroke-opacity=".22" stroke-width="1.2">${alsPfade(waffe.linien)}</g>
      <g fill="url(#${p}-metall)">${alsPfade(waffe.metall)}</g>
      <use href="#${p}-lack" fill="none" stroke="#05070a" stroke-opacity=".42" stroke-width="1.3"/>
    </svg>`;
  }

  // ----------------------------------------------------------------- Zustand
  const zustand = {
    waffe: window.WAFFEN[1], // Messer -- zeigt am schnellsten, was moeglich ist
    finish: window.FINISHES[7], // Marmor -- zeigt sofort, was moeglich ist
    palette: PALETTEN[1],
    float: 0.06,
    seed: 4821,
    seltenheit: SELTENHEITEN[4],
  };

  const $ = (s) => document.querySelector(s);
  const buehne = $("#buehne");
  const bogen = $("#bogen");

  function zeichneBuehne() {
    buehne.innerHTML = baueSvg(zustand);

    const s = zustand.seltenheit;
    $("#skin-name").textContent = `${zustand.waffe.name} | ${nameVon(zustand.seed)}`;
    $("#skin-name").style.color = s.farbe;
    $("#skin-stufe").textContent = s.label;
    $("#skin-stufe").style.cssText = `color:${s.farbe};border-color:${s.farbe}55;background:${s.farbe}1a`;
    $("#skin-zustand").textContent = zustandVon(zustand.float);
    $("#skin-float").textContent = zustand.float.toFixed(4);
    $("#skin-seed").textContent = zustand.seed;
    $("#finish-note").textContent = zustand.finish.note;
    $("#buehne").style.setProperty("--glanz", s.farbe);
  }

  function zeichneBogen() {
    bogen.innerHTML = window.FINISHES.map((finish) => {
      const svg = baueSvg({ ...zustand, finish });
      const aktiv = finish.id === zustand.finish.id ? " ist-aktiv" : "";
      return `<button class="bogen-karte${aktiv}" type="button" data-finish="${finish.id}">
        <div class="bogen-bild">${svg}</div>
        <span class="bogen-name">${finish.name}</span>
      </button>`;
    }).join("");
  }

  function allesZeichnen() {
    zeichneBuehne();
    zeichneBogen();
  }

  // ------------------------------------------------------------- Bedienfelder
  function chips(ziel, liste, istAktiv, beschriftung, beiKlick, stilFn) {
    const el = $(ziel);
    el.innerHTML = liste
      .map((x, i) => {
        const stil = stilFn ? stilFn(x) : "";
        return `<button class="chip${istAktiv(x) ? " ist-aktiv" : ""}" type="button"
          data-i="${i}" ${stil}>${beschriftung(x)}</button>`;
      })
      .join("");
    el.onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      beiKlick(liste[Number(b.dataset.i)]);
    };
  }

  function bedienfelderZeichnen() {
    chips("#waffen-chips", window.WAFFEN, (w) => w.id === zustand.waffe.id, (w) => w.name, (w) => {
      zustand.waffe = w;
      allesZeichnen();
      bedienfelderZeichnen();
    });

    chips(
      "#paletten-chips",
      PALETTEN,
      (x) => x.id === zustand.palette.id,
      (x) => `<i style="background:${x.farben[0]}"></i>${x.name}`,
      (x) => {
        zustand.palette = x;
        allesZeichnen();
        bedienfelderZeichnen();
      }
    );

    chips(
      "#stufen-chips",
      SELTENHEITEN,
      (x) => x.id === zustand.seltenheit.id,
      (x) => x.label,
      (x) => {
        zustand.seltenheit = x;
        zeichneBuehne();
        bedienfelderZeichnen();
      },
      (x) => `style="--chip:${x.farbe}"`
    );
  }

  bogen.addEventListener("click", (e) => {
    const b = e.target.closest("[data-finish]");
    if (!b) return;
    zustand.finish = window.FINISHES.find((f) => f.id === b.dataset.finish);
    allesZeichnen();
  });

  // Der Regler zeichnet nur die grosse Waffe neu -- der Kontaktbogen erst
  // beim Loslassen. Sonst rechnet ein Handy zwoelf Rauschfilter pro Pixel.
  const regler = $("#float");
  regler.addEventListener("input", () => {
    zustand.float = Number(regler.value) / 1000;
    zeichneBuehne();
  });
  regler.addEventListener("change", zeichneBogen);

  $("#wuerfeln").addEventListener("click", () => {
    zustand.seed = Math.floor(Math.random() * 9999);
    allesZeichnen();
  });

  // Eine echte Ziehung: alles wuerfeln, Seltenheit nach den Chancen oben.
  $("#ziehen").addEventListener("click", () => {
    const r = Math.random() * 100;
    let summe = 0;
    zustand.seltenheit = SELTENHEITEN.find((s) => (summe += s.chance) >= r) || SELTENHEITEN[0];
    zustand.waffe = window.WAFFEN[Math.floor(Math.random() * window.WAFFEN.length)];
    zustand.finish = window.FINISHES[Math.floor(Math.random() * window.FINISHES.length)];
    zustand.palette = PALETTEN[Math.floor(Math.random() * PALETTEN.length)];
    zustand.seed = Math.floor(Math.random() * 9999);
    // Float wie in CS2: gute Zustaende sind haeufiger, perfekte selten.
    zustand.float = Math.pow(Math.random(), 1.7);
    regler.value = Math.round(zustand.float * 1000);
    allesZeichnen();
    bedienfelderZeichnen();
    buehne.classList.remove("blitz");
    void buehne.offsetWidth;
    buehne.classList.add("blitz");
  });

  // Die Zahl, um die es im Gespraech ging.
  $("#n-waffen").textContent = window.WAFFEN.length;
  $("#n-finishes").textContent = window.FINISHES.length;
  $("#n-paletten").textContent = PALETTEN.length;
  $("#kombis").textContent = (
    window.WAFFEN.length * window.FINISHES.length * PALETTEN.length
  ).toLocaleString("de-DE");
  $("#kombis-voll").textContent = (10 * window.FINISHES.length * 15).toLocaleString("de-DE");

  bedienfelderZeichnen();
  allesZeichnen();
})();
