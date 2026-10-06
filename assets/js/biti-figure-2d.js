// 2D-Illustration der Biti-Figur. mount(container) baut das SVG-Markup in
// `container` und gibt { applyCharacter(character) } zurueck - ein Aufruf
// reicht, um Farben/Frisur/Accessoire/Mund/Koerperform auf einmal zu setzen;
// bei pose:"laufen" startet intern eine eigene rAF-Schleife fuer die
// Gehbewegung, sonst laeuft nichts periodisch. 1:1 aus dem Biti-Charakter-
// Creator uebernommen, nur auf `container.querySelector` statt
// `document.getElementById` umgestellt, damit mehrere Instanzen (Creator +
// Profilkarte, auf verschiedenen Seiten) sich nicht in die Quere kommen.
(function () {
  if (window.BitiFigure2d) return;
  var D = window.BitiFigureData;

  var SVG_MARKUP =
    '<svg viewBox="0 0 680 670" role="img">' +
    '<title>Biti-Vorschau, 2D</title>' +
    '<ellipse cx="340" cy="595" rx="150" ry="20" fill="#000000" opacity="0.32"/>' +
    '<rect id="acc2d-umhang" x="250" y="300" width="180" height="240" fill="var(--accent)"/>' +
    '<rect id="leg2d-left" x="266" y="455" width="70" height="130" fill="#363a5c"/>' +
    '<rect id="leg2d-right" x="344" y="455" width="70" height="130" fill="#363a5c"/>' +
    '<g id="skirt2d">' +
    '<rect id="skirt2d-upper" x="250" y="450" width="180" height="20" fill="var(--top)"/>' +
    '<rect id="skirt2d-mid" x="215" y="468" width="250" height="26" fill="var(--top)"/>' +
    '<rect id="skirt2d-lower" x="175" y="492" width="330" height="70" fill="var(--top)"/>' +
    '</g>' +
    '<rect id="torso2d" x="255" y="283" width="170" height="180" fill="var(--top)"/>' +
    '<g id="arm2d-left"><rect x="199" y="295" width="56" height="145" fill="var(--top)"/><rect x="199" y="440" width="56" height="30" fill="var(--skin)"/></g>' +
    '<g id="arm2d-right"><rect x="425" y="295" width="56" height="145" fill="var(--top)"/><rect x="425" y="440" width="56" height="30" fill="var(--skin)"/></g>' +
    '<g id="acc2d-schultern"><rect x="185" y="283" width="46" height="46" fill="var(--accent)"/><rect x="449" y="283" width="46" height="46" fill="var(--accent)"/></g>' +
    '<g id="headAssembly2d">' +
    '<rect x="310" y="258" width="60" height="25" fill="var(--skin)"/>' +
    '<rect x="265" y="108" width="150" height="150" fill="var(--skin)"/>' +
    '<rect id="hair2d-rund" x="250" y="75" width="180" height="90" fill="var(--hair)"/>' +
    '<rect id="hair2d-kurz" x="260" y="95" width="160" height="35" fill="var(--hair)"/>' +
    '<g id="hair2d-flamme"><rect x="260" y="95" width="160" height="35" fill="var(--hair)"/>' +
    '<rect x="285" y="48" width="22" height="56" fill="var(--hair)" transform="rotate(-10 296 76)"/>' +
    '<rect x="329" y="40" width="22" height="62" fill="var(--hair)"/>' +
    '<rect x="368" y="50" width="22" height="52" fill="var(--hair)" transform="rotate(12 379 76)"/></g>' +
    '<g id="hair2d-seitlich"><rect x="255" y="85" width="175" height="70" fill="var(--hair)" transform="rotate(3 342 120)"/>' +
    '<rect x="213" y="88" width="46" height="132" fill="var(--hair)" transform="rotate(-16 236 154)"/></g>' +
    '<g id="hair2d-offen"><rect x="260" y="95" width="160" height="35" fill="var(--hair)"/>' +
    '<rect x="222" y="112" width="43" height="140" fill="var(--hair)"/>' +
    '<rect x="415" y="112" width="43" height="140" fill="var(--hair)"/></g>' +
    '<g id="hair2d-zopf"><rect x="262" y="98" width="156" height="34" fill="var(--hair)"/>' +
    '<rect x="406" y="112" width="42" height="150" fill="var(--hair)" transform="rotate(8 427 112)"/></g>' +
    '<g id="hair2d-dutt"><rect x="262" y="98" width="156" height="34" fill="var(--hair)"/>' +
    '<circle cx="340" cy="85" r="30" fill="var(--hair)"/></g>' +
    '<rect x="300" y="165" width="18" height="22" fill="var(--eye)"/>' +
    '<rect x="362" y="165" width="18" height="22" fill="var(--eye)"/>' +
    '<g id="mouth2d">' +
    '<rect id="mouth2d-l" x="313" y="222" width="16" height="8" fill="#3a2418"/>' +
    '<rect id="mouth2d-c" x="332" y="222" width="16" height="8" fill="#3a2418"/>' +
    '<rect id="mouth2d-r" x="351" y="222" width="16" height="8" fill="#3a2418"/>' +
    '</g>' +
    '</g>' +
    '<g id="acc2d-schal"><rect x="288" y="248" width="104" height="30" fill="var(--accent)"/><rect x="350" y="270" width="30" height="145" fill="var(--accent)"/></g>' +
    '</svg>';

  var MOUTH_Y0 = 222;
  var LEG_Y0 = 455, LEG_H0 = 130, LEG_BOTTOM_2D = 585;
  var TORSO_Y0 = 283, TORSO_H0 = 180, LEG_TORSO_OVERLAP_2D = 8;
  var ARM_Y0 = 295;
  var WALK_SPEED_2D = 6;
  var LEG_SWING_DEG_2D = 9;
  var ARM_SWING_DEG_2D = 15;

  function mount(container) {
    container.innerHTML = SVG_MARKUP;
    var svg = container.querySelector("svg");
    function $(id) { return svg.querySelector("#" + id); }

    function apply2dColors(character) {
      svg.style.setProperty("--skin", character.skin);
      svg.style.setProperty("--top", character.top);
      svg.style.setProperty("--hair", character.hair);
      svg.style.setProperty("--accent", character.accent);
      svg.style.setProperty("--eye", character.eye);
    }
    function apply2dHairStyle(character) {
      ["flamme", "rund", "seitlich", "kurz", "offen", "zopf", "dutt"].forEach(function (id) {
        $("hair2d-" + id).style.display = id === character.hairStyle ? "" : "none";
      });
    }
    function apply2dAccessory(character) {
      $("acc2d-umhang").style.display = character.accessory === "umhang" ? "" : "none";
      $("acc2d-schal").style.display = character.accessory === "schal" ? "" : "none";
      $("acc2d-schultern").style.display = character.accessory === "schultern" ? "" : "none";
    }
    function apply2dMouth(character) {
      var l = $("mouth2d-l"), c = $("mouth2d-c"), r = $("mouth2d-r");
      var outerDelta = character.mouth === "hoch" ? -5 : character.mouth === "runter" ? 5 : 0;
      var centerDelta = character.mouth === "hoch" ? 3 : character.mouth === "runter" ? -3 : 0;
      l.setAttribute("y", MOUTH_Y0 + outerDelta);
      r.setAttribute("y", MOUTH_Y0 + outerDelta);
      c.setAttribute("y", MOUTH_Y0 + centerDelta);
    }
    function apply2dLayout(character) {
      var h = character.size;
      var deg = D.POSE_ANGLES_DEG[character.pose] || 0;

      var legH = LEG_H0 * h;
      var legY = LEG_BOTTOM_2D - legH;
      $("leg2d-left").setAttribute("y", legY);
      $("leg2d-left").setAttribute("height", legH);
      $("leg2d-right").setAttribute("y", legY);
      $("leg2d-right").setAttribute("height", legH);

      var torsoH = TORSO_H0 * (1 + (h - 1) * 0.5);
      var torsoY = legY + LEG_TORSO_OVERLAP_2D - torsoH;
      $("torso2d").setAttribute("y", torsoY);
      $("torso2d").setAttribute("height", torsoH);

      if (character.bodyType === "maedchen") {
        var skirtTopY = torsoY + torsoH - 12;
        $("skirt2d-upper").setAttribute("y", skirtTopY);
        var midY = skirtTopY + 18;
        $("skirt2d-mid").setAttribute("y", midY);
        var lowerY = midY + 24;
        var lowerBottomTarget = legY + legH * 0.72;
        var lowerH = Math.max(55, lowerBottomTarget - lowerY);
        var lower = $("skirt2d-lower");
        lower.setAttribute("y", lowerY);
        lower.setAttribute("height", lowerH);
        $("skirt2d").style.display = "";
      } else {
        $("skirt2d").style.display = "none";
      }

      var armDeltaY = torsoY + 12 - ARM_Y0;
      $("arm2d-left").setAttribute("transform", "translate(0 " + armDeltaY + ") rotate(" + deg + " 227 " + ARM_Y0 + ")");
      $("arm2d-right").setAttribute("transform", "translate(0 " + armDeltaY + ") rotate(" + -deg + " 453 " + ARM_Y0 + ")");

      var headDeltaY = torsoY - TORSO_Y0;
      $("headAssembly2d").setAttribute("transform", "translate(0 " + headDeltaY + ")");
      $("acc2d-schal").setAttribute("transform", "translate(0 " + headDeltaY + ")");

      $("leg2d-left").removeAttribute("transform");
      $("leg2d-right").removeAttribute("transform");
    }
    // Pro Frame aufgerufen (siehe walkLoop unten), nicht wie apply2dLayout nur
    // bei Aenderungen - legY/torsoY/armDeltaY werden hier bewusst noch einmal
    // aus character.size berechnet statt sie zu teilen, weil diese Funktion
    // mit 60fps laeuft und apply2dLayout() nicht staendig mitlaufen soll.
    function apply2dWalkFrame(t, character) {
      var swing = Math.sin(t * WALK_SPEED_2D);
      var legDeg = swing * LEG_SWING_DEG_2D;
      var armDeg = -swing * ARM_SWING_DEG_2D;

      var h = character.size;
      var legH = LEG_H0 * h;
      var legY = LEG_BOTTOM_2D - legH;
      var legLCx = 266 + 70 / 2, legRCx = 344 + 70 / 2;
      $("leg2d-left").setAttribute("transform", "rotate(" + legDeg + " " + legLCx + " " + legY + ")");
      $("leg2d-right").setAttribute("transform", "rotate(" + -legDeg + " " + legRCx + " " + legY + ")");

      var torsoH = TORSO_H0 * (1 + (h - 1) * 0.5);
      var torsoY = legY + LEG_TORSO_OVERLAP_2D - torsoH;
      var armDeltaY = torsoY + 12 - ARM_Y0;
      $("arm2d-left").setAttribute("transform", "translate(0 " + armDeltaY + ") rotate(" + armDeg + " 227 " + ARM_Y0 + ")");
      $("arm2d-right").setAttribute("transform", "translate(0 " + armDeltaY + ") rotate(" + -armDeg + " 453 " + ARM_Y0 + ")");
    }

    var rafId = null, walkStart = null;
    function stopWalkLoop() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      walkStart = null;
    }
    function walkLoop(character) {
      return function frame() {
        var t = (performance.now() - walkStart) / 1000;
        apply2dWalkFrame(t, character);
        rafId = requestAnimationFrame(frame);
      };
    }

    function applyCharacter(character) {
      apply2dColors(character);
      apply2dHairStyle(character);
      apply2dAccessory(character);
      apply2dMouth(character);
      apply2dLayout(character);
      stopWalkLoop();
      if (character.pose === "laufen") {
        walkStart = performance.now();
        rafId = requestAnimationFrame(walkLoop(character));
      }
    }

    return { applyCharacter: applyCharacter };
  }

  window.BitiFigure2d = { mount: mount };
})();
