// Die zwoelf Finish-Typen.
//
// Ein Finish ist eine FUNKTION, kein Bild. Sie bekommt eine Palette, einen
// Seed und ein eindeutiges Praefix und liefert zurueck:
//
//   defs     SVG-Definitionen. Muss eine Fuellung mit der id `${p}-paint`
//            erzeugen -- das ist der Lack.
//   ueber    optionale Schicht, die UEBER dem Lack liegt (Rauschen, Muster,
//            Leuchten). Wird auf die lackierten Teile beschnitten.
//
// Genau das ist der Punkt aus dem Gespraech: 12 Finishes x 10 Waffen x 15
// Paletten sind 1800 moegliche Skins, und keine davon ist eine Bilddatei.

(function () {
  // ---------- Farbwerkzeug ----------
  function zuRgb(hex) {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function zuHex(r, g, b) {
    const t = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return `#${t(r)}${t(g)}${t(b)}`;
  }
  function heller(hex, menge) {
    const [r, g, b] = zuRgb(hex);
    return zuHex(r + (255 - r) * menge, g + (255 - g) * menge, b + (255 - b) * menge);
  }
  function dunkler(hex, menge) {
    const [r, g, b] = zuRgb(hex);
    return zuHex(r * (1 - menge), g * (1 - menge), b * (1 - menge));
  }
  // 0..1 je Kanal -- fuer feComponentTransfer, das mit Anteilen rechnet
  function anteile(hex) {
    return zuRgb(hex).map((v) => (v / 255).toFixed(3));
  }

  window.FARBE = { heller, dunkler, zuRgb, zuHex };

  // Kleiner deterministischer Zufall, damit derselbe Seed immer dasselbe
  // Muster ergibt -- genau das braucht ein Pattern-Index spaeter auch.
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

  // Beschneidet eine Schicht auf die lackierten Teile.
  function inForm(p, inhalt) {
    return `<g clip-path="url(#${p}-form)">${inhalt}</g>`;
  }

  // Rechteck, das die ganze Waffe abdeckt (fuer Filterschichten).
  function flaeche(vb, extra = "") {
    return `<rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" ${extra}/>`;
  }

  window.FINISHES = [
    {
      id: "lack",
      name: "Lack",
      note: "Eine Farbe, saubere Woelbung. Der Grundfall.",
      bauen(p, pal, seed) {
        const c = pal[0];
        return {
          defs: `<linearGradient id="${p}-paint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${heller(c, 0.22)}"/>
            <stop offset=".46" stop-color="${c}"/>
            <stop offset="1" stop-color="${dunkler(c, 0.3)}"/>
          </linearGradient>`,
        };
      },
    },

    {
      id: "verlauf",
      name: "Verlauf",
      note: "Farbverlauf ueber die ganze Laenge. In CS2 die 'Fade'-Familie.",
      bauen(p, pal, seed) {
        const r = zufall(seed);
        const winkel = 8 + r() * 26;
        const stops = pal
          .slice(0, 4)
          .map((c, i, a) => `<stop offset="${(i / (a.length - 1)).toFixed(3)}" stop-color="${c}"/>`)
          .join("");
        return {
          defs: `<linearGradient id="${p}-paint" x1="0" y1="0" x2="1" y2="0"
                   gradientTransform="rotate(${winkel.toFixed(1)} .5 .5)">${stops}</linearGradient>`,
        };
      },
    },

    {
      id: "hydro",
      name: "Hydrographic",
      note: "Aufgedrucktes Muster. Seed dreht es -- gleiche Skin, anderes Bild.",
      bauen(p, pal, seed) {
        const r = zufall(seed);
        const dreh = Math.round(r() * 90);
        const [c0, c1, c2] = [pal[0], pal[1] || pal[0], pal[2] || pal[1] || pal[0]];
        return {
          defs: `<pattern id="${p}-paint" width="52" height="46" patternUnits="userSpaceOnUse"
                   patternTransform="rotate(${dreh})">
            <rect width="52" height="46" fill="${c0}"/>
            <path d="M26 2 L48 14 L48 34 L26 46 L4 34 L4 14 Z" fill="none" stroke="${c1}" stroke-width="3.4"/>
            <path d="M26 12 L38 19 L38 31 L26 38 L14 31 L14 19 Z" fill="${c2}" opacity=".55"/>
          </pattern>`,
          ueber: inForm(p, flaeche([0, 0, 2000, 2000], `fill="url(#${p}-gloss)"`)),
          extraDefs: `<linearGradient id="${p}-gloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffffff" stop-opacity=".18"/>
            <stop offset=".5" stop-color="#ffffff" stop-opacity="0"/>
          </linearGradient>`,
        };
      },
    },

    {
      id: "spray",
      name: "Spray",
      note: "Gesprueht, unregelmaessig. Jeder Seed setzt die Flecken neu.",
      bauen(p, pal, seed) {
        const r = zufall(seed);
        const c0 = pal[0];
        let flecken = "";
        for (let i = 0; i < 9; i++) {
          const c = pal[1 + Math.floor(r() * (pal.length - 1))] || pal[1];
          flecken += `<ellipse cx="${(r() * 220).toFixed(0)}" cy="${(r() * 220).toFixed(0)}"
            rx="${(18 + r() * 52).toFixed(0)}" ry="${(14 + r() * 40).toFixed(0)}"
            fill="${c}" opacity="${(0.45 + r() * 0.5).toFixed(2)}"
            transform="rotate(${(r() * 180).toFixed(0)} ${(r() * 220).toFixed(0)} ${(r() * 220).toFixed(0)})"/>`;
        }
        return {
          defs: `<pattern id="${p}-paint" width="220" height="220" patternUnits="userSpaceOnUse">
            <rect width="220" height="220" fill="${c0}"/>${flecken}
          </pattern>`,
        };
      },
    },

    {
      id: "anodisiert",
      name: "Anodisiert",
      note: "Metallisch eloxiert: harte Lichtbaender statt weicher Woelbung.",
      bauen(p, pal, seed) {
        const [c0, c1] = [pal[0], pal[1] || pal[0]];
        return {
          defs: `<linearGradient id="${p}-paint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${dunkler(c0, 0.45)}"/>
            <stop offset=".14" stop-color="${heller(c0, 0.48)}"/>
            <stop offset=".26" stop-color="${c0}"/>
            <stop offset=".44" stop-color="${heller(c1, 0.3)}"/>
            <stop offset=".54" stop-color="${dunkler(c0, 0.36)}"/>
            <stop offset=".72" stop-color="${c0}"/>
            <stop offset=".86" stop-color="${heller(c0, 0.22)}"/>
            <stop offset="1" stop-color="${dunkler(c0, 0.5)}"/>
          </linearGradient>`,
        };
      },
    },

    {
      id: "patina",
      name: "Patina",
      note: "Oxidiertes Metall. Echtes Rauschen, kein wiederholtes Muster.",
      bauen(p, pal, seed, vb) {
        const a = anteile(pal[0]);
        const b = anteile(pal[1] || heller(pal[0], 0.4));
        return {
          defs: `<linearGradient id="${p}-paint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${heller(pal[0], 0.1)}"/>
            <stop offset="1" stop-color="${dunkler(pal[0], 0.35)}"/>
          </linearGradient>
          <filter id="${p}-pat" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="5" seed="${seed}"/>
            <feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1"/>
            <feComponentTransfer>
              <feFuncR type="table" tableValues="${a[0]} ${b[0]}"/>
              <feFuncG type="table" tableValues="${a[1]} ${b[1]}"/>
              <feFuncB type="table" tableValues="${a[2]} ${b[2]}"/>
              <feFuncA type="table" tableValues="1 1"/>
            </feComponentTransfer>
          </filter>`,
          ueber: inForm(p, flaeche(vb, `filter="url(#${p}-pat)" opacity=".8"`)),
        };
      },
    },

    {
      id: "carbon",
      name: "Kohlefaser",
      note: "Feines Gewebe. Sehr guenstig, wirkt trotzdem teuer.",
      bauen(p, pal, seed) {
        const c = pal[0];
        return {
          defs: `<pattern id="${p}-paint" width="14" height="14" patternUnits="userSpaceOnUse"
                   patternTransform="rotate(45)">
            <rect width="14" height="14" fill="${dunkler(c, 0.42)}"/>
            <rect width="7" height="7" fill="${c}"/>
            <rect x="7" y="7" width="7" height="7" fill="${heller(c, 0.12)}"/>
          </pattern>`,
        };
      },
    },

    {
      id: "marmor",
      name: "Marmor",
      note: "Farbbaender, vom Rauschen verzogen. Das CS2-'Marble-Fade'-Prinzip.",
      bauen(p, pal, seed, vb) {
        const stops = pal
          .slice(0, 5)
          .map((c, i, a) => `<stop offset="${(i / (a.length - 1)).toFixed(3)}" stop-color="${c}"/>`)
          .join("");
        return {
          defs: `<linearGradient id="${p}-paint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${heller(pal[0], 0.55)}"/>
            <stop offset="1" stop-color="${pal[0]}"/>
          </linearGradient>
          <linearGradient id="${p}-mb" x1="0" y1="0" x2="1" y2=".35">${stops}</linearGradient>
          <filter id="${p}-mf" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.009 0.026" numOctaves="3" seed="${seed}" result="n"/>
            <feDisplacementMap in="SourceGraphic" in2="n" scale="96" xChannelSelector="R" yChannelSelector="G"/>
          </filter>`,
          ueber: inForm(p, flaeche(vb, `fill="url(#${p}-mb)" filter="url(#${p}-mf)"`)),
        };
      },
    },

    {
      id: "neon",
      name: "Neon",
      note: "Dunkler Grund, leuchtende Kanten. Passt zur Bibliothek.",
      bauen(p, pal, seed, vb) {
        const r = zufall(seed);
        // Leuchtstreifen muessen die HELLSTEN Farben der Palette nehmen.
        // pal[1] ist bei vielen Paletten das dunkelste Navy -- auf dunklem
        // Grund war davon nichts zu sehen.
        const nachHelligkeit = [...pal].sort((a, b) => {
          const l = (h) => { const [r0, g0, b0] = zuRgb(h); return 0.299 * r0 + 0.587 * g0 + 0.114 * b0; };
          return l(b) - l(a);
        });
        const glimm = nachHelligkeit[0];
        const glimm2 = nachHelligkeit[1] || glimm;
        const dunkelste = nachHelligkeit[nachHelligkeit.length - 1];
        let streifen = "";
        for (let i = 0; i < 5; i++) {
          const y = vb[1] + ((i + 0.5) * vb[3]) / 5 + (r() - 0.5) * vb[3] * 0.18;
          const fall = vb[3] * (0.12 + r() * 0.2);
          streifen += `<path d="M ${vb[0] - 40} ${y.toFixed(0)} L ${vb[0] + vb[2] + 40} ${(y - fall).toFixed(0)}"
            stroke="${i % 2 ? glimm : glimm2}" stroke-width="${(vb[3] * (0.03 + r() * 0.06)).toFixed(1)}"
            fill="none" stroke-linecap="round"/>`;
        }
        return {
          defs: `<linearGradient id="${p}-paint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${dunkler(dunkelste, 0.15)}"/>
            <stop offset="1" stop-color="${dunkler(dunkelste, 0.6)}"/>
          </linearGradient>
          <filter id="${p}-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>`,
          ueber: inForm(p, `<g filter="url(#${p}-glow)">${streifen}</g>`),
        };
      },
    },

    {
      id: "streifen",
      name: "Streifen",
      note: "Rennstreifen. Klar, laut, sofort erkennbar.",
      bauen(p, pal, seed) {
        const r = zufall(seed);
        const dreh = -35 + Math.round(r() * 70);
        const [c0, c1, c2] = [pal[0], pal[1] || pal[0], pal[2] || pal[1] || pal[0]];
        return {
          defs: `<pattern id="${p}-paint" width="60" height="60" patternUnits="userSpaceOnUse"
                   patternTransform="rotate(${dreh})">
            <rect width="60" height="60" fill="${c0}"/>
            <rect width="22" height="60" fill="${c1}"/>
            <rect x="28" width="9" height="60" fill="${c2}"/>
            <rect x="42" width="4" height="60" fill="${heller(c1, 0.35)}"/>
          </pattern>`,
        };
      },
    },

    {
      id: "tarn",
      name: "Tarnmuster",
      note: "Harte Flecken statt weichem Verlauf -- gestuftes Rauschen.",
      bauen(p, pal, seed, vb) {
        const stufen = pal.slice(0, 4);
        const kanal = (i) => stufen.map((c) => anteile(c)[i]).join(" ");
        return {
          defs: `<linearGradient id="${p}-paint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${pal[0]}"/><stop offset="1" stop-color="${dunkler(pal[0], 0.25)}"/>
          </linearGradient>
          <filter id="${p}-tf" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="3" seed="${seed}"/>
            <feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1"/>
            <feComponentTransfer>
              <feFuncR type="discrete" tableValues="${kanal(0)}"/>
              <feFuncG type="discrete" tableValues="${kanal(1)}"/>
              <feFuncB type="discrete" tableValues="${kanal(2)}"/>
              <feFuncA type="discrete" tableValues="1 1"/>
            </feComponentTransfer>
          </filter>`,
          ueber: inForm(p, flaeche(vb, `filter="url(#${p}-tf)" opacity=".95"`)),
        };
      },
    },

    {
      id: "kristall",
      name: "Kristall",
      note: "Facetten. Jede Flaeche faengt das Licht anders.",
      bauen(p, pal, seed) {
        const r = zufall(seed);
        let facetten = "";
        for (let i = 0; i < 16; i++) {
          const x = r() * 170;
          const y = r() * 170;
          const c = pal[Math.floor(r() * pal.length)];
          const s = 26 + r() * 46;
          facetten += `<path d="M ${x.toFixed(0)} ${y.toFixed(0)}
            L ${(x + s).toFixed(0)} ${(y + r() * 26).toFixed(0)}
            L ${(x + r() * s).toFixed(0)} ${(y + s).toFixed(0)} Z"
            fill="${r() > 0.5 ? heller(c, 0.3) : dunkler(c, 0.28)}" opacity="${(0.55 + r() * 0.45).toFixed(2)}"/>`;
        }
        return {
          defs: `<pattern id="${p}-paint" width="170" height="170" patternUnits="userSpaceOnUse">
            <rect width="170" height="170" fill="${pal[0]}"/>${facetten}
          </pattern>`,
        };
      },
    },
  ];
})();
