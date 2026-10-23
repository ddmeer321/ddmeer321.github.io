/* DeepScheitern Landing: gepinnte 3D-Buehne, Scrollszenen, Easter Eggs.
   Alles Bewegte ist optional. Faellt WebGL oder eine Bibliothek aus, bleibt
   die Seite vollstaendig lesbar -- die Inhalte stehen im HTML. */
import * as THREE from "three";
import { EffectComposer } from "../vendor/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "../vendor/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "../vendor/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "../vendor/jsm/postprocessing/ShaderPass.js";
import { GammaCorrectionShader } from "../vendor/jsm/shaders/GammaCorrectionShader.js";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (t) => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;

let stageProgress = 0;   // 0..1 ueber die gesamte gepinnte Buehne
let stages = [];
let hero = null;         // Steuerung der 3D-Szene, von den Eggs benutzt

/* ====================== Scrollsteuerung ====================== */
function showStage(i) {
  stages.forEach((el, k) => el.classList.toggle("is-on", k === i));
}

function initScroll() {
  if (reduce || !window.gsap || !window.ScrollTrigger) {
    root.classList.add("no-anim");
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  root.classList.add("anim-ready");

  stages = Array.from(document.querySelectorAll(".d-stage"));
  const buehne = document.getElementById("buehne");
  if (buehne && stages.length) {
    root.classList.add("stage-mode");
    showStage(0);
    ScrollTrigger.create({
      trigger: buehne,
      start: "top top",
      end: "+=" + stages.length * 110 + "%",
      pin: true,
      pinSpacing: true,
      scrub: 0.6,
      onUpdate: (self) => {
        stageProgress = self.progress;
        showStage(Math.min(stages.length - 1, Math.floor(self.progress * stages.length)));
      },
    });
  }

  gsap.utils.toArray(".reveal").forEach((el, i) => {
    gsap.fromTo(el, { opacity: 0, y: 26 }, {
      opacity: 1, y: 0, duration: 0.7, ease: "power2.out", delay: (i % 3) * 0.07,
      scrollTrigger: { trigger: el, start: "top 86%", once: true },
    });
  });

  // Navigation hebt den Abschnitt hervor, in dem man gerade ist.
  document.querySelectorAll(".d-nav-links a[href^='#']").forEach((link) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    ScrollTrigger.create({
      trigger: target, start: "top 55%", end: "bottom 45%",
      onToggle: (self) => link.classList.toggle("is-here", self.isActive),
    });
  });
}

/* ====================== Produktkarten ====================== */
function initCards() {
  if (reduce || window.matchMedia("(hover: none)").matches) return;
  document.querySelectorAll(".d-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty("--mx", px * 100 + "%");
      card.style.setProperty("--my", py * 100 + "%");
      card.style.transform =
        `perspective(900px) rotateX(${(py - 0.5) * -5}deg) rotateY(${(px - 0.5) * 6}deg) translateY(-3px)`;
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });
}

/* ====================== 3D-Buehne ====================== */
// Eine kleine Szene aus farbigen Flaechen wird zur Umgebungskarte gerechnet.
// Genau das laesst Metall wie Metall aussehen: ohne etwas zum Spiegeln
// bleibt die beste Metalloberflaeche eine graue Flaeche.
function buildEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const s = new THREE.Scene();
  s.background = new THREE.Color(0x05050a);
  const panel = (hex, pos, scale) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: hex }));
    m.position.set(...pos);
    m.scale.set(...scale);
    s.add(m);
  };
  panel(0x3dfff0, [-9, 2, -3], [1, 14, 18]);
  panel(0xff57ab, [9, -2, -1], [1, 14, 18]);
  panel(0xa78bfa, [0, 9, -2], [20, 1, 18]);
  panel(0x1a2440, [0, 3, -12], [22, 16, 1]);
  panel(0x120d20, [0, -8, 0], [20, 1, 20]);
  const tex = pmrem.fromScene(s, 0.05).texture;
  pmrem.dispose();
  s.traverse((o) => { if (o.geometry) { o.geometry.dispose(); o.material.dispose(); } });
  return tex;
}

function initHero() {
  const canvas = document.getElementById("d-canvas");
  if (!canvas || reduce) return null;
  let gl;
  try { gl = canvas.getContext("webgl2") || canvas.getContext("webgl"); } catch { gl = null; }
  if (!gl) return null;

  const weak = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const narrow = window.innerWidth < 760;
  const COUNT = narrow ? 36 : weak ? 48 : 68;
  const maxDpr = narrow || weak ? 1.5 : 2;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !weak, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  // Filmische Tonwertkurve statt harter Abschnitt: Lichter laufen weich aus,
  // statt bei Weiss abzuschneiden. Macht mehr aus als jede zusaetzliche Lampe.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(0, 1.1, 13);

  // Eine Geometrie, ein Material, viele Instanzen: 68 Ringe kosten dadurch
  // nicht 68-mal Arbeit.
  const ring = new THREE.TorusGeometry(1, 0.052, 12, 90);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1b1730, metalness: .9, roughness: 0.2, envMapIntensity: 3.2,
    emissive: 0x1d1530, emissiveIntensity: .45,
  });
  const mesh = new THREE.InstancedMesh(ring, mat, COUNT);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(mesh);

  scene.add(new THREE.AmbientLight(0x30304a, 0.5));
  const l1 = new THREE.PointLight(0x22e4d4, 46, 34); l1.position.set(-6, 3, 4);
  const l2 = new THREE.PointLight(0xff2d95, 46, 34); l2.position.set(6, -2, 2);
  const l3 = new THREE.PointLight(0x8b5cf6, 34, 40); l3.position.set(0, 2, -14);
  scene.add(l1, l2, l3);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 48),
    new THREE.MeshStandardMaterial({ color: 0x040408, metalness: 0.35, roughness: 0.88 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -7.4;
  scene.add(floor);

  // Bloom: Neon ohne Ueberstrahlen sieht aus wie bunter Lack. Schwelle hoch
  // genug, damit nur die Lichtkanten gluehen und nicht die ganze Szene.
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), weak ? 0.55 : 0.8, 0.55, 0.58);
  composer.addPass(bloom);
  // Der Composer rechnet linear. Ohne Rueckrechnung nach sRGB am Ende kommt
  // ein sichtbar zu dunkles Bild heraus -- gemessen 16 % statt 65 % helle
  // Flaeche. Diese three-Fassung hat dafuer noch keinen OutputPass.
  composer.addPass(new ShaderPass(GammaCorrectionShader));

  const dummy = new THREE.Object3D();
  const mouse = { x: 0, y: 0 }, aim = { x: 0, y: 0 };
  let t = 0, visible = true, running = true;
  let scatter = 0;      // Konami
  let glitch = 0;       // "scheitern" getippt
  let slow = false;     // Umschalttaste
  let intro = 0;        // Aufbau beim Laden

  function layout(time) {
    const morph = ease(clamp01((stageProgress - 0.08) / 0.5));
    const build = ease(clamp01(intro));
    for (let i = 0; i < COUNT; i++) {
      const f = i / (COUNT - 1);
      // Welle quer ueber den Schirm
      const wx = (f - 0.5) * 22;
      const wy = Math.sin(f * Math.PI * 2 + time * 0.35) * 1.5;
      const wz = Math.cos(f * Math.PI * 2.2 + time * 0.28) * 1.6;
      // Tunnel, durch den die Kamera fliegt
      const a = f * Math.PI * 6 + time * 0.3;
      const tx = Math.cos(a) * 2.3, ty = Math.sin(a) * 2.3, tz = -f * 54 + 6;
      let x = mix(wx, tx, morph), y = mix(wy, ty, morph), z = mix(wz, tz, morph);

      // Aufbau: die Ringe kommen aus der Tiefe herein.
      z -= (1 - build) * 40 * (0.4 + f);

      if (scatter > 0 || glitch > 0) {
        const amount = Math.max(scatter, glitch * 0.45);
        let n = Math.sin(i * 12.9898 + 78.233) * 43758.5453; n -= Math.floor(n);
        x += (n - 0.5) * 9 * amount;
        y += Math.sin(i * 3.7 + time * 9 * glitch) * 4 * amount;
        z += Math.cos(i * 5.1) * 4 * amount;
      }
      dummy.position.set(x, y, z);
      dummy.rotation.set(
        mix(f * Math.PI * 1.6 + time * 0.22, 0, morph),
        mix(Math.PI / 2, 0, morph),
        f * Math.PI * 2.4 + time * 0.16);
      dummy.scale.setScalar(mix(0.85 + Math.sin(f * Math.PI) * 0.5, 1.5, morph) * mix(0.2, 1, build));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    composer.setSize(r.width, r.height);
    bloom.resolution.set(r.width, r.height);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    if (!visible) return;
    t += (slow ? 0.0012 : 0.0068);
    if (intro < 1) intro = Math.min(1, intro + 0.012);
    mouse.x += (aim.x - mouse.x) * 0.045;
    mouse.y += (aim.y - mouse.y) * 0.045;
    if (scatter > 0) scatter = Math.max(0, scatter - 0.012);
    if (glitch > 0) glitch = Math.max(0, glitch - 0.02);
    layout(t);

    const pm = clamp01((stageProgress - 0.08) / 0.5);
    const fly = clamp01((stageProgress - 0.45) / 0.55);
    mesh.rotation.z = stageProgress * 0.8;
    camera.position.x = mouse.x * 1.5 * (1 - pm);
    camera.position.y = (1.1 + mouse.y * 0.9) * (1 - pm * 0.7);
    camera.position.z = 13 - pm * 7 - fly * 26;
    camera.lookAt(0, 0, camera.position.z - 10);
    // Die Lichter reisen mit der Kamera, sonst bleiben sie am Tunneleingang
    // zurueck und alles weiter hinten versinkt im Dunkeln.
    l1.position.z = 4 + (camera.position.z - 13) * 0.9;
    l2.position.z = 2 + (camera.position.z - 13) * 0.9;
    l3.position.z = -14 + (camera.position.z - 13) * 0.9;
    bloom.strength = (weak ? 0.55 : 0.8) + glitch * 0.9;
    composer.render();
  }

  addEventListener("pointermove", (e) => {
    aim.x = (e.clientX / innerWidth) * 2 - 1;
    aim.y = -((e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => { visible = !document.hidden; });
  if (window.IntersectionObserver) {
    new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      // Ein noch nicht ausgelegtes Element ist 0x0 gross und meldet faelschlich
      // "nicht sichtbar". Uebernaehme man das, bliebe die Schleife fuer immer
      // stehen, weil danach keine Schwelle mehr gekreuzt wird.
      if (!e.boundingClientRect.width && !e.boundingClientRect.height) return;
      visible = e.isIntersecting && !document.hidden;
    }, { threshold: 0 }).observe(canvas);
  }

  resize(); layout(0); frame();
  return {
    scatter: () => { scatter = 1; },
    glitch: () => { glitch = 1; },
    slow: (on) => { slow = on; },
  };
}

/* ====================== Easter Eggs ====================== */
const FUNDE = ["konami", "logo", "scheitern", "titel", "zeitlupe", "geduld", "konsole"];

function gefunden(id, text) {
  let liste = [];
  try { liste = JSON.parse(localStorage.getItem("ds-funde") || "[]"); } catch { liste = []; }
  const neu = !liste.includes(id);
  if (neu) {
    liste.push(id);
    try { localStorage.setItem("ds-funde", JSON.stringify(liste)); } catch { /* egal */ }
  }
  melde(text + (neu ? `  ·  ${liste.length}/${FUNDE.length}` : ""));
  if (liste.length === FUNDE.length) setTimeout(() => melde("Alle sieben gefunden. Mehr gibt es wirklich nicht."), 4600);
  return liste.length;
}

function melde(text) {
  document.querySelectorAll(".d-egg").forEach((e) => e.remove());
  const el = document.createElement("div");
  el.className = "d-egg";
  el.setAttribute("role", "status");
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4300);
}

function initEggs() {
  /* 1. Konami-Code: die Struktur zerfaellt und sammelt sich wieder. */
  const code = ["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];
  let pos = 0;
  /* 3. "scheitern" irgendwo tippen: alles glitcht, und eine siebte Karte
        taucht auf, die sonst nirgends steht. */
  let getippt = "";

  addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase();

    pos = k === code[pos] ? pos + 1 : (k === code[0] ? 1 : 0);
    if (pos === code.length) {
      pos = 0;
      hero?.scatter();
      gefunden("konami", "Alles auseinandergefallen. Wie geplant.");
    }

    if (k.length === 1) {
      getippt = (getippt + k).slice(-9);
      if (getippt === "scheitern") {
        getippt = "";
        hero?.glitch();
        document.getElementById("geheimkarte")?.removeAttribute("hidden");
        gefunden("scheitern", "Siebtes Produkt freigeschaltet. Es ist nicht gut.");
      }
    }

    /* 5. Umschalttaste gedrueckt halten: Zeitlupe. */
    if (e.key === "Shift" && !e.repeat) {
      hero?.slow(true);
      gefunden("zeitlupe", "Zeitlupe. Zum Nachdenken.");
    }
  });
  addEventListener("keyup", (e) => { if (e.key === "Shift") hero?.slow(false); });

  /* 2. Fuenf Klicks aufs Logo: der Fehlversuchszaehler. */
  let klicks = 0, timer = null;
  document.getElementById("d-logo")?.addEventListener("click", (e) => {
    e.preventDefault();
    klicks++;
    clearTimeout(timer);
    timer = setTimeout(() => { klicks = 0; }, 1600);
    if (klicks === 5) {
      klicks = 0;
      let n = 1;
      try {
        n = (parseInt(localStorage.getItem("ds-fails") || "0", 10) || 0) + 1;
        localStorage.setItem("ds-fails", String(n));
      } catch { /* egal */ }
      gefunden("logo", `Fehlversuch Nr. ${n} erfolgreich gescheitert.`);
    }
  });

  /* 4. Dreifachklick auf die Ueberschrift: kurzer Glitch. */
  document.querySelector(".d-title")?.addEventListener("click", (e) => {
    if (e.detail !== 3) return;
    hero?.glitch();
    root.classList.add("is-glitching");
    setTimeout(() => root.classList.remove("is-glitching"), 900);
    gefunden("titel", "Du hast die Ueberschrift kaputtgemacht.");
  });

  /* 6. Einfach 45 Sekunden nichts tun. */
  let ruhe = null;
  const aufwachen = () => {
    clearTimeout(ruhe);
    ruhe = setTimeout(() => gefunden("geduld", "45 Sekunden nichts getan. Das ist hier die Kernkompetenz."), 45000);
  };
  ["pointermove", "keydown", "scroll", "pointerdown"].forEach((ev) =>
    addEventListener(ev, aufwachen, { passive: true }));
  aufwachen();

  /* 7. Wer in die Konsole schaut. */
  try {
    console.log("%cDeepScheitern",
      "font-size:30px;font-weight:800;background:linear-gradient(90deg,#ff2d95,#22e4d4);-webkit-background-clip:text;color:transparent");
    console.log("Sieben Dinge sind hier versteckt. Dies ist eins davon.");
    console.log("Tipp: der Konami-Code, das Logo, ein getipptes Wort, die Ueberschrift, eine Taste zum Halten und schlicht Geduld.");
    gefunden("konsole", "");
    document.querySelectorAll(".d-egg").forEach((e) => e.remove());  // nur zaehlen, nicht melden
  } catch { /* egal */ }
}

/* ====================== Start ====================== */
function start() {
  try { hero = initHero(); } catch (e) { console.warn("3D-Buehne nicht gestartet:", e?.message); }
  try { initScroll(); } catch { root.classList.add("no-anim"); }
  try { initCards(); } catch { /* Deko */ }
  try { initEggs(); } catch { /* Deko */ }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
