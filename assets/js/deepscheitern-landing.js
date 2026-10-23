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
const klemm = (t) => Math.min(1, Math.max(0, t));
// Rastender Fortschritt: zweimal geglaettet bleibt der Wert nahe jeder
// ganzen Zahl laenger stehen -- die Kamera haelt an jeder Tafel an,
// statt gleichmaessig durchzufahren.
function rasten(u) {
  const i = Math.floor(u);
  const f = klemm(u - i);
  const g = glatt(glatt(f));
  return { pos: i + g, naehe: 1 - 4 * g * (1 - g), tafel: g < 0.5 ? i : i + 1 };
}
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

/* =================== Tafelinhalte ===================
   Wenige, grosse Tafeln -- je eine Sache. Keine Spielbilder: die Tafel zeigt
   das Produkt, nicht dessen Werbung. Jede ist anklickbar. */
const TAFELN = [
  { marke: "Kapitel 01", titel: "DEEP\nPLAY",     unter: "Spielen. Scheitern. Wiederholen.", ziel: "../index.html",           quer: true  },
  { marke: "Kapitel 02", titel: "DEEP\nSERVICE",  unter: "Support, der nichts garantiert.",  ziel: null,                       quer: false },
  { marke: "Kapitel 03", titel: "NEON BOT\nARENA", unter: "Chaos ist kein Bug.",              ziel: "../neon-bot-arena.html",   quer: true  },
  { marke: "Kapitel 04", titel: "DEEP\nLABS",     unter: "Gebaut, um zu experimentieren.",   ziel: null,                       quer: false },
  { marke: "Kapitel 05", titel: "DEEP\nAI",       unter: "Noch nichts gebaut.",              ziel: null,                       quer: true  },
  { marke: "Kapitel 06", titel: "PROFESSIONALLY\nFAILED",  unter: "Wir scheitern tief.",     ziel: null,                       quer: false },
];

// Die Beschriftung liegt als eigene, scharfe Ebene vor dem Milchglas --
// durch das Glas gerechnet waere sie mit verwaschen.
function schriftTextur(eintrag, quer) {
  const c = document.createElement("canvas");
  c.width = quer ? 1280 : 900;
  c.height = quer ? 760 : 1180;
  const g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  const mitte = c.width / 2;

  // Der ganze Textblock wird als Einheit vertikal zentriert und in
  // Einheiten der kurzen Kante bemessen. So sieht Hoch- wie Querformat
  // gleich aus, statt im Hochformat auseinanderzufallen.
  const u = Math.min(c.width, c.height);
  const gross = Math.round(u * (quer ? 0.155 : 0.135));
  const klein = Math.round(u * 0.036);
  const zeilen = eintrag.titel.split("\n");
  const hoehe = klein * 1.9 + zeilen.length * gross * 1.04
              + klein * 2.0 + (eintrag.ziel ? klein * 1.7 : 0);
  let y = c.height / 2 - hoehe / 2 + klein;

  g.textAlign = "center";
  g.fillStyle = "rgba(245,245,245,.72)";
  g.font = `500 ${Math.round(klein * 0.78)}px 'IBM Plex Mono', monospace`;
  g.fillText(eintrag.marke.toUpperCase(), mitte, y);
  y += klein * 1.9;

  // Lange Woerter wie PROFESSIONALLY laufen sonst ueber den Tafelrand.
  let passend = gross;
  const platz = c.width * 0.86;
  for (let n = 0; n < 12; n++) {
    g.font = `500 ${passend}px 'Space Grotesk', system-ui, sans-serif`;
    const breit = Math.max(...zeilen.map((z) => g.measureText(z).width));
    if (breit <= platz) break;
    passend = Math.round(passend * (platz / breit));
  }
  g.font = `500 ${passend}px 'Space Grotesk', system-ui, sans-serif`;
  g.shadowColor = "rgba(255,255,255,.45)";
  g.shadowBlur = passend * 0.3;
  g.fillStyle = "#ffffff";
  zeilen.forEach((z, i) => g.fillText(z, mitte, y + gross * 0.82 + i * gross * 1.04));
  g.shadowBlur = 0;
  y += zeilen.length * gross * 1.04 + klein * 1.4;

  g.fillStyle = "rgba(245,245,245,.7)";
  g.font = `400 ${Math.round(klein * 0.84)}px 'IBM Plex Mono', monospace`;
  g.fillText(eintrag.unter, mitte, y);

  if (eintrag.ziel) {
    y += klein * 1.7;
    g.fillStyle = "rgba(56,255,156,.92)";
    g.font = `500 ${Math.round(klein * 0.74)}px 'IBM Plex Mono', monospace`;
    g.fillText("ANKLICKEN \u2192", mitte, y);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Gerundetes Rechteck als Flaeche -- three bringt dafuer nichts mit.
function rundesRechteck(b, h, r) {
  const f = new THREE.Shape();
  f.moveTo(-b / 2 + r, -h / 2);
  f.lineTo(b / 2 - r, -h / 2);
  f.absarc(b / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
  f.lineTo(b / 2, h / 2 - r);
  f.absarc(b / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
  f.lineTo(-b / 2 + r, h / 2);
  f.absarc(-b / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
  f.lineTo(-b / 2, -h / 2 + r);
  f.absarc(-b / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);
  return f;
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

  /* ---- 2. Die Spirale: wenige, grosse Milchglastafeln auf einer Helix ---- */
  // x = r·cos(w), y = steigung·w, z = r·sin(w). Weit auseinander, damit man
  // an jeder einzeln vorbeikommt statt durch einen Schwarm zu fliegen.
  const RADIUS = 14.0;
  const STEIGUNG = 5.4;
  const SCHRITT = 0.95;
  const ANZAHL = TAFELN.length;
  const hochkant = innerWidth / innerHeight < 0.85;
  const spirale = new THREE.Group();
  const tafeln = [];

  for (let i = 0; i < ANZAHL; i++) {
    const e = TAFELN[i];
    const w = i * SCHRITT;
    // Auf einem Hochkantschirm wird jede Tafel hochkant: ein Querformat
    // passt in einen so schmalen Rahmen nicht, ohne angeschnitten zu werden.
    const quer = e.quer && !hochkant;
    const bb = quer ? 8.6 : 5.6;
    const hh = quer ? 5.1 : 7.6;

    const form = rundesRechteck(bb, hh, Math.min(bb, hh) * 0.075);
    // Echtes Milchglas: man sieht die Szene hindurch, verschwommen und
    // gedaempft. transmission + roughness macht genau das.
    const glas = new THREE.Mesh(new THREE.ShapeGeometry(form, 24), new THREE.MeshPhysicalMaterial({
      color: 0x7d8a90, metalness: 0, roughness: 0.46, transmission: 0.9,
      thickness: 0.7, ior: 1.3, transparent: true, opacity: 1,
      side: THREE.DoubleSide, envMapIntensity: 1.1,
    }));

    // Die helle Kante: dieselbe Form als Linie, leicht nach vorn gesetzt.
    const kante = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(form.getPoints(90)),
      new THREE.LineBasicMaterial({ color: 0xeafcff, transparent: true, opacity: 1 }));
    kante.position.z = 0.012;

    const schrift = new THREE.Mesh(new THREE.PlaneGeometry(bb * 0.92, hh * 0.92),
      new THREE.MeshBasicMaterial({ map: schriftTextur(e, quer), transparent: true, toneMapped: false, depthWrite: false }));
    schrift.position.z = 0.02;

    const tafel = new THREE.Group();
    tafel.add(glas, kante, schrift);
    tafel.position.set(Math.cos(w) * RADIUS, STEIGUNG * w, Math.sin(w) * RADIUS);
    // Nicht lookAt: die Tafel haengt in einer verschobenen Gruppe, ein
    // Weltziel laesst sie fast senkrecht nach oben schauen und der
    // Up-Vektor kippt sie auf den Kopf. Die Drehung um Y ist exakt.
    tafel.rotation.y = -w - Math.PI / 2;
    tafel.userData = { ziel: e.ziel, kante, glas, schrift, nr: i, leuchten: 0 };
    spirale.add(tafel);
    tafeln.push(tafel);
  }
  const spiraleY = (i) => STEIGUNG * i * SCHRITT;
  const SP_HOCH = STEIGUNG * (ANZAHL - 1) * SCHRITT;
  // Die Spirale liegt vollstaendig UNTER der Skulptur, sonst steht die Kamera
  // schon in der Eroeffnung mittendrin.
  // Hochkant ist das Sichtfeld deutlich weiter (bis 72 statt 50 Grad),
  // dadurch ragt die oberste Tafel sonst in die Eroeffnung hinein.
  spirale.position.y = -SP_HOCH - (hochkant ? 40 : 26);
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
  const pink = new THREE.PointLight(0xff2d95, 2.2, 40); scene.add(pink);
  const gruen = new THREE.PointLight(0x38ff9c, 1.8, 38); scene.add(gruen);

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

  /* ---- Anhalten und Anklicken ---- */
  const strahl = new THREE.Raycaster();
  const zeigerNdc = new THREE.Vector2(-2, -2);
  let unterZeiger = null;
  // Die Tafel, vor der die Kamera gerade zum Stehen kommt. Sie leuchtet
  // auch ohne Zeiger, damit sichtbar ist: hier kann man anhalten.
  let angepeilt = null;
  const zeigerEl = document.getElementById("zeiger");

  function pruefeZeiger() {
    if (zeigerNdc.x < -1.5) return;
    strahl.setFromCamera(zeigerNdc, camera);
    const treffer = strahl.intersectObjects(tafeln, true);
    // Nur Tafeln mit Ziel sind anklickbar; die uebrigen leuchten nicht auf.
    let gefunden = null;
    for (const tr of treffer) {
      let o = tr.object;
      while (o && !o.userData?.kante) o = o.parent;
      if (o) { gefunden = o; break; }
    }
    if (gefunden !== unterZeiger) {
      unterZeiger = gefunden;
      const klickbar = Boolean(gefunden?.userData.ziel);
      zeigerEl?.classList.toggle("weit", klickbar);
      canvas.style.cursor = klickbar ? "pointer" : "";
    }
  }

  addEventListener("pointermove", (ev) => {
    zeigerNdc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  }, { passive: true });
  canvas.addEventListener("click", () => {
    const ziel = unterZeiger?.userData.ziel;
    if (ziel) location.href = ziel;
  });

  function groesse() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.resolution.set(w, h);
    camera.aspect = w / h;
    // Bei festem senkrechtem Blickwinkel schneidet ein hochkantes Handy die
    // Tafeln seitlich ab -- das waagerechte Sichtfeld ist dort viel enger.
    // Also das waagerechte festhalten und das senkrechte daraus ableiten,
    // gedeckelt, sonst wird daraus ein Fischauge.
    const REF_ASPECT = 16 / 9, REF_FOV = 50, MAX_FOV = 72;
    if (camera.aspect < REF_ASPECT) {
      const halbWaage = Math.atan(Math.tan((REF_FOV * Math.PI) / 360) * REF_ASPECT);
      const fov = (2 * Math.atan(Math.tan(halbWaage) / camera.aspect) * 180) / Math.PI;
      camera.fov = Math.min(MAX_FOV, fov);
    } else {
      camera.fov = REF_FOV;
    }
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
    angepeilt = null;
    if (P < 0.30) {
      // Heranfahren an die Skulptur, dann hinab zum Fuss der Spirale.
      const naeher = mix(16, 5.6, glatt(a));
      const ab = glatt(b);
      // Der Abstieg laeuft aussen an der Helix entlang statt mitten
      // hindurch: die Spirale steht dann rechts, die Textspalte links
      // bleibt frei.
      x = mix(Math.sin(t * 0.1) * 0.5, 23, ab) + maus.x * 0.9;
      y = mix(1.2, 0.2, glatt(a)) * (1 - ab) + mix(0, spirale.position.y + 2, ab) + maus.y * 0.6;
      z = mix(naeher, 12, ab);
      zielX = mix(0, 9, ab);
      zielZ = mix(0, 4, ab);
      zielY = mix(0, spirale.position.y + 5, ab);
    } else if (P < 0.66) {
      // Mitten durch die Helix: die Kamera folgt derselben Schraube,
      // aber auf kleinerem Radius, damit die Tafeln aussen vorbeiziehen.
      const ras = rasten(c * (ANZAHL - 1));
      const w = ras.pos * SCHRITT;
      const r = 1.6;
      // Die Helix selbst dreht sich langsam weiter. Die Kamerabahn muss in
      // derselben Drehung liegen, sonst laufen Tafeln und Kamera auseinander
      // und die angepeilte Tafel wandert aus dem Bild.
      const dreh = -spirale.rotation.y;
      x = Math.cos(w + dreh) * r + maus.x * 0.7;
      z = Math.sin(w + dreh) * r + maus.y * 0.4;
      y = spirale.position.y + STEIGUNG * w + 0.4;
      // Der Blick geht immer radial nach aussen auf die Helix -- dort
      // haengen die Tafeln. Zwischen zwei Tafeln schwenkt er mit, an einer
      // Station liegt er exakt auf ihrer Mitte. Nie ins Leere.
      const ni = Math.min(ANZAHL - 1, Math.max(0, ras.tafel));
      const nah = tafeln[ni];
      const k = glatt(ras.naehe);
      const nw = mix(w, ni * SCHRITT, k) + dreh;
      zielX = Math.cos(nw) * RADIUS;
      zielZ = Math.sin(nw) * RADIUS;
      zielY = mix(spirale.position.y + STEIGUNG * w,
                  spirale.position.y + nah.position.y, k);
      angepeilt = k > 0.55 ? nah : null;
    } else {
      // Heraus aus der Spirale, offener Raum fuer die Projekttafeln,
      // danach zurueck in die Dunkelheit zur Skulptur.
      const raus = glatt(d);
      const heim = glatt(e);
      x = mix(mix(2.2, 8, raus), 0, heim) + maus.x * 0.8;
      // Deutlich ueber die oberste Tafel steigen: sonst haengt sie mitten
      // in den Textspalten dieses Abschnitts.
      y = mix(spirale.position.y + SP_HOCH + 10, spirale.position.y + SP_HOCH + 23, raus) * (1 - heim)
          + maus.y * 0.5;
      z = mix(mix(5, 20, raus), 14, heim);
      // Leicht nach oben blicken: so sinkt die Helix unter den Bildrand
      // und keine Tafel liegt in den Textspalten dieses Abschnitts.
      zielY = y + mix(2, 4, raus) * (1 - heim);
    }
    camera.position.set(x, y, z);
    blick.set(mix(zielX, skulptur.position.x, glatt(e)), zielY, zielZ);
    camera.lookAt(blick);
    camera.rotation.z += Math.sin(t * 0.21) * 0.012;

    // Akzentlichter wandern mit, sonst bleiben sie am Anfang zurueck.
    pink.position.set(Math.cos(t * 0.4) * 3.2, camera.position.y + 2.5, Math.sin(t * 0.4) * 3.2);
    gruen.position.set(Math.cos(t * 0.4 + 2.4) * 3.6, camera.position.y - 3, Math.sin(t * 0.4 + 2.4) * 3.6);
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
    pruefeZeiger();
    // Die Tafel unter dem Zeiger haelt an: ihr Schweben friert ein, die Kante
    // leuchtet auf. Die uebrigen atmen weiter.
    for (const tafel of tafeln) {
      const d = tafel.userData;
      const anvisiert = tafel === unterZeiger || tafel === angepeilt;
      d.leuchten += ((anvisiert ? 1 : 0) - d.leuchten) * (1 - Math.pow(0.004, dt));
      d.kante.material.opacity = 0.7 + d.leuchten * 0.3;
      d.kante.material.color.setHex(d.ziel && anvisiert ? 0x38ff9c : 0xdffbff);
      d.glas.material.roughness = 0.46 - d.leuchten * 0.16;
      if (!anvisiert) {
        // Sanftes Schweben, je Tafel leicht versetzt.
        tafel.position.y = spiraleY(d.nr) + Math.sin(t * 0.5 + d.nr * 1.7) * 0.22;
        tafel.rotation.z = Math.sin(t * 0.33 + d.nr) * 0.012;
      }
    }
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
