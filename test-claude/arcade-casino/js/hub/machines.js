// Prozedural erzeugte SVG-Automaten und -Tische für die Halle.
// Jede Funktion liefert einen SVG-String. IDs werden pro Automat mit einem
// Präfix versehen, damit Verläufe/Clips sich nicht gegenseitig überschreiben.

import { WHEEL_ORDER, RED } from "../games/roulette/wheel.js";

// ---------- Slot-Symbole (20×20-Box) ----------

export const SYMBOL_SVG = {
  cherry:
    '<path d="M10 3C9 7 6 9 6 12M10 3c1 4 4 6 4 9" stroke="#5be36a" stroke-width="1.6" fill="none"/><circle cx="6" cy="14" r="3.6" fill="#ff2d55"/><circle cx="14" cy="14" r="3.6" fill="#ff2d55"/><circle cx="4.9" cy="12.9" r="1" fill="#fff" opacity=".7"/>',
  lemon: '<ellipse cx="10" cy="10" rx="7.5" ry="5.6" fill="#ffe14d" stroke="#d6a800"/><ellipse cx="8" cy="8.4" rx="2.4" ry="1.2" fill="#fff6b0"/>',
  seven: '<text x="10" y="16.5" text-anchor="middle" font-size="18" font-weight="900" font-family="system-ui,sans-serif" fill="#ff3b3b" stroke="#ffd34d" stroke-width="1">7</text>',
  bar: '<rect x="1.5" y="6" width="17" height="8" rx="2" fill="#20152f" stroke="#ffc53d"/><text x="10" y="12.4" text-anchor="middle" font-size="6" font-weight="900" font-family="system-ui,sans-serif" fill="#ffc53d">BAR</text>',
  bell: '<path d="M10 3C5 3 5.4 9 4 14h12C14.6 9 15 3 10 3Z" fill="#ffc53d" stroke="#c98a00" stroke-width=".8"/><circle cx="10" cy="15.6" r="1.8" fill="#d68a00"/>',
  star: '<polygon points="10,2 12.4,7.6 18.5,8 13.8,11.9 15.3,17.8 10,14.6 4.7,17.8 6.2,11.9 1.5,8 7.6,7.6" fill="#ffd84d" stroke="#fff3a8" stroke-width=".6"/>',
  gem: '<polygon points="10,2 17,8 10,18 3,8" fill="#2de2e6" stroke="#c8ffff" stroke-width=".8"/><polygon points="10,2 13,8 10,18 7,8" fill="#8ff6f8" opacity=".6"/>',
  planet: '<circle cx="10" cy="10" r="5" fill="#9b5cff"/><ellipse cx="10" cy="10" rx="9" ry="2.6" fill="none" stroke="#2de2e6" stroke-width="1.4" transform="rotate(-18 10 10)"/>',
  grapes: '<g fill="#a64dff"><circle cx="7" cy="8" r="2.6"/><circle cx="12" cy="8" r="2.6"/><circle cx="9.5" cy="12" r="2.6"/><circle cx="14" cy="12" r="2.2"/><circle cx="11" cy="16" r="2.4"/></g><path d="M10 6 12 2" stroke="#5be36a" stroke-width="1.4"/>',
  rocket: '<path d="M10 2c4 3 4 9 2 13H8C6 11 6 5 10 2Z" fill="#f4ecff"/><circle cx="10" cy="8" r="1.8" fill="#2de2e6"/><path d="M8 15l-3 3 1-5M12 15l3 3-1-5" fill="#ff3d9a"/><path d="M9 16h2l-1 3Z" fill="#ffc53d"/>',
};

function bulbs(points, color, period = 1.2, r = 2.2) {
  return points
    .map(([x, y], i) => `<circle class="bulb" cx="${x}" cy="${y}" r="${r}" fill="${color}" style="animation-delay:${((i % 2) * period) / 2}s;animation-duration:${period}s"/>`)
    .join("");
}

function line(x1, x2, y, n) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([x1 + ((x2 - x1) * i) / (n - 1), y]);
  return pts;
}

function reel(id, i, x, y, w, hgt, symbols, dur) {
  const size = w * 0.8;
  const step = size * 1.15;
  const list = [...symbols, ...symbols];
  const items = list
    .map((s, k) => `<g transform="translate(${x + (w - size) / 2} ${y + k * step + (hgt - size) / 2 - step / 2}) scale(${size / 20})">${SYMBOL_SVG[s]}</g>`)
    .join("");
  return `<clipPath id="${id}-r${i}"><rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="3"/></clipPath>
  <rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="3" fill="url(#${id}-reelbg)"/>
  <g clip-path="url(#${id}-r${i})"><g class="reel-strip" style="--d:${dur}s;--dist:-${symbols.length * step}px">${items}</g></g>
  <rect x="${x}" y="${y}" width="${w}" height="${hgt}" rx="3" fill="url(#${id}-reelshade)"/>`;
}

function reelDefs(id) {
  return `<linearGradient id="${id}-reelbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9d2ea"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#d9d2ea"/></linearGradient>
  <linearGradient id="${id}-reelshade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".3" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>`;
}

// ---------- Slotmaschinen ----------

function slotCabinet(id, o) {
  const reels = o.reels;
  const sx = 18;
  const sw = 84;
  const gap = 3;
  const rw = (sw - gap * (reels.length - 1)) / reels.length;
  const reelSvg = reels.map((syms, i) => reel(id, i, sx + i * (rw + gap), 58, rw, 46, syms, 2.2 + i * 0.55)).join("");
  return `<svg viewBox="0 0 120 210" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${o.body[1]}"/><stop offset=".5" stop-color="${o.body[0]}"/><stop offset="1" stop-color="${o.body[1]}"/></linearGradient>
    <linearGradient id="${id}-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.top[0]}"/><stop offset="1" stop-color="${o.top[1]}"/></linearGradient>
    ${reelDefs(id)}
  </defs>
  ${o.topperShape}
  <text x="60" y="${o.titleY}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="${o.titleSize}" fill="#fff" style="filter:drop-shadow(0 0 3px ${o.glow})">${o.title}</text>
  ${bulbs(o.bulbs, o.bulbColor)}
  <rect x="8" y="44" width="104" height="156" rx="10" fill="url(#${id}-body)" stroke="${o.trim}" stroke-width="2"/>
  <rect x="13" y="52" width="94" height="58" rx="7" fill="#0b0614" stroke="${o.trim}" stroke-width="1.5"/>
  ${reelSvg}
  <line x1="15" y1="81" x2="105" y2="81" stroke="#ff2d55" stroke-width="1.2" opacity=".85"/>
  <rect class="screen-glow" x="13" y="52" width="94" height="58" rx="7" fill="none" stroke="${o.glow}" stroke-width="2.5" style="filter:blur(1.5px)"/>
  <path d="M14 118h92l6 18H8Z" fill="${o.deck}" stroke="${o.trim}" stroke-width="1"/>
  <circle cx="32" cy="127" r="4.5" fill="#ff3d9a" class="blink"/><circle cx="60" cy="127" r="4.5" fill="#ffc53d"/><circle cx="88" cy="127" r="6" fill="#8cff5a" class="blink" style="animation-delay:.6s"/>
  <rect x="22" y="146" width="76" height="22" rx="4" fill="#0b0614" opacity=".55"/>
  <text x="60" y="161" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="800" font-size="8" fill="${o.glow}" class="blink" style="animation-duration:3s">${o.tagline}</text>
  <rect x="34" y="178" width="52" height="12" rx="3" fill="#000" opacity=".45"/>
  <rect x="38" y="181" width="44" height="2" rx="1" fill="${o.trim}" opacity=".6"/>
  ${o.extra || ""}
</svg>`;
}

export function slotFruitArt(id) {
  return slotCabinet(id, {
    reels: [
      ["cherry", "lemon", "bell", "grapes", "seven"],
      ["lemon", "seven", "cherry", "bell", "grapes"],
      ["bell", "grapes", "seven", "lemon", "cherry"],
    ],
    body: ["#ff3d9a", "#8a1150"],
    top: ["#ffde59", "#ff8a3d"],
    trim: "#ffd6ec",
    deck: "#5d0f3a",
    glow: "#ff3d9a",
    title: "FRUCHT",
    titleY: 30,
    titleSize: 15,
    tagline: "5 LINIEN",
    bulbColor: "#fff3a8",
    bulbs: line(16, 104, 9, 10),
    topperShape: `<path d="M10 44V22C10 8 30 4 60 4s50 4 50 18v22Z" fill="url(#${id}-top)" stroke="#fff3a8" stroke-width="2"/><circle cx="60" cy="40" r="5" fill="#5be36a"/>`,
  });
}

export function slotSevenArt(id) {
  return slotCabinet(id, {
    reels: [
      ["seven", "bar", "cherry", "bar", "star"],
      ["bar", "seven", "star", "cherry", "bar"],
      ["star", "bar", "seven", "bar", "cherry"],
    ],
    body: ["#c4162a", "#5e0712"],
    top: ["#3a0a10", "#160307"],
    trim: "#ffc53d",
    deck: "#3a0a10",
    glow: "#ffc53d",
    title: "777",
    titleY: 33,
    titleSize: 22,
    tagline: "KLASSIK",
    bulbColor: "#ffc53d",
    bulbs: [...line(14, 106, 46, 2), [14, 30], [106, 30], [22, 16], [98, 16], [40, 8], [80, 8], [60, 6]],
    topperShape: `<path d="M10 46V32C10 14 30 4 60 4s50 10 50 28v14Z" fill="url(#${id}-top)" stroke="#ffc53d" stroke-width="2.5"/>`,
    extra: `<rect x="112" y="70" width="4" height="40" rx="2" fill="#bbb"/><path d="M114 70V46" stroke="#ddd" stroke-width="3" stroke-linecap="round"/><circle cx="114" cy="44" r="6" fill="#ff2d55" stroke="#fff" stroke-width="1"/>`,
  });
}

export function slotCosmoArt(id) {
  return slotCabinet(id, {
    reels: [
      ["planet", "star", "gem", "rocket"],
      ["gem", "rocket", "planet", "star"],
      ["star", "planet", "rocket", "gem"],
      ["rocket", "gem", "star", "planet"],
      ["planet", "gem", "rocket", "star"],
    ],
    body: ["#4b1fa8", "#170a3a"],
    top: ["#2de2e6", "#4b1fa8"],
    trim: "#8ff6f8",
    deck: "#1d0d47",
    glow: "#2de2e6",
    title: "KOSMO 5",
    titleY: 31,
    titleSize: 14,
    tagline: "FREISPIELE",
    bulbColor: "#2de2e6",
    bulbs: line(20, 100, 44, 9),
    topperShape: `<path d="M8 46 20 10h80l12 36Z" fill="url(#${id}-top)" stroke="#8ff6f8" stroke-width="2"/><circle cx="24" cy="18" r="1.2" fill="#fff"/><circle cx="96" cy="22" r="1" fill="#fff"/><circle cx="86" cy="14" r="1.4" fill="#fff"/>`,
  });
}

// ---------- Tische ----------

export function blackjackArt(id) {
  const spots = [
    [42, 92],
    [74, 108],
    [110, 114],
    [146, 108],
    [178, 92],
  ];
  const cards = spots
    .slice(1, 4)
    .map(([x, y], i) => `<g transform="translate(${x - 6} ${y - 14}) rotate(${(i - 1) * 6})"><rect width="11" height="15" rx="1.5" fill="#fff" stroke="#ccc" stroke-width=".4"/><text x="3" y="7" font-size="6" font-weight="900" fill="${i % 2 ? "#1b1530" : "#e0245e"}" font-family="system-ui">${["A", "K", "9"][i]}</text></g><g transform="translate(${x - 1} ${y - 12}) rotate(${(i - 1) * 6 + 8})"><rect width="11" height="15" rx="1.5" fill="#fff" stroke="#ccc" stroke-width=".4"/><text x="3" y="7" font-size="6" font-weight="900" fill="${i % 2 ? "#e0245e" : "#1b1530"}" font-family="system-ui">${["J", "7", "Q"][i]}</text></g>`)
    .join("");
  const chips = spots
    .map(([x, y], i) => {
      const c = ["#ff3d9a", "#2de2e6", "#ffc53d", "#8cff5a", "#9b5cff"][i];
      return [0, 1, 2].map((k) => `<ellipse cx="${x}" cy="${y + 8 - k * 2}" rx="5" ry="2.4" fill="${c}" stroke="#fff" stroke-width=".6" stroke-dasharray="1.5 1.5"/>`).join("");
    })
    .join("");
  return `<svg viewBox="0 0 220 160" aria-hidden="true">
  <defs>
    <radialGradient id="${id}-felt" cx=".5" cy=".2" r=".9"><stop offset="0" stop-color="#14857a"/><stop offset="1" stop-color="#073a36"/></radialGradient>
    <linearGradient id="${id}-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4" stop-opacity=".28"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></linearGradient>
    <path id="${id}-arc" d="M50 50A64 40 0 0 0 170 50"/>
  </defs>
  <path class="lamp-cone" d="M96 10h28l60 120H36Z" fill="url(#${id}-cone)"/>
  <rect x="94" y="4" width="32" height="8" rx="4" fill="#2a1a4a" stroke="#ffc53d"/>
  <path d="M10 44h200a100 92 0 0 1-200 0Z" transform="translate(0 10)" fill="#2d1409"/>
  <path d="M10 44h200a100 92 0 0 1-200 0Z" fill="#6b3a22" stroke="#9a5a36" stroke-width="2"/>
  <path d="M20 46h180a90 80 0 0 1-180 0Z" fill="url(#${id}-felt)"/>
  <text font-size="6.4" font-weight="800" fill="#ffc53d" opacity=".9" font-family="system-ui" letter-spacing=".6"><textPath href="#${id}-arc" startOffset="50%" text-anchor="middle">BLACKJACK ZAHLT 3 : 2</textPath></text>
  <text x="110" y="78" text-anchor="middle" font-size="5" font-weight="700" fill="#fff" opacity=".55" font-family="system-ui">DEALER STEHT AUF 17</text>
  <g transform="translate(96 52)"><rect width="13" height="18" rx="1.6" fill="#ff3d9a" stroke="#fff" stroke-width=".6"/><rect x="2" y="2" width="9" height="14" rx="1" fill="none" stroke="#fff" stroke-width=".5" opacity=".7"/></g>
  <g transform="translate(111 52)"><rect width="13" height="18" rx="1.6" fill="#fff" stroke="#ccc" stroke-width=".4"/><text x="3.4" y="8" font-size="7" font-weight="900" fill="#e0245e" font-family="system-ui">A</text></g>
  <rect x="150" y="48" width="26" height="12" rx="2" fill="#0b0614" stroke="#ffc53d" stroke-width=".6"/>
  ${spots.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="7" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".8"/>`).join("")}
  ${cards}
  ${chips}
</svg>`;
}

export function rouletteArt(id) {
  const R = 40;
  const n = WHEEL_ORDER.length;
  const wedges = WHEEL_ORDER.map((num, i) => {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const fill = num === 0 ? "#16a34a" : RED.has(num) ? "#d81e3c" : "#15101f";
    const p = (a, r) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
    return `<path d="M${p(a0, R)}A${R} ${R} 0 0 1 ${p(a1, R)}L${p(a1, R * 0.62)}A${R * 0.62} ${R * 0.62} 0 0 0 ${p(a0, R * 0.62)}Z" fill="${fill}"/>`;
  }).join("");
  const grid = [];
  for (let c = 0; c < 12; c++) {
    for (let r = 0; r < 3; r++) {
      const num = c * 3 + (3 - r);
      grid.push(`<rect x="${120 + c * 8.6}" y="${52 + r * 15}" width="8" height="14" fill="${RED.has(num) ? "#d81e3c" : "#15101f"}" stroke="rgba(255,255,255,.5)" stroke-width=".4"/>`);
    }
  }
  return `<svg viewBox="0 0 240 160" aria-hidden="true">
  <defs>
    <radialGradient id="${id}-felt" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#14857a"/><stop offset="1" stop-color="#073a36"/></radialGradient>
    <radialGradient id="${id}-bowl" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#3a1d10"/><stop offset="1" stop-color="#8a5130"/></radialGradient>
    <linearGradient id="${id}-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3c4" stop-opacity=".25"/><stop offset="1" stop-color="#fff3c4" stop-opacity="0"/></linearGradient>
  </defs>
  <path class="lamp-cone" d="M60 6h24l50 124H10Z" fill="url(#${id}-cone)"/>
  <rect x="8" y="40" width="226" height="112" rx="26" fill="#2d1409" transform="translate(0 8)"/>
  <rect x="8" y="40" width="226" height="112" rx="26" fill="#6b3a22" stroke="#9a5a36" stroke-width="2"/>
  <rect x="16" y="46" width="210" height="98" rx="20" fill="url(#${id}-felt)"/>
  <g transform="translate(62 96) scale(1 .66)">
    <circle r="50" fill="url(#${id}-bowl)"/>
    <g class="spin-slow">${wedges}<circle r="${R * 0.6}" fill="#8a5130"/><circle r="${R * 0.25}" fill="#ffc53d"/><path d="M-14 0h28M0-14v28" stroke="#ffe39a" stroke-width="3" stroke-linecap="round"/></g>
    <g class="spin-rev"><circle cx="0" cy="-45" r="3.4" fill="#fff"/></g>
  </g>
  <g transform="translate(0 4) skewX(-8)">
    <rect x="110" y="52" width="9" height="44" fill="#16a34a" stroke="rgba(255,255,255,.5)" stroke-width=".4"/>
    ${grid.join("")}
    <rect x="120" y="98" width="103" height="10" fill="none" stroke="rgba(255,255,255,.5)" stroke-width=".4"/>
    <ellipse cx="150" cy="66" rx="4" ry="2.2" fill="#ffc53d" stroke="#fff" stroke-width=".6"/>
    <ellipse cx="185" cy="88" rx="4" ry="2.2" fill="#ff3d9a" stroke="#fff" stroke-width=".6"/>
    <ellipse cx="203" cy="60" rx="4" ry="2.2" fill="#2de2e6" stroke="#fff" stroke-width=".6"/>
  </g>
</svg>`;
}

// ---------- Arcade ----------

export function pusherArt(id) {
  const coins = [];
  const rows = [
    [88, 7],
    [100, 8],
    [112, 9],
    [124, 10],
  ];
  rows.forEach(([y, n], r) => {
    const w = 60 + r * 12;
    for (let i = 0; i < n; i++) {
      const x = 75 - w / 2 + (w * (i + 0.5)) / n + ((r * 7 + i * 13) % 5) - 2;
      coins.push(`<ellipse cx="${x.toFixed(1)}" cy="${y + ((i * 7) % 4)}" rx="${4 + r * 0.6}" ry="${1.8 + r * 0.3}" fill="${(i + r) % 9 === 4 ? "#ff3d9a" : "#ffc53d"}" stroke="#a86b00" stroke-width=".5"/>`);
    }
  });
  return `<svg viewBox="0 0 150 215" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d5f73"/><stop offset=".5" stop-color="#16a3b8"/><stop offset="1" stop-color="#0d5f73"/></linearGradient>
    <linearGradient id="${id}-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0f33"/><stop offset="1" stop-color="#2a1a4a"/></linearGradient>
    <linearGradient id="${id}-shine" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <rect x="10" y="4" width="130" height="30" rx="8" fill="#0b0614" stroke="#2de2e6" stroke-width="2"/>
  <text x="75" y="24" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="12" fill="#fff" style="filter:drop-shadow(0 0 3px #2de2e6)">MÜNZKASKADE</text>
  ${bulbs(line(18, 132, 38, 12), "#ffc53d", 0.9, 1.8)}
  <rect x="6" y="42" width="138" height="166" rx="10" fill="url(#${id}-body)" stroke="#8ff6f8" stroke-width="2"/>
  <rect x="16" y="50" width="118" height="92" rx="6" fill="url(#${id}-glass)"/>
  <path d="M30 80h90l14 52H16Z" fill="#3b2566"/>
  <g class="pusher-bar"><rect x="32" y="66" width="86" height="16" rx="2" fill="#7d6f9c"/><rect x="32" y="78" width="86" height="4" fill="#b7a8d6"/></g>
  ${coins.join("")}
  <rect x="16" y="132" width="118" height="5" fill="#ff3d9a" class="blink"/>
  <rect x="16" y="50" width="118" height="92" rx="6" fill="url(#${id}-shine)"/>
  <rect x="24" y="150" width="102" height="18" rx="4" fill="#0b0614" opacity=".6"/>
  <rect x="64" y="155" width="22" height="8" rx="2" fill="#000" stroke="#ffc53d" stroke-width="1"/>
  <rect x="73" y="157" width="4" height="4" fill="#ffc53d" class="blink"/>
  <path d="M30 178h90l-8 22H38Z" fill="#073a46"/>
  <ellipse cx="62" cy="190" rx="6" ry="2.4" fill="#ffc53d"/><ellipse cx="74" cy="192" rx="6" ry="2.4" fill="#ffc53d"/><ellipse cx="86" cy="189" rx="6" ry="2.4" fill="#ffc53d"/>
</svg>`;
}

export function hoopsArt(id) {
  const net = [];
  for (let i = 0; i <= 6; i++) {
    const x = 50 + i * 5;
    net.push(`<path d="M${x} 74L${53 + i * 4} 92" stroke="#fff" stroke-width=".8" opacity=".8"/>`);
  }
  const cage = [];
  for (let i = 0; i < 7; i++) {
    cage.push(`<path d="M14 ${50 + i * 14}L116 ${36 + i * 14}" stroke="#2de2e6" stroke-width=".5" opacity=".25"/>`);
    cage.push(`<path d="M14 ${36 + i * 14}L116 ${50 + i * 14}" stroke="#2de2e6" stroke-width=".5" opacity=".25"/>`);
  }
  return `<svg viewBox="0 0 130 225" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7a1e00"/><stop offset=".5" stop-color="#ff8a3d"/><stop offset="1" stop-color="#7a1e00"/></linearGradient>
    <linearGradient id="${id}-ramp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2566"/><stop offset="1" stop-color="#1e1236"/></linearGradient>
  </defs>
  <rect x="8" y="2" width="114" height="26" rx="8" fill="#0b0614" stroke="#ff8a3d" stroke-width="2"/>
  <text x="65" y="20" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="12" fill="#fff" style="filter:drop-shadow(0 0 3px #ff8a3d)">NEON HOOPS</text>
  <rect x="8" y="30" width="114" height="130" rx="6" fill="#140b24" stroke="url(#${id}-body)" stroke-width="4"/>
  ${cage.join("")}
  <rect x="40" y="38" width="50" height="34" rx="2" fill="rgba(255,255,255,.08)" stroke="#fff" stroke-width="1.5"/>
  <rect x="56" y="50" width="18" height="14" fill="none" stroke="#ff3d9a" stroke-width="1.5" class="blink"/>
  <rect x="96" y="40" width="20" height="12" rx="2" fill="#000" stroke="#ff8a3d" stroke-width=".8"/>
  <text x="106" y="49.5" text-anchor="middle" font-family="monospace" font-weight="900" font-size="8" fill="#ff3d3d" class="blink">24</text>
  ${net.join("")}
  <ellipse cx="65" cy="74" rx="16" ry="3.4" fill="none" stroke="#ff6a00" stroke-width="2.2"/>
  <g class="hoop-ball" style="transform-box:fill-box;transform-origin:center"><circle cx="65" cy="170" r="11" fill="#ff7a1a" stroke="#7a2d00" stroke-width="1"/><path d="M54 170h22M65 159v22M57 162c5 5 5 11 0 16M73 162c-5 5-5 11 0 16" stroke="#7a2d00" stroke-width="1" fill="none"/></g>
  <path d="M8 160h114l6 58H2Z" fill="url(#${id}-ramp)" stroke="#ff8a3d" stroke-width="1.5"/>
  <path d="M30 168h70M24 180h82M18 194h94" stroke="#ff8a3d" stroke-width=".8" opacity=".5"/>
  <circle cx="34" cy="205" r="6" fill="#ff7a1a" stroke="#7a2d00"/><circle cx="96" cy="205" r="6" fill="#ff7a1a" stroke="#7a2d00"/>
</svg>`;
}

export function stackerArt(id) {
  const cells = [];
  const cols = 7;
  const rows = 11;
  const cw = 11;
  const x0 = 60 - (cols * cw) / 2;
  const lit = { 10: [1, 5], 9: [1, 5], 8: [2, 5], 7: [2, 4], 6: [2, 4], 5: [3, 4] };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = lit[r] && c >= lit[r][0] && c <= lit[r][1];
      const fill = on ? (r > 8 ? "#2de2e6" : r > 6 ? "#8cff5a" : "#ffc53d") : "rgba(255,255,255,.06)";
      cells.push(`<rect x="${x0 + c * cw + 1}" y="${44 + r * cw + 1}" width="${cw - 2}" height="${cw - 2}" rx="1.5" fill="${fill}"/>`);
    }
  }
  return `<svg viewBox="0 0 120 210" aria-hidden="true">
  <defs><linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#14532d"/><stop offset=".5" stop-color="#22c55e"/><stop offset="1" stop-color="#14532d"/></linearGradient></defs>
  <rect x="10" y="2" width="100" height="28" rx="8" fill="#0b0614" stroke="#8cff5a" stroke-width="2"/>
  <text x="60" y="21" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="12" fill="#fff" style="filter:drop-shadow(0 0 3px #8cff5a)">TURMBAU</text>
  <rect x="6" y="34" width="108" height="170" rx="10" fill="url(#${id}-body)" stroke="#d9ffc4" stroke-width="2"/>
  <rect x="16" y="40" width="88" height="128" rx="5" fill="#0b0614"/>
  <rect x="${x0}" y="44" width="${cols * cw}" height="${cw}" fill="#ff3d9a" opacity=".2"/>
  <text x="60" y="52.5" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="6" fill="#ff3d9a" class="blink">JACKPOT</text>
  ${cells.join("")}
  <g class="stack-row"><rect x="${x0 + 1}" y="${44 + 3 * cw + 1}" width="${cw - 2}" height="${cw - 2}" rx="1.5" fill="#ff3d9a"/><rect x="${x0 + cw + 1}" y="${44 + 3 * cw + 1}" width="${cw - 2}" height="${cw - 2}" rx="1.5" fill="#ff3d9a"/></g>
  <circle cx="60" cy="186" r="12" fill="#ff3d9a" stroke="#fff" stroke-width="2" class="blink"/>
  <circle cx="60" cy="184" r="8" fill="#ff7ab8"/>
</svg>`;
}

export function cycloneArt(id) {
  const n = 24;
  const r = 40;
  const cx = 65;
  const cy = 98;
  const dur = 1.44;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const jack = i === 0;
    pts.push(`<circle class="chase" cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${jack ? 5 : 3.4}" fill="${jack ? "#ffc53d" : i % 6 === 3 ? "#ff3d9a" : "#2de2e6"}" style="--cd:${dur}s;animation-delay:${((i / n) * dur - dur).toFixed(3)}s"/>`);
  }
  return `<svg viewBox="0 0 130 215" aria-hidden="true">
  <defs><radialGradient id="${id}-dish" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2a1a4a"/><stop offset="1" stop-color="#0b0614"/></radialGradient>
  <linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3b0d5c"/><stop offset=".5" stop-color="#9b5cff"/><stop offset="1" stop-color="#3b0d5c"/></linearGradient></defs>
  <rect x="10" y="2" width="110" height="28" rx="8" fill="#0b0614" stroke="#9b5cff" stroke-width="2"/>
  <text x="65" y="21" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="11.5" fill="#fff" style="filter:drop-shadow(0 0 3px #9b5cff)">LICHTWIRBEL</text>
  <rect x="6" y="34" width="118" height="174" rx="12" fill="url(#${id}-body)" stroke="#e2d1ff" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="52" fill="url(#${id}-dish)" stroke="#e2d1ff" stroke-width="1.5"/>
  ${pts.join("")}
  <text x="${cx}" y="${cy + 3}" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="9" fill="#ffc53d" class="blink">JACKPOT</text>
  <rect x="30" y="160" width="70" height="14" rx="3" fill="#0b0614" opacity=".6"/>
  <text x="65" y="170" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="7" fill="#e2d1ff">TIMING IST ALLES</text>
  <circle cx="65" cy="191" r="11" fill="#ffc53d" stroke="#fff" stroke-width="2"/>
</svg>`;
}

export function plinkoArt(id) {
  const pins = [];
  for (let r = 0; r < 7; r++) {
    for (let i = 0; i < r + 3; i++) {
      const x = 65 + (i - (r + 2) / 2) * 12;
      const y = 50 + r * 12;
      pins.push(`<circle cx="${x}" cy="${y}" r="1.8" fill="#e2d1ff"/>`);
    }
  }
  const slots = ["#ff3d9a", "#ff8a3d", "#ffc53d", "#2de2e6", "#5b4a8a", "#2de2e6", "#ffc53d", "#ff8a3d", "#ff3d9a"]
    .map((c, i) => `<rect x="${65 - 54 + i * 12}" y="136" width="10.5" height="12" rx="2" fill="${c}"/>`)
    .join("");
  return `<svg viewBox="0 0 130 210" aria-hidden="true">
  <defs><linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5b0b3a"/><stop offset=".5" stop-color="#ff3d9a"/><stop offset="1" stop-color="#5b0b3a"/></linearGradient>
  <linearGradient id="${id}-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14072a"/><stop offset="1" stop-color="#2a0f3a"/></linearGradient></defs>
  <rect x="10" y="2" width="110" height="26" rx="8" fill="#0b0614" stroke="#ff3d9a" stroke-width="2"/>
  <text x="65" y="20" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="12" fill="#fff" style="filter:drop-shadow(0 0 3px #ff3d9a)">PLINKO</text>
  <rect x="6" y="32" width="118" height="174" rx="10" fill="url(#${id}-body)" stroke="#ffd1ea" stroke-width="2"/>
  <rect x="12" y="38" width="106" height="114" rx="6" fill="url(#${id}-glass)"/>
  ${pins.join("")}
  ${slots}
  <g class="plinko-ball"><circle cx="65" cy="40" r="4" fill="#fff" style="filter:drop-shadow(0 0 3px #ff3d9a)"/></g>
  <rect x="30" y="162" width="70" height="14" rx="3" fill="#0b0614" opacity=".6"/>
  <text x="65" y="172" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="7.5" fill="#ffd1ea" class="blink">BIS ×200</text>
  <circle cx="65" cy="191" r="10" fill="#ff3d9a" stroke="#fff" stroke-width="2"/>
</svg>`;
}

export function grabberArt(id) {
  const cols = ["#d9893b", "#cfd6e6", "#ffc53d", "#d9893b", "#9b5cff", "#d9893b", "#cfd6e6", "#2de2e6", "#d9893b"];
  const pile = [];
  for (let i = 0; i < 22; i++) {
    const row = i < 9 ? 0 : i < 16 ? 1 : 2;
    const k = i - (row === 0 ? 0 : row === 1 ? 9 : 16);
    const x = 40 + k * 9.5 + row * 5;
    const y = 138 - row * 8;
    pile.push(`<circle cx="${x}" cy="${y}" r="4.6" fill="${cols[(i * 5) % cols.length]}" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>`);
  }
  return `<svg viewBox="0 0 130 210" aria-hidden="true">
  <defs><linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6b4b00"/><stop offset=".5" stop-color="#ffc53d"/><stop offset="1" stop-color="#6b4b00"/></linearGradient>
  <linearGradient id="${id}-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#160c2e"/><stop offset="1" stop-color="#2a1550"/></linearGradient></defs>
  <rect x="10" y="2" width="110" height="26" rx="8" fill="#0b0614" stroke="#ffc53d" stroke-width="2"/>
  <text x="65" y="20" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="11" fill="#fff" style="filter:drop-shadow(0 0 3px #ffc53d)">MÜNZGREIFER</text>
  <rect x="6" y="32" width="118" height="174" rx="10" fill="url(#${id}-body)" stroke="#fff3c4" stroke-width="2"/>
  <rect x="12" y="38" width="106" height="110" rx="5" fill="url(#${id}-glass)"/>
  <rect x="14" y="98" width="16" height="48" fill="rgba(255,197,61,.18)"/>
  <rect x="30" y="94" width="3" height="52" fill="#5b4a8a"/>
  ${pile.join("")}
  <rect x="12" y="38" width="106" height="4" fill="#5b4a8a"/>
  <g class="claw-swing"><path d="M75 40V78" stroke="#b7a8d6" stroke-width="1.4"/><rect x="69" y="76" width="12" height="6" rx="2" fill="#cfc2ee"/><path d="M70 82q-5 8 0 13M80 82q5 8 0 13" stroke="#e9e2ff" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>
  <rect x="28" y="160" width="74" height="14" rx="3" fill="#0b0614" opacity=".6"/>
  <text x="65" y="170" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="7.5" fill="#fff3c4" class="blink">DIAMANT = 30×</text>
  <circle cx="65" cy="191" r="10" fill="#ffc53d" stroke="#fff" stroke-width="2"/>
</svg>`;
}

export function horsesArt(id) {
  const lanes = ["#ff3d9a", "#2de2e6", "#ffc53d", "#8cff5a", "#9b5cff", "#ff8a3d"];
  const horses = lanes
    .map((c, i) => {
      const y = 62 + i * 13;
      const x = 70 + ((i * 37) % 60);
      return `<g class="derby-horse" style="animation-delay:${(i * 0.17).toFixed(2)}s"><ellipse cx="${x}" cy="${y}" rx="9" ry="3.6" fill="#5a3220"/><path d="M${x + 6} ${y - 2}l5-5 3 1-5 6z" fill="#5a3220"/><circle cx="${x - 1}" cy="${y - 5}" r="3" fill="${c}"/></g>`;
    })
    .join("");
  return `<svg viewBox="0 0 240 160" aria-hidden="true">
  <defs><linearGradient id="${id}-turf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d4a2e"/><stop offset="1" stop-color="#0b1f14"/></linearGradient></defs>
  <rect x="6" y="8" width="228" height="26" rx="8" fill="#0b0614" stroke="#8cff5a" stroke-width="2"/>
  <text x="120" y="26" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="13" fill="#fff" style="filter:drop-shadow(0 0 3px #8cff5a)">NEON DERBY</text>
  <rect x="8" y="40" width="224" height="104" rx="10" fill="#2d1409"/>
  <rect x="12" y="44" width="216" height="96" rx="8" fill="url(#${id}-turf)"/>
  ${lanes.map((_, i) => `<line x1="12" x2="228" y1="${56 + i * 13}" y2="${56 + i * 13}" stroke="rgba(255,255,255,.08)"/>`).join("")}
  <g>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((k) => `<rect x="206" y="${44 + k * 8}" width="5" height="8" fill="${k % 2 ? "#fff" : "#111"}"/>`).join("")}</g>
  ${horses}
</svg>`;
}


/** Jukebox (V1.2). Vor dem Kauf dunkel mit Preisschild, danach beleuchtet. */
export function jukeboxArt(id) {
  const tubes = [0, 1, 2, 3, 4, 5].map((i) => `<rect class="jb-tube" x="${22 + i * 15}" y="58" width="9" height="62" rx="4.5" fill="url(#${id}-tube)" style="--i:${i}"/>`).join("");
  return `<svg viewBox="0 0 130 210" aria-hidden="true">
  <defs>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a1206"/><stop offset=".5" stop-color="#c2622a"/><stop offset="1" stop-color="#3a1206"/></linearGradient>
    <linearGradient id="${id}-arch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff3d9a"/><stop offset=".5" stop-color="#ffc53d"/><stop offset="1" stop-color="#2de2e6"/></linearGradient>
    <linearGradient id="${id}-tube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe6a3"/><stop offset="1" stop-color="#ff7a3d"/></linearGradient>
  </defs>
  <path class="jb-arch" d="M10 96 Q10 6 65 6 Q120 6 120 96 Z" fill="none" stroke="url(#${id}-arch)" stroke-width="7"/>
  <path d="M14 96 Q14 12 65 12 Q116 12 116 96 V204 H14 Z" fill="url(#${id}-body)" stroke="#ffd7b8" stroke-width="2"/>
  <path d="M20 96 Q20 20 65 20 Q110 20 110 96 Z" fill="#14072a"/>
  <g class="jb-tubes">${tubes}</g>
  <rect x="22" y="124" width="86" height="22" rx="4" fill="#0b0614" stroke="#ffc53d" stroke-width="1.2"/>
  <text class="jb-title" x="65" y="138.5" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="7.2" fill="#ffe6a3">JUKEBOX</text>
  <g class="jb-grille">${[0, 1, 2, 3, 4].map((i) => `<rect x="24" y="${154 + i * 8}" width="82" height="4" rx="2" fill="#2a0f06"/>`).join("")}</g>
  <circle class="jb-led" cx="65" cy="200" r="3" fill="#2de2e6"/>
  <g class="jb-notes"><text x="96" y="40" font-size="14" fill="#ffc53d">♪</text><text x="26" y="50" font-size="12" fill="#2de2e6">♫</text></g>
  <g class="jb-sale"><rect x="18" y="66" width="94" height="34" rx="6" fill="#0b0614" stroke="#ffc53d" stroke-width="1.5" transform="rotate(-6 65 83)"/>
  <text x="65" y="80" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="9" fill="#ffc53d" transform="rotate(-6 65 83)">ZU VERKAUFEN</text>
  <text class="jb-price" x="65" y="93" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="8" fill="#fff" transform="rotate(-6 65 83)">ANSEHEN</text></g>
</svg>`;
}

/** Lotto-Studio (V1.2): Bildschirm mit Kugelmaschine. */
export function lottoArt(id) {
  const balls = [["#ff3d9a", 50, 82], ["#ffc53d", 66, 74], ["#2de2e6", 80, 86], ["#8cff5a", 60, 92], ["#b98cff", 74, 98], ["#fff", 88, 72]]
    .map(([c, x, y], i) => `<circle class="lt-ball" style="--i:${i}" cx="${x}" cy="${y}" r="6" fill="${c}" stroke="rgba(0,0,0,.3)" stroke-width=".8"/>`)
    .join("");
  return `<svg viewBox="0 0 200 210" aria-hidden="true">
  <defs><linearGradient id="${id}-desk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b0b3a"/><stop offset=".5" stop-color="#4b2a8a"/><stop offset="1" stop-color="#1b0b3a"/></linearGradient>
  <radialGradient id="${id}-dome" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="rgba(255,255,255,.35)"/><stop offset="1" stop-color="rgba(120,180,255,.05)"/></radialGradient></defs>
  <rect x="8" y="4" width="184" height="30" rx="8" fill="#0b0614" stroke="#2de2e6" stroke-width="2"/>
  <text x="100" y="24" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="14" fill="#fff" style="filter:drop-shadow(0 0 3px #2de2e6)">NEON LOTTO</text>
  <circle class="lt-live" cx="22" cy="19" r="4" fill="#ff3d3d"/>
  <rect x="8" y="40" width="184" height="98" rx="8" fill="#0d0820" stroke="#5b4a8a" stroke-width="1.5"/>
  <circle cx="68" cy="86" r="38" fill="#120a2a" stroke="#9bd8ff" stroke-width="2"/>
  <g class="lt-balls">${balls}</g>
  <circle cx="68" cy="86" r="38" fill="url(#${id}-dome)"/>
  <rect x="62" y="122" width="12" height="12" fill="#9bd8ff" opacity=".5"/>
  <text class="lt-next" x="150" y="70" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="9" fill="#9bd8ff">NÄCHSTE</text>
  <text class="lt-time" x="150" y="86" text-anchor="middle" font-family="system-ui" font-weight="900" font-size="13" fill="#fff">ZIEHUNG</text>
  <text class="lt-sub" x="150" y="102" text-anchor="middle" font-family="system-ui" font-weight="700" font-size="8" fill="#ffc53d">4 AUS 20</text>
  <path d="M14 146 H186 L178 204 H22 Z" fill="url(#${id}-desk)" stroke="#b98cff" stroke-width="1.5"/>
  <rect x="40" y="160" width="120" height="12" rx="3" fill="#0b0614" opacity=".7"/>
  <text x="100" y="169" text-anchor="middle" font-family="system-ui" font-weight="800" font-size="7.5" fill="#e2d1ff">TÄGLICH 20 UHR · GROSS ALLE 3 TAGE</text>
</svg>`;
}

export const ART = {
  jukebox: jukeboxArt,
  lotto: lottoArt,
  horses: horsesArt,
  grabber: grabberArt,
  plinko: plinkoArt,
  slotFruit: slotFruitArt,
  slotSeven: slotSevenArt,
  slotCosmo: slotCosmoArt,
  blackjack: blackjackArt,
  roulette: rouletteArt,
  pusher: pusherArt,
  hoops: hoopsArt,
  stacker: stackerArt,
  cyclone: cycloneArt,
};
