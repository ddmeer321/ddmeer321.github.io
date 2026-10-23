/* 3D-Hero und Scrollanimationen der DeepScheitern-Landingpage.
   Alles optional: faellt WebGL, GSAP oder three.js aus, bleibt die Seite
   vollstaendig lesbar -- die Inhalte stehen im HTML, nicht im Skript. */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;

  /* ---------- Sichtbarkeit: ohne Animation sofort alles zeigen ---------- */
  function revealAll() { root.classList.add("no-anim"); }

  /* ---------- Scrollanimationen ---------- */
  var stageProgress = 0;          // 0..1 ueber die gesamte gepinnte Buehne
  var stages = [];

  function showStage(i) {
    for (var k = 0; k < stages.length; k++) stages[k].classList.toggle("is-on", k === i);
  }

  function initScroll() {
    if (reduce || !window.gsap || !window.ScrollTrigger) { revealAll(); return; }
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add("anim-ready");

    // Die Buehne bleibt stehen, das Scrollen treibt die Animation darin an.
    stages = Array.prototype.slice.call(document.querySelectorAll(".d-stage"));
    var hero = document.getElementById("buehne");
    if (hero && stages.length) {
      root.classList.add("stage-mode");
      showStage(0);
      ScrollTrigger.create({
        trigger: hero,
        start: "top top",
        end: "+=" + (stages.length * 110) + "%",
        pin: true,
        pinSpacing: true,
        scrub: 0.6,
        onUpdate: function (self) {
          stageProgress = self.progress;
          var i = Math.min(stages.length - 1, Math.floor(self.progress * stages.length));
          showStage(i);
        },
      });
    }
    gsap.utils.toArray(".reveal").forEach(function (el, i) {
      gsap.fromTo(el, { opacity: 0, y: 26 }, {
        opacity: 1, y: 0, duration: .7, ease: "power2.out", delay: (i % 3) * .07,
        scrollTrigger: { trigger: el, start: "top 86%", once: true },
      });
    });
  }

  /* ---------- Karten: Lichtreflex und leichte 3D-Neigung ---------- */
  function initCards() {
    if (reduce || window.matchMedia("(hover: none)").matches) return;
    document.querySelectorAll(".d-card").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--mx", px * 100 + "%");
        card.style.setProperty("--my", py * 100 + "%");
        card.style.transform = "perspective(900px) rotateX(" + (py - .5) * -5 +
          "deg) rotateY(" + (px - .5) * 6 + "deg) translateY(-3px)";
      });
      card.addEventListener("pointerleave", function () { card.style.transform = ""; });
    });
  }

  /* ---------- 3D-Hero ---------- */
  var scatter = 0;             // vom Easter Egg hochgesetzt
  function initHero() {
    var canvas = document.getElementById("d-canvas");
    if (!canvas || !window.THREE || reduce) return null;

    var gl;
    try { gl = canvas.getContext("webgl2") || canvas.getContext("webgl"); } catch (e) { gl = null; }
    if (!gl) return null;   // Kein WebGL: Hero bleibt Text auf Schwarz, das ist in Ordnung.

    // Schwaechere Geraete bekommen weniger Ringe und weniger Pixel.
    var weak = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    var narrow = window.innerWidth < 760;
    var COUNT = narrow ? 34 : weak ? 46 : 64;
    var maxDpr = narrow || weak ? 1.5 : 2;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !weak, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.outputEncoding = THREE.sRGBEncoding;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 1.1, 13);

    // Eine Geometrie, ein Material, vielfach instanziiert: das ist der Grund,
    // warum 64 Ringe nicht 64-mal Arbeit bedeuten.
    var ring = new THREE.TorusGeometry(1, 0.055, 10, 72);
    var mat = new THREE.MeshStandardMaterial({ color: 0x15131f, metalness: 1, roughness: 0.22 });
    var mesh = new THREE.InstancedMesh(ring, mat, COUNT);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);

    // Neonlichter: sie erzeugen die Reflexe auf den Ringkanten.
    scene.add(new THREE.AmbientLight(0x404058, 0.5));
    var l1 = new THREE.PointLight(0x22e4d4, 42, 20); l1.position.set(-7, 3, 6);
    var l2 = new THREE.PointLight(0xff2d95, 42, 20); l2.position.set(7, -2, 5);
    var l3 = new THREE.PointLight(0x8b5cf6, 32, 26); l3.position.set(0, 5, -4);
    scene.add(l1, l2, l3);

    // Dunkler Boden, der die Neonfarben dezent zurueckwirft.
    // Rau statt spiegelnd: ein glatter Metallboden blueht unter den Punktlichtern
    // sofort weiss aus und frisst die untere Bildhaelfte.
    var floorMat = new THREE.MeshStandardMaterial({ color: 0x040408, metalness: .3, roughness: .92 });
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 40), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -7.4;
    scene.add(floor);

    var dummy = new THREE.Object3D();
    var mouse = { x: 0, y: 0 }, aim = { x: 0, y: 0 };
    var scroll = 0, t = 0, running = true, visible = true;

    // Weiche Blende zwischen zwei Formen, damit nichts ruckartig umspringt.
    function ease(t) { return t * t * (3 - 2 * t); }
    function mix(a, b, t) { return a + (b - a) * t; }

    function layout(time) {
      // 0 = Welle quer ueber den Schirm, 1 = Tunnel, durch den die Kamera fliegt.
      var morph = ease(Math.min(1, Math.max(0, (stageProgress - 0.08) / 0.5)));
      for (var i = 0; i < COUNT; i++) {
        var f = i / (COUNT - 1);
        // Wellenform: die Ringe sitzen auf einer Sinuskurve und sind
        // zueinander versetzt verdreht -- daraus entsteht die Spirale.
        var wx = (f - 0.5) * 22;
        var wy = Math.sin(f * Math.PI * 2 + time * 0.35) * 1.5;
        var wz = Math.cos(f * Math.PI * 2.2 + time * 0.28) * 1.6;
        // Tunnelform: dieselben Ringe auf einer Achse, die von der Kamera wegfuehrt.
        var a = f * Math.PI * 6 + time * 0.3;
        var tx = Math.cos(a) * 2.3;
        var ty = Math.sin(a) * 2.3;
        var tz = -f * 54 + 6;
        var x = mix(wx, tx, morph);
        var y = mix(wy, ty, morph);
        var z = mix(wz, tz, morph);
        if (scatter > 0) {
          var n = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
          n = n - Math.floor(n);
          x += (n - .5) * 9 * scatter;
          y += (Math.sin(i * 3.7) ) * 4 * scatter;
          z += (Math.cos(i * 5.1) ) * 4 * scatter;
        }
        dummy.position.set(x, y, z);
        // Im Tunnel stehen die Ringe quer zur Flugrichtung statt laengs.
        dummy.rotation.set(
          mix(f * Math.PI * 1.6 + time * 0.22, 0, morph),
          mix(Math.PI / 2, 0, morph),
          f * Math.PI * 2.4 + time * 0.16);
        var s = mix(0.85 + Math.sin(f * Math.PI) * 0.5, 1.5, morph);
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    function resize() {
      var r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    }

    function frame() {
      if (!running) return;
      requestAnimationFrame(frame);
      if (!visible) return;
      t += 0.0068;
      mouse.x += (aim.x - mouse.x) * 0.045;
      mouse.y += (aim.y - mouse.y) * 0.045;
      if (scatter > 0) scatter = Math.max(0, scatter - 0.012);
      layout(t);
      // Die Buehne bleibt stehen; der Fortschritt fliegt die Kamera in den Tunnel.
      var pm = Math.min(1, Math.max(0, (stageProgress - 0.08) / 0.5));
      var fly = Math.min(1, Math.max(0, (stageProgress - 0.45) / 0.55));
      mesh.rotation.z = stageProgress * 0.8;
      camera.position.x = mouse.x * 1.5 * (1 - pm);
      camera.position.y = (1.1 + mouse.y * 0.9) * (1 - pm * 0.7);
      camera.position.z = 13 - pm * 7 - fly * 26;
      camera.lookAt(0, 0, camera.position.z - 10);
      renderer.render(scene, camera);
    }

    window.addEventListener("pointermove", function (e) {
      aim.x = (e.clientX / window.innerWidth) * 2 - 1;
      aim.y = -((e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });

    window.addEventListener("scroll", function () {
      var h = window.innerHeight || 1;
      scroll = Math.min(1, (window.scrollY || 0) / h);
    }, { passive: true });

    window.addEventListener("resize", resize);
    // Im Hintergrundtab und ausserhalb des Sichtfelds wird nicht gerechnet.
    document.addEventListener("visibilitychange", function () { visible = !document.hidden; });
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        var e = entries[entries.length - 1];
        // Ein noch nicht ausgelegtes Element ist 0x0 gross und meldet
        // faelschlich "nicht sichtbar". Wuerde man das uebernehmen, bliebe
        // die Schleife fuer immer stehen -- der Beobachter feuert danach nie
        // wieder, weil keine Schwelle mehr gekreuzt wird.
        var r = e.boundingClientRect;
        if (!r.width && !r.height) return;
        visible = e.isIntersecting && !document.hidden;
      }, { threshold: 0 }).observe(canvas);
    }

    resize(); layout(0); frame();
    return { scatter: function () { scatter = 1; } };
  }

  /* ---------- Easter Eggs ---------- */
  function toast(text) {
    var el = document.createElement("div");
    el.className = "d-egg"; el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
  }

  function initEggs(hero) {
    // 1. Konami-Code: die Struktur zerfaellt kurz und sammelt sich wieder.
    var code = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    var pos = 0;
    window.addEventListener("keydown", function (e) {
      pos = (e.key === code[pos] || e.key.toLowerCase() === code[pos]) ? pos + 1 : 0;
      if (pos === code.length) {
        pos = 0;
        if (hero) hero.scatter();
        toast("Alles auseinandergefallen. Wie geplant.");
      }
    });

    // 2. Logo mehrfach anklicken: der Fehlversuchszaehler.
    var clicks = 0, timer = null;
    var logo = document.getElementById("d-logo");
    if (logo) logo.addEventListener("click", function (e) {
      e.preventDefault();
      clicks++;
      clearTimeout(timer);
      timer = setTimeout(function () { clicks = 0; }, 1600);
      if (clicks === 5) {
        clicks = 0;
        var n = 1;
        try { n = (parseInt(localStorage.getItem("ds-fails") || "0", 10) || 0) + 1;
              localStorage.setItem("ds-fails", String(n)); } catch (err) { /* egal */ }
        toast("Fehlversuch Nr. " + n + " erfolgreich gescheitert.");
      }
    });

    // 3. Gruss in der Konsole, fuer die, die nachsehen.
    try {
      console.log("%cDeepScheitern", "font-size:28px;font-weight:800;background:linear-gradient(90deg,#ff2d95,#22e4d4);-webkit-background-clip:text;color:transparent");
      console.log("Du schaust in die Konsole. Gute Wahl. Probier mal den Konami-Code.");
    } catch (e) { /* egal */ }
  }

  function start() {
    var hero = null;
    try { hero = initHero(); } catch (e) { console.warn("3D-Hero nicht gestartet:", e && e.message); }
    try { initScroll(); } catch (e) { revealAll(); }
    try { initCards(); } catch (e) { /* Deko, darf ausfallen */ }
    try { initEggs(hero); } catch (e) { /* Deko, darf ausfallen */ }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
