/* DeepScheitern — eine durchgehende Kamerafahrt durch drei Schauplaetze:
   Skulptur, Spirale aus schwebenden Tafeln, Projekttafeln, zurueck zur
   Skulptur. Der Scrollfortschritt ist die einzige Zeitachse; rueckwaerts
   laeuft alles von selbst rueckwaerts.

   Ohne WebGL oder ohne Skript bleibt die Seite lesbar: die Texte stehen im
   HTML, nicht hier. */
import * as THREE from "three";
import { EffectComposer } from "../vendor/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../vendor/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "../vendor/jsm/postprocessing/ShaderPass.js";
import { GammaCorrectionShader } from "../vendor/jsm/shaders/GammaCorrectionShader.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;
const sat = (v) => Math.min(1, Math.max(0, v));
const mix = (a, b, t) => a + (b - a) * t;
const glatt = (t) => t * t * (3 - 2 * t);
// Abschnittsweise Abbildung: ergibt 0..1 innerhalb eines Fortschrittsfensters.
const fenster = (p, a, b) => sat((p - a) / (b - a));

let P = 0;                 // Scrollfortschritt 0..1, weich nachgezogen
let Pziel = 0;

/* =================== Umgebung fuer die Spiegelungen =================== */
// Fluessiges Chrom zeigt ausschliesslich, was es spiegelt. Ohne Umgebung
// bleibt die beste Metalloberflaeche eine graue Flaeche.
function umgebung(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x060606);
  const platte = (hex, pos, scale, stark = 1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(stark) }));
    m.position.set(...pos); m.scale.set(...scale); s.add(m);
  };
  platte(0xffffff, [0, 10, 0], [24, 1, 24], 1.5);        // Hauptlicht von oben
  platte(0xdddddd, [-11, 1, -4], [1, 16, 22], 0.8);      // Streiflicht links
  platte(0xaaaaaa, [11, -2, 2], [1, 16, 22], 0.55);      // Streiflicht rechts
  platte(0xff2d95, [-5, -6, 8], [8, 1, 8], 0.5);         // Akzent, sparsam
  platte(0x38ff9c, [7, 5, -9], [8, 1, 8], 0.35);
  platte(0x0a0a0a, [0, -9, 0], [26, 1, 26], 1);
  const tex = pm.fromScene(s, 0.04).texture;
  pm.dispose();
  s.traverse((o) => { if (o.geometry) { o.geometry.dispose(); o.material.dispose(); } });
  return tex;
}

/* =================== Tafelinhalte =================== */
// Die Tafeln tragen echte Keyarts aus dem Repo. Wo es keines gibt, wird eine
// Textur gezeichnet -- kein wiederholter Platzhalter.
const TAFELN = [
  { bild: "../assets/img/neon-bot-arena-keyart-v2.webp", titel: "CHAOS IS A FEATURE", quer: true },
  { bild: "../assets/img/arcade-casino-keyart.webp", titel: "PLAY. FAIL. REPEAT.", quer: true },
  { text: "SUPPORT WITHOUT\nSOLUTIONS", ton: "#ff2d95" },
  { bild: "../assets/img/snake-keyart.webp", titel: "ONE MORE TRY", quer: false },
  { bild: "../assets/img/cursor-clicker-keyart.webp", titel: "BUILT TO EXPERIMENT", quer: true },
  { text: "PROFESSIONALLY\nFAILED", ton: "#38ff9c" },
  { bild: "../assets/img/reaction-keyart.webp", titel: "FASTER THAN YOU", quer: false },
  { bild: "../assets/img/tic-tac-toe-keyart.webp", titel: "SOLVED. STILL FUN.", quer: false },
  { text: "100 TRILLIONEN\nNICHTLOESUNGEN", ton: "#888888" },
  { bild: "../assets/img/neon-bot-arena-scene.png", titel: "NEON BOT ARENA", quer: true },
  { text: "WIR SCHEITERN\nTIEF", ton: "#f5f5f5" },
  { bild: "../assets/img/arcade-casino-keyart.webp", titel: "NEONPALAST", quer: false },
];

function textTextur(eintrag) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 640;
  const g = c.getContext("2d");
  g.fillStyle = "#0b0b0b"; g.fillRect(0, 0, c.width, c.height);
  // Feines Raster: gibt der Flaeche Material, ohne bunt zu werden.
  g.strokeStyle = "rgba(245,245,245,.05)"; g.lineWidth = 1;
  for (let x = 0; x < c.width; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
  for (let y = 0; y < c.height; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  g.fillStyle = eintrag.ton;
  g.font = "700 86px 'Space Grotesk', system-ui, sans-serif";
  g.textBaseline = "top";
  eintrag.text.split("\n").forEach((z, i) => g.fillText(z, 64, 180 + i * 96));
  g.fillStyle = "rgba(245,245,245,.35)";
  g.font = "500 26px 'IBM Plex Mono', monospace";
  g.fillText("DEEPSCHEITERN®", 64, 520);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bildTextur(eintrag, lader, beschriften) {
  const t = lader.load(eintrag.bild, () => beschriften());
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* =================== Die Welt =================== */
function baueWelt() {
  const canvas = document.getElementById("gl");
  if (!canvas) return null;
  let gl;
  try { gl = canvas.getContext("webgl2") || canvas.getContext("webgl"); } catch { gl = null; }
  if (!gl) return null;

  const schwach = (navigator.hardwareConcurrency || 8) <= 4;
  const schmal = innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !schwach, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, schmal || schwach ? 1.5 : 2));
  renderer.setClearColor(0x050505, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050505, 0.017);
  scene.environment = umgebung(renderer);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);

  /* ---- 1. Die Skulptur: ein verdrehtes Emblem aus fluessigem Chrom ---- */
  const chrom = new THREE.MeshStandardMaterial({
    color: 0xc9ccd1, metalness: 1, roughness: 0.08, envMapIntensity: 1.35,
  });
  const skulptur = new THREE.Group();
  const knoten = new THREE.Mesh(new THREE.TorusKnotGeometry(1.5, 0.42, schwach ? 180 : 420, schwach ? 24 : 48, 2, 3), chrom);
  skulptur.add(knoten);
  const reif = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.045, 12, 180),
    new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 1, roughness: 0.2, envMapIntensity: 1.1 }));
  reif.rotation.x = Math.PI / 2.6;
  skulptur.add(reif);
  scene.add(skulptur);

  /* ---- 2. Die Spirale: echte Helix aus schwebenden Tafeln ---- */
  // x = r·cos(w), y = steigung·w, z = r·sin(w). Die Kamera faehrt spaeter
  // mitten hindurch, deshalb zeigt jede Tafel zur Achse statt nach aussen.
  const RADIUS = 11;
  const STEIGUNG = 1.75;       // Hoehengewinn je Bogenmass
  const ANZAHL = schwach ? 30 : 54;
  const SCHRITT = 0.56;        // Winkelabstand zweier Tafeln
  const spirale = new THREE.Group();
  const lader = new THREE.TextureLoader();
  const tafeln = [];
  const rahmenMat = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 1, roughness: 0.22, envMapIntensity: 1.2 });

  for (let i = 0; i < ANZAHL; i++) {
    const eintrag = TAFELN[i % TAFELN.length];
    const w = i * SCHRITT;
    const quer = eintrag.quer !== false;
    // Masse leicht variieren, damit keine zwei Tafeln gleich aussehen.
    const jitter = 0.86 + ((i * 37) % 23) / 60;
    const bb = (quer ? 5.6 : 3.4) * jitter;
    const hh = (quer ? 3.3 : 4.8) * jitter;

    const tex = eintrag.bild
      ? bildTextur(eintrag, lader, () => {})
      : textTextur(eintrag);
    const flaeche = new THREE.Mesh(new THREE.PlaneGeometry(bb, hh),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    const rahmen = new THREE.Mesh(new THREE.BoxGeometry(bb + 0.16, hh + 0.16, 0.1), rahmenMat);
    rahmen.position.z = -0.06;

    const tafel = new THREE.Group();
    tafel.add(rahmen, flaeche);
    tafel.position.set(Math.cos(w) * RADIUS, STEIGUNG * w, Math.sin(w) * RADIUS);
    // Zur Mittelachse drehen, damit der Inhalt lesbar bleibt.
    tafel.lookAt(0, STEIGUNG * w, 0);
    tafel.rotation.z += (((i * 53) % 17) - 8) * 0.004;
    spirale.add(tafel);
    tafeln.push({ g: tafel, w });
  }
  const SP_HOCH = STEIGUNG * (ANZAHL - 1) * SCHRITT;
  // Die Spirale liegt vollstaendig UNTER der Skulptur. Sonst steht die
  // Kamera schon in der Eroeffnung mitten zwischen den Tafeln, und die
  // geforderte Dunkelheit am Anfang gibt es nicht.
  spirale.position.y = -SP_HOCH - 16;
  scene.add(spirale);

  /* ---- 3. Staub ---- */
  const n = schwach ? 700 : 2200;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i*3] = (Math.random() - 0.5) * 70;
    pos[i*3+1] = (Math.random() - 0.5) * 160;
    pos[i*3+2] = (Math.random() - 0.5) * 70;
  }
  const staubGeo = new THREE.BufferGeometry();
  staubGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const staub = new THREE.Points(staubGeo, new THREE.PointsMaterial({
    color: 0x9aa0a8, size: 0.045, sizeAttenuation: true, transparent: true, opacity: 0.6, depthWrite: false,
  }));
  scene.add(staub);

  /* ---- Licht ---- */
  scene.add(new THREE.AmbientLight(0x303236, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(4, 9, 6); scene.add(key);
  const pink = new THREE.PointLight(0xff2d95, 26, 34); scene.add(pink);
  const gruen = new THREE.PointLight(0x38ff9c, 18, 30); scene.add(gruen);

  /* ---- Nachbearbeitung ---- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), schwach ? 0.3 : 0.5, 0.75, 0.72);
  composer.addPass(bloom);
  // Der Composer rechnet linear; ohne Rueckrechnung nach sRGB wird das Bild
  // sichtbar zu dunkel. Diese three-Fassung hat noch keinen OutputPass.
  composer.addPass(new ShaderPass(GammaCorrectionShader));

  let t = 0, sichtbar = true, zuletzt = 0;
  const maus = { x: 0, y: 0 }, soll = { x: 0, y: 0 };
  const blick = new THREE.Vector3();

  function groesse() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ---- Die Kamerafahrt: eine Funktion von P ---- */
  function fahre() {
    // Abschnitte: Skulptur 0–.18 | Anflug .18–.30 | durch die Spirale .30–.66
    //             Projekttafeln .66–.86 | Rueckweg .86–1
    const a = fenster(P, 0, 0.18);
    const b = fenster(P, 0.18, 0.30);
    const c = fenster(P, 0.30, 0.66);
    const d = fenster(P, 0.66, 0.86);
    const e = fenster(P, 0.86, 1);

    // Skulptur: dreht immer, weicht beim Anflug zur Seite und kehrt zum Schluss zurueck.
    skulptur.rotation.y = t * 0.19;
    skulptur.rotation.x = Math.sin(t * 0.13) * 0.22;
    skulptur.position.set(mix(0, -16, glatt(b)) + mix(0, 16, glatt(e)), mix(0, 5, glatt(b)) - mix(0, 5, glatt(e)), 0);
    skulptur.scale.setScalar(mix(mix(0.45, 1.5, glatt(a)), 0.8, glatt(b)) + glatt(e) * 0.4);
    reif.rotation.z = -t * 0.26;

    // Spirale dreht sich langsam um die eigene Achse.
    spirale.rotation.y = t * 0.035 + glatt(c) * 0.5;

    // Kamera. zielPkt statt nur zielY: in der Spirale muss die Kamera ENTLANG
    // der Schraube blicken. Zielte sie auf die Mittelachse, waere der Blick
    // fast senkrecht nach oben -- dort wird der Aufwaertsvektor instabil und
    // die Tafeln kippen sichtbar weg.
    let x, y, z, zielY;
    let zielX = 0, zielZ = 0;
    if (P < 0.30) {
      // Heranfahren an die Skulptur, dann hinab zum Fuss der Spirale.
      const naeher = mix(16, 5.6, glatt(a));
      x = Math.sin(t * 0.1) * 0.5 + maus.x * 0.9;
      y = mix(1.2, 0.2, glatt(a)) * (1 - glatt(b)) + mix(0, spirale.position.y + 1.5, glatt(b)) + maus.y * 0.6;
      z = mix(naeher, 5.2, glatt(b));
      zielY = mix(0, spirale.position.y + 4, glatt(b));
    } else if (P < 0.66) {
      // Mitten durch die Helix: die Kamera folgt derselben Schraube,
      // aber auf kleinerem Radius, damit die Tafeln aussen vorbeiziehen.
      const w = c * (ANZAHL - 1) * SCHRITT;
      const r = 4.6;
      x = Math.cos(w) * r + maus.x * 0.7;
      z = Math.sin(w) * r + maus.y * 0.4;
      y = spirale.position.y + STEIGUNG * w + 0.4;
      // Blickpunkt ein Stueck weiter auf derselben Schraube.
      const vor = w + 1.15;
      zielX = Math.cos(vor) * r;
      zielZ = Math.sin(vor) * r;
      zielY = spirale.position.y + STEIGUNG * vor + 0.4;
    } else {
      // Heraus aus der Spirale, offener Raum fuer die Projekttafeln,
      // danach zurueck in die Dunkelheit zur Skulptur.
      const raus = glatt(d);
      const heim = glatt(e);
      x = mix(mix(3.4, 10, raus), 0, heim) + maus.x * 0.8;
      y = mix(spirale.position.y + SP_HOCH + 1, spirale.position.y + SP_HOCH + 6, raus) * (1 - heim) + maus.y * 0.5;
      z = mix(mix(0, 16, raus), 14, heim);
      zielY = y - mix(0, 2, heim);
    }
    camera.position.set(x, y, z);
    blick.set(mix(zielX, skulptur.position.x, glatt(e)), zielY, zielZ);
    camera.lookAt(blick);
    camera.rotation.z += Math.sin(t * 0.21) * 0.012;

    // Akzentlichter wandern mit, sonst bleiben sie am Anfang zurueck.
    pink.position.set(Math.cos(t * 0.4) * 9, camera.position.y + 3, Math.sin(t * 0.4) * 9);
    gruen.position.set(Math.cos(t * 0.4 + 2.4) * 10, camera.position.y - 4, Math.sin(t * 0.4 + 2.4) * 10);
    staub.position.y = camera.position.y;
  }

  function bild(jetzt) {
    requestAnimationFrame(bild);
    if (!sichtbar) return;
    // Zeitbasiert, nicht bildbasiert: ein fester Faktor je Bild laeuft auf
    // 144 Hz doppelt so schnell wie auf 72 Hz.
    const dt = Math.min(0.1, zuletzt ? (jetzt - zuletzt) / 1000 : 0.016);
    zuletzt = jetzt;
    t += dt;
    P += (Pziel - P) * (1 - Math.pow(0.0005, dt));
    maus.x += (soll.x - maus.x) * (1 - Math.pow(0.05, dt));
    maus.y += (soll.y - maus.y) * (1 - Math.pow(0.05, dt));
    fahre();
    composer.render();
  }

  addEventListener("resize", groesse);
  addEventListener("pointermove", (ev) => {
    soll.x = (ev.clientX / innerWidth) * 2 - 1;
    soll.y = -((ev.clientY / innerHeight) * 2 - 1);
  }, { passive: true });
  document.addEventListener("visibilitychange", () => { sichtbar = !document.hidden; });

  groesse();
  requestAnimationFrame(bild);
  return { setze: (p) => { Pziel = sat(p); }, springe: (p) => { Pziel = P = sat(p); } };
}

/* =================== Szenen, Scrollen, Zeiger =================== */
function initSeite(welt) {
  const szenen = Array.from(document.querySelectorAll(".szene")).map((el) => ({
    el, von: parseFloat(el.dataset.von), bis: parseFloat(el.dataset.bis),
  }));
  const balken = document.getElementById("fortschritt");
  const hinweis = document.getElementById("hinweis");
  const links = Array.from(document.querySelectorAll(".nav-rechts a"));

  function fortschritt() {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? sat(scrollY / max) : 0;
  }

  function auf() {
    const p = fortschritt();
    welt?.setze(p);
    szenen.forEach((s) => s.el.classList.toggle("an", p >= s.von && p <= s.bis));
    if (balken) balken.style.width = (p * 100).toFixed(2) + "%";
    hinweis?.classList.toggle("weg", p > 0.04);
    links.forEach((a) => a.classList.toggle("aktiv", Math.abs(p - parseFloat(a.dataset.zu)) < 0.1));
  }

  // Lenis macht das Scrollen traege und filmisch. Faellt es aus, scrollt der
  // Browser ganz normal -- die Seite haengt nicht daran.
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.25, smoothWheel: true });
    const schleife = (zeit) => { lenis.raf(zeit); requestAnimationFrame(schleife); };
    requestAnimationFrame(schleife);
    lenis.on("scroll", auf);
  }
  addEventListener("scroll", auf, { passive: true });
  addEventListener("resize", auf);

  function zu(p) {
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = p * max;
    if (lenis) lenis.scrollTo(y, { duration: 1.6 });
    else scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
  }
  links.forEach((a) => a.addEventListener("click", (ev) => { ev.preventDefault(); zu(parseFloat(a.dataset.zu)); }));
  document.getElementById("marke")?.addEventListener("click", (ev) => { ev.preventDefault(); zu(0); });
  document.getElementById("nochmal")?.addEventListener("click", () => zu(0));

  // Eigener Zeiger, der ueber anklickbaren Dingen aufgeht.
  const zeiger = document.getElementById("zeiger");
  if (zeiger && !matchMedia("(hover: none)").matches) {
    addEventListener("pointermove", (ev) => {
      zeiger.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`;
      const ziel = ev.target instanceof Element ? ev.target.closest("a, button, .projekt") : null;
      zeiger.classList.toggle("weit", Boolean(ziel));
    }, { passive: true });
  }

  auf();
}

/* =================== Easter Eggs =================== */
const EGGS = ["konami", "marke", "scheitern", "ende", "konsole"];
function melde(text) {
  document.querySelectorAll(".d-egg").forEach((e) => e.remove());
  if (!text) return;
  const el = document.createElement("div");
  el.className = "d-egg knopf";
  el.style.cssText = "position:fixed;left:50%;bottom:72px;translate:-50% 0;z-index:50;margin:0;pointer-events:none";
  el.setAttribute("role", "status");
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}
function gefunden(id, text) {
  let liste = [];
  try { liste = JSON.parse(localStorage.getItem("ds-funde") || "[]"); } catch { liste = []; }
  if (!liste.includes(id)) {
    liste.push(id);
    try { localStorage.setItem("ds-funde", JSON.stringify(liste)); } catch { /* egal */ }
  }
  if (text) melde(`${text} · ${liste.length}/${EGGS.length}`);
}
function initEggs(welt) {
  const code = ["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];
  let pos = 0, getippt = "";
  addEventListener("keydown", (ev) => {
    const k = (ev.key || "").toLowerCase();
    pos = k === code[pos] ? pos + 1 : (k === code[0] ? 1 : 0);
    if (pos === code.length) { pos = 0; welt?.springe(0.42); gefunden("konami", "Direkt in die Spirale geworfen."); }
    if (k.length === 1) {
      getippt = (getippt + k).slice(-9);
      if (getippt === "scheitern") { getippt = ""; welt?.springe(0.98); gefunden("scheitern", "Ans Ende gescheitert."); }
    }
  });
  let klicks = 0, timer = null;
  document.getElementById("marke")?.addEventListener("click", () => {
    clearTimeout(timer); timer = setTimeout(() => { klicks = 0; }, 1500);
    if (++klicks === 5) {
      klicks = 0;
      let n = 1;
      try { n = (parseInt(localStorage.getItem("ds-fails") || "0", 10) || 0) + 1;
            localStorage.setItem("ds-fails", String(n)); } catch { /* egal */ }
      gefunden("marke", `Fehlversuch Nr. ${n} erfolgreich gescheitert.`);
    }
  });
  addEventListener("scroll", () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max > 0 && scrollY / max > 0.985) gefunden("ende", "Ende erreicht. Nochmal?");
  }, { passive: true });
  try {
    console.log("%cDEEPSCHEITERN®", "font-size:28px;font-weight:700;color:#f5f5f5");
    console.log("Wir scheitern tief. Professionell. — Fünf Dinge sind hier versteckt.");
    gefunden("konsole", "");
  } catch { /* egal */ }
}

/* =================== Start =================== */
function start() {
  let welt = null;
  if (!reduce) {
    try { welt = baueWelt(); } catch (e) { console.warn("3D nicht gestartet:", e?.message); }
  }
  if (!welt) root.classList.add("kein-gl");
  try { initSeite(welt); } catch (e) { console.warn(e?.message); }
  try { initEggs(welt); } catch { /* Deko */ }
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
