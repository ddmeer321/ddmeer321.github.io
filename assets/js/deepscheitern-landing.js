/* DeepScheitern: ein Korridor aus Neonringen, durch den das Scrollen faehrt.
   Die Produkte sind Stationen darin. Der Text steht in der Ringoeffnung --
   deshalb braucht es keinen Schleier ueber dem Hintergrund, die Komposition
   laesst die Mitte frei.

   Ohne WebGL oder ohne Skript bleibt eine normale, lesbare Seite uebrig. */
import * as THREE from "three";
import { EffectComposer } from "../vendor/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../vendor/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "../vendor/jsm/postprocessing/ShaderPass.js";
import { GammaCorrectionShader } from "../vendor/jsm/shaders/GammaCorrectionShader.js";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const mix = (a, b, t) => a + (b - a) * t;

const ABSTAND = 14;        // Abstand zwischen zwei Stationsringen
const ZWISCHEN = 3;        // Fuellringe zwischen den Stationen

let welt = null;

/* ====================== Die Welt ====================== */
function baueWelt(stationen) {
  const canvas = document.getElementById("d-canvas");
  if (!canvas) return null;
  let gl;
  try { gl = canvas.getContext("webgl2") || canvas.getContext("webgl"); } catch { gl = null; }
  if (!gl) return null;

  const schwach = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const schmal = innerWidth < 760;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !schwach, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, schmal || schwach ? 1.5 : 2));
  renderer.setClearColor(0x050507, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050507, 10, 62);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 140);

  // Ein Ring je Station, dazwischen schmalere Fuellringe. Zusammen ergibt das
  // einen Gang mit Fluchtpunkt -- und die Mitte bleibt von selbst leer.
  const ringGeo = new THREE.TorusGeometry(4.2, 0.075, 10, 120);
  const fuellGeo = new THREE.TorusGeometry(4.2, 0.03, 8, 90);
  const ringe = [];

  stationen.forEach((st, i) => {
    const z = -i * ABSTAND;
    // Eine Akzentfarbe fuer alles. Drei Neonfarben nebeneinander wirken
    // nach Jahrmarkt; eine wirkt nach Absicht. Pink ist spaeter allein der
    // Marker fuer "hier bist du".
    const farbe = new THREE.Color(0x22e4d4);
    const mat = new THREE.MeshBasicMaterial({ color: farbe.clone().multiplyScalar(0.28) });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.position.z = z;
    scene.add(ring);
    ringe.push({ mesh: ring, mat, z, farbe, index: i });

    if (i < stationen.length - 1) {
      for (let k = 1; k <= ZWISCHEN; k++) {
        const f = new THREE.Mesh(fuellGeo, new THREE.MeshBasicMaterial({ color: 0x0d2026 }));
        f.position.z = z - (ABSTAND / (ZWISCHEN + 1)) * k;
        f.rotation.z = k * 0.3;
        scene.add(f);
      }
    }
  });

  // Boden: eine ruhige Flaeche, die das Neon auffaengt, kein Spiegelkabinett.
  const bodenGeo = new THREE.PlaneGeometry(60, stationen.length * ABSTAND + 60);
  const boden = new THREE.Mesh(bodenGeo, new THREE.MeshBasicMaterial({ color: 0x04080a, fog: true }));
  boden.rotation.x = -Math.PI / 2;
  boden.position.set(0, -4.3, -(stationen.length * ABSTAND) / 2);
  scene.add(boden);

  // Staubkoerner geben der Bewegung Tiefe, ohne Rechenzeit zu kosten.
  const anzahl = schwach ? 350 : 900;
  const pos = new Float32Array(anzahl * 3);
  const laenge = stationen.length * ABSTAND + 40;
  for (let i = 0; i < anzahl; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 26;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 16;
    pos[i * 3 + 2] = -Math.random() * laenge + 10;
  }
  const staubGeo = new THREE.BufferGeometry();
  staubGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const staub = new THREE.Points(staubGeo,
    new THREE.PointsMaterial({ color: 0x4f8f92, size: 0.055, sizeAttenuation: true, transparent: true, opacity: 0.75 }));
  scene.add(staub);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Zurueckhaltend: das Leuchten soll die Ringe betonen, nicht das Bild fluten.
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), schwach ? 0.26 : 0.38, 0.8, 0.5);
  composer.addPass(bloom);
  // Der Composer rechnet linear; ohne Rueckrechnung nach sRGB wird das Bild
  // sichtbar zu dunkel. Diese three-Fassung hat dafuer noch keinen OutputPass.
  composer.addPass(new ShaderPass(GammaCorrectionShader));

  let fortschritt = 0, ziel = 0, sichtbar = true, laeuft = true, t = 0, zuletzt = 0;
  let stoerung = 0, zeitlupe = false;
  const maus = { x: 0, y: 0 }, soll = { x: 0, y: 0 };

  function groesse() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function bild(jetzt) {
    if (!laeuft) return;
    requestAnimationFrame(bild);
    if (!sichtbar) return;
    // Zeitbasiert statt bildbasiert: ein fester Faktor pro Bild laeuft auf
    // 144 Hz doppelt so schnell wie auf 72 Hz und auf einem langsamen Geraet
    // gar nicht. Auf 100 ms gedeckelt, damit es nach einem Tabwechsel nicht
    // springt.
    const dt = Math.min(0.1, zuletzt ? (jetzt - zuletzt) / 1000 : 0.016);
    zuletzt = jetzt;
    const zieh = 1 - Math.pow(0.0001, dt);   // entspricht ~0.075 bei 60 Hz

    t += (zeitlupe ? 0.09 : 0.48) * dt;
    fortschritt += (ziel - fortschritt) * zieh;
    if (stoerung > 0) stoerung = Math.max(0, stoerung - dt * 0.95);
    maus.x += (soll.x - maus.x) * (1 - Math.pow(0.08, dt));
    maus.y += (soll.y - maus.y) * (1 - Math.pow(0.08, dt));

    const weg = fortschritt * ABSTAND;
    camera.position.set(maus.x * 1.1, mix(0.3, 0.6, Math.sin(t * 0.6) * 0.5 + 0.5) + maus.y * 0.7, 9 - weg);
    camera.rotation.z = Math.sin(t * 0.35) * 0.012 + stoerung * Math.sin(t * 40) * 0.05;
    camera.lookAt(maus.x * 0.6, maus.y * 0.4, camera.position.z - 12);

    // Der Ring, an dem man gerade ist, leuchtet auf; die anderen treten zurueck.
    for (const r of ringe) {
      // Abstand mit Vorzeichen: positiv heisst, der Ring liegt voraus.
      const d = camera.position.z - r.z;
      // Das Maximum liegt bewusst NICHT bei d = 0. Dort steckt die Kamera im
      // Ring, und er fuellt den ganzen Schirm -- genau dann darf er nicht
      // leuchten. Hell wird der Ring, auf den man zufaehrt.
      const naehe = clamp01(1 - Math.abs(d - 9) / 13);
      const hinten = d < 2 ? clamp01((d + 6) / 8) : 1;
      // Der aktuelle Ring hebt sich durch Helligkeit ab, nicht durch einen
      // zweiten Farbton. Pink lebt nur in der Bedienung, nicht in der Szene.
      const kraft = (0.14 + naehe * naehe * 0.78) * hinten;
      r.mat.color.copy(r.farbe).multiplyScalar(kraft);
      r.mesh.rotation.z = r.index * 0.4 + t * 0.12 + stoerung * Math.sin(r.index * 3.3 + t * 30) * 0.6;
      r.mesh.scale.setScalar(1 + stoerung * Math.sin(r.index * 1.7) * 0.12);
    }
    staub.rotation.z = t * 0.015;
    bloom.strength = (schwach ? 0.26 : 0.38) + stoerung * 0.7;
    composer.render();
  }

  addEventListener("resize", groesse);
  addEventListener("pointermove", (e) => {
    soll.x = (e.clientX / innerWidth) * 2 - 1;
    soll.y = -((e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });
  document.addEventListener("visibilitychange", () => { sichtbar = !document.hidden; });

  groesse(); requestAnimationFrame(bild);
  return {
    // Erwartet die Stationsnummer als Kommazahl (2.4 = kurz hinter Station 2),
    // nicht einen Prozentwert. Nur so stehen Text und Ring an derselben Stelle.
    setze: (n) => { ziel = Math.max(0, Math.min(stationen.length - 1, n)); },
    stoere: () => { stoerung = 1; },
    zeitlupe: (an) => { zeitlupe = an; },
    springe: (n) => { ziel = fortschritt = Math.max(0, Math.min(stationen.length - 1, n)); },
  };
}

/* ====================== Scrollen ====================== */
function baueIndex(stationen) {
  const index = document.getElementById("d-index");
  if (!index) return;
  stationen.forEach((st, i) => {
    if (st.el.hasAttribute("hidden")) return;
    const a = document.createElement("a");
    a.href = "#" + st.el.id;
    a.dataset.nr = String(i);
    a.textContent = st.el.dataset.label || st.el.id;
    index.appendChild(a);
  });
}

function initScroll(stationen) {
  const index = document.getElementById("d-index");
  const blaetter = document.getElementById("d-blaetter");
  const wo = document.getElementById("d-wo");
  blaetter?.removeAttribute("hidden");

  function springeZu(i) {
    const ziel = stationen[Math.max(0, Math.min(stationen.length - 1, i))];
    ziel?.el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }
  blaetter?.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
    springeZu(Math.round(aktuell) + Number(b.dataset.schritt));
  }));
  let aktuell = 0;
  // Die Mitte des Bildschirms entscheidet, zwischen welchen Stationen man
  // steht. Daraus wird eine Kommazahl, die exakt der Ringposition entspricht.
  function stationsZahl() {
    const mitte = scrollY + innerHeight / 2;
    const m = stationen.map((st) => st.el.offsetTop + st.el.offsetHeight / 2);
    if (mitte <= m[0]) return 0;
    if (mitte >= m[m.length - 1]) return m.length - 1;
    for (let i = 0; i < m.length - 1; i++) {
      if (mitte >= m[i] && mitte < m[i + 1]) {
        return i + (mitte - m[i]) / (m[i + 1] - m[i]);
      }
    }
    return 0;
  }

  function auf() {
    const n = stationsZahl();
    aktuell = n;
    welt?.setze(n);
    const i = Math.round(n);
    const el = stationen[i]?.el;
    if (wo && el) {
      const name = el.dataset.label || el.id;
      wo.textContent = String(i + 1).padStart(2, "0") + " · " + name;
    }
    index?.querySelectorAll("a").forEach((a) => a.classList.toggle("is-here", Number(a.dataset.nr) === i));
    document.querySelectorAll(".d-pille a").forEach((a) =>
      a.classList.toggle("is-here", a.getAttribute("href") === "#" + el?.id));
  }
  addEventListener("scroll", auf, { passive: true });
  addEventListener("resize", auf);
  auf();
}

/* ====================== Easter Eggs ====================== */
const EGGS = ["konami", "logo", "scheitern", "zeitlupe", "geduld", "ende", "konsole"];

function melde(text) {
  document.querySelectorAll(".d-egg").forEach((e) => e.remove());
  if (!text) return;
  const el = document.createElement("div");
  el.className = "d-egg";
  el.setAttribute("role", "status");
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

function gefunden(id, text) {
  let liste = [];
  try { liste = JSON.parse(localStorage.getItem("ds-funde") || "[]"); } catch { liste = []; }
  const neu = !liste.includes(id);
  if (neu) {
    liste.push(id);
    try { localStorage.setItem("ds-funde", JSON.stringify(liste)); } catch { /* egal */ }
  }
  if (text) melde(`${text}  ·  ${liste.length}/${EGGS.length}`);
  if (liste.length === EGGS.length && neu) {
    setTimeout(() => melde("Alle sieben gefunden. Mehr gibt es wirklich nicht."), 4500);
  }
}

function initEggs() {
  const code = ["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];
  let pos = 0, getippt = "";

  addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase();
    pos = k === code[pos] ? pos + 1 : (k === code[0] ? 1 : 0);
    if (pos === code.length) {
      pos = 0;
      welt?.stoere();
      gefunden("konami", "Der Korridor hat kurz den Halt verloren.");
    }
    if (k.length === 1) {
      getippt = (getippt + k).slice(-9);
      if (getippt === "scheitern") {
        getippt = "";
        const geheim = document.getElementById("geheim");
        if (geheim?.hasAttribute("hidden")) {
          geheim.removeAttribute("hidden");
          welt?.stoere();
          gefunden("scheitern", "Eine achte Station ist aufgetaucht.");
          setTimeout(() => geheim.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }), 700);
        }
      }
    }
    if (e.key === "Shift" && !e.repeat) {
      welt?.zeitlupe(true);
      gefunden("zeitlupe", "Zeitlupe.");
    }
  });
  addEventListener("keyup", (e) => { if (e.key === "Shift") welt?.zeitlupe(false); });

  let klicks = 0, timer = null;
  document.getElementById("d-logo")?.addEventListener("click", (e) => {
    e.preventDefault();
    clearTimeout(timer);
    timer = setTimeout(() => { klicks = 0; }, 1600);
    if (++klicks === 5) {
      klicks = 0;
      let n = 1;
      try {
        n = (parseInt(localStorage.getItem("ds-fails") || "0", 10) || 0) + 1;
        localStorage.setItem("ds-fails", String(n));
      } catch { /* egal */ }
      gefunden("logo", `Fehlversuch Nr. ${n} erfolgreich gescheitert.`);
    }
  });

  let ruhe = null;
  const wach = () => {
    clearTimeout(ruhe);
    ruhe = setTimeout(() => gefunden("geduld", "45 Sekunden nichts getan. Kernkompetenz."), 45000);
  };
  ["pointermove", "keydown", "scroll", "pointerdown"].forEach((ev) => addEventListener(ev, wach, { passive: true }));
  wach();

  // Wer bis ans Ende des Korridors faehrt.
  addEventListener("scroll", () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (max > 0 && scrollY / max > 0.985) gefunden("ende", "Ende des Korridors erreicht.");
  }, { passive: true });

  try {
    console.log("%cDeepScheitern",
      "font-size:30px;font-weight:800;background:linear-gradient(90deg,#ff2d95,#22e4d4);-webkit-background-clip:text;color:transparent");
    console.log("Sieben Dinge sind hier versteckt. Dies ist eins davon.");
    console.log("Tipp: Konami-Code, das Logo, ein getipptes Wort, eine Taste zum Halten, Geduld und das Ende des Gangs.");
    gefunden("konsole", "");
  } catch { /* egal */ }
}

/* ====================== Start ====================== */
function start() {
  const stationen = Array.from(document.querySelectorAll(".d-station")).map((el) => ({
    el, farbe: el.dataset.farbe || null,
  }));

  if (!reduce) {
    try { welt = baueWelt(stationen); } catch (e) { console.warn("Welt nicht gebaut:", e?.message); }
  }
  if (!welt) root.classList.add("no-3d");
  try { baueIndex(stationen); initScroll(stationen); } catch (e) { console.warn(e?.message); }

  try { initEggs(); } catch { /* Deko */ }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
