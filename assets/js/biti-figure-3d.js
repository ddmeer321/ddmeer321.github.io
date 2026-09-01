// 3D-Modell der Biti-Figur (Three.js, Block-Stil). mount(container, opts)
// baut Szene/Kamera/Renderer in `container` auf und gibt
// { applyCharacter(character), setAutoRotate(bool) } zurueck. Ziehen zum
// Drehen ist immer aktiv; Auto-Drehen nur, wenn opts.autoRotate nicht
// ausdruecklich false ist. 1:1 aus dem Biti-Charakter-Creator uebernommen,
// nur auf eine mount()-Fabrik umgestellt (kein globaler #stage3d-Zugriff
// mehr), damit Creator und Profilkarte je eine eigene, unabhaengige Szene
// bekommen koennen.
(function () {
  if (window.BitiFigure3d) return;
  var D = window.BitiFigureData;

  function mount(container, opts) {
    opts = opts || {};

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 1.95, 7.2);
    camera.lookAt(0, 1.7, 0);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    var key = new THREE.DirectionalLight(0xffffff, 0.95);
    key.position.set(-2.5, 3.5, 3);
    scene.add(key);
    var fillLight = new THREE.DirectionalLight(0xffffff, 0.32);
    fillLight.position.set(2.5, 1, -2);
    scene.add(fillLight);

    var skinMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    var topMat = new THREE.MeshStandardMaterial({ roughness: 0.7 });
    var limbMat = new THREE.MeshStandardMaterial({ color: 0x363a5c, roughness: 0.7 });
    var hairMat = new THREE.MeshStandardMaterial({ roughness: 0.65 });
    var accentMat = new THREE.MeshStandardMaterial({ roughness: 0.65 });
    var eyeMat = new THREE.MeshStandardMaterial({ roughness: 0.3 });
    var mouthMat = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.7 });
    var platformMat = new THREE.MeshStandardMaterial({ color: 0x14162e, roughness: 0.85 });

    var group = new THREE.Group();

    // Beine haengen an einem Huefte-Pivot statt direkt im Mesh zu sitzen -
    // noetig fuer die Lauf-Animation (eine Rotation der Box selbst wuerde um
    // ihre eigene, lokal zentrierte Mitte kippen, sichtbar am Knie statt an
    // der Huefte).
    var legPivotL = new THREE.Group();
    var legPivotR = new THREE.Group();
    var legL = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), limbMat);
    var legR = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), limbMat);
    legPivotL.add(legL);
    legPivotR.add(legR);
    group.add(legPivotL, legPivotR);

    var torso = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), topMat);
    group.add(torso);

    // Rock fuer "Maedchen": drei Boxen (Bund/Mitte/Saum, jede breiter als die
    // davor) fuer eine deutliche Glockenform, in der Oberteil-Farbe.
    var skirtUpper = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), topMat);
    var skirtMid = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), topMat);
    var skirtLower = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), topMat);
    skirtUpper.visible = false;
    skirtMid.visible = false;
    skirtLower.visible = false;
    group.add(skirtUpper, skirtMid, skirtLower);

    var armPivotL = new THREE.Group();
    var armPivotR = new THREE.Group();
    [armPivotL, armPivotR].forEach(function (pivot) {
      var sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.65, 0.26), topMat);
      sleeve.position.set(0, -0.325, 0);
      var hand = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.26), skinMat);
      hand.position.set(0, -0.75, 0);
      pivot.add(sleeve, hand);
    });
    group.add(armPivotL, armPivotR);

    var headGroup = new THREE.Group();
    group.add(headGroup);

    var neck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.3), skinMat);
    neck.position.set(0, 1.895, 0);
    headGroup.add(neck);

    var HEAD_SIZE = 0.78;
    var head = new THREE.Mesh(new THREE.BoxGeometry(HEAD_SIZE, HEAD_SIZE, HEAD_SIZE), skinMat);
    head.position.set(0, 2.35, 0);
    headGroup.add(head);

    var eyeGeo = new THREE.BoxGeometry(0.09, 0.11, 0.05);
    var eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.16, 2.41, 0.4);
    var eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.16, 2.41, 0.4);
    headGroup.add(eyeL, eyeR);

    var MOUTH_LOCAL_Y = 2.21;
    var mouthSegGeo = new THREE.BoxGeometry(0.06, 0.05, 0.05);
    var mouthL = new THREE.Mesh(mouthSegGeo, mouthMat); mouthL.position.set(-0.055, MOUTH_LOCAL_Y, 0.4);
    var mouthC = new THREE.Mesh(mouthSegGeo, mouthMat); mouthC.position.set(0, MOUTH_LOCAL_Y, 0.4);
    var mouthR = new THREE.Mesh(mouthSegGeo, mouthMat); mouthR.position.set(0.055, MOUTH_LOCAL_Y, 0.4);
    headGroup.add(mouthL, mouthC, mouthR);

    function applyMouth3d(shape) {
      var outerDelta = shape === "hoch" ? 0.035 : shape === "runter" ? -0.035 : 0;
      var centerDelta = shape === "hoch" ? -0.02 : shape === "runter" ? 0.02 : 0;
      mouthL.position.y = MOUTH_LOCAL_Y + outerDelta;
      mouthR.position.y = MOUTH_LOCAL_Y + outerDelta;
      mouthC.position.y = MOUTH_LOCAL_Y + centerDelta;
    }

    var hairAnchor = new THREE.Group();
    hairAnchor.position.set(0, 2.35 + HEAD_SIZE / 2, 0);
    headGroup.add(hairAnchor);

    // -- Junge-Frisuren --
    var hairFlamme = new THREE.Group();
    var flammeBase = new THREE.Mesh(new THREE.BoxGeometry(HEAD_SIZE + 0.06, 0.22, HEAD_SIZE + 0.06), hairMat);
    flammeBase.position.set(0, 0.08, 0);
    hairFlamme.add(flammeBase);
    var spikeGeo = new THREE.BoxGeometry(0.14, 0.42, 0.14);
    [
      [-0.2, 0.34, -0.12, 0.32],
      [0.04, 0.4, 0.06, -0.08],
      [0.24, 0.3, -0.08, -0.4],
    ].forEach(function (p) {
      var spike = new THREE.Mesh(spikeGeo, hairMat);
      spike.position.set(p[0], p[1], p[2]);
      spike.rotation.z = p[3];
      hairFlamme.add(spike);
    });
    hairAnchor.add(hairFlamme);

    var hairRund = new THREE.Mesh(new THREE.BoxGeometry(HEAD_SIZE + 0.2, 0.58, HEAD_SIZE + 0.2), hairMat);
    hairRund.position.set(0, -0.12, 0);
    hairAnchor.add(hairRund);

    var hairKurz = new THREE.Mesh(new THREE.BoxGeometry(HEAD_SIZE + 0.06, 0.24, HEAD_SIZE + 0.06), hairMat);
    hairKurz.position.set(0, 0.1, 0);
    hairAnchor.add(hairKurz);

    var hairSeitlich = new THREE.Group();
    var seitlichCap = new THREE.Mesh(new THREE.BoxGeometry(HEAD_SIZE + 0.1, 0.42, HEAD_SIZE + 0.1), hairMat);
    seitlichCap.position.set(0.04, -0.02, 0);
    seitlichCap.rotation.z = 0.08;
    hairSeitlich.add(seitlichCap);
    var seitlichSwoop = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.2), hairMat);
    seitlichSwoop.position.set(-0.36, 0.06, 0.04);
    seitlichSwoop.rotation.z = 0.65;
    hairSeitlich.add(seitlichSwoop);
    hairAnchor.add(hairSeitlich);

    // -- Maedchen-Frisuren --
    var hairOffen = new THREE.Group();
    var offenCap = new THREE.Mesh(new THREE.BoxGeometry(HEAD_SIZE + 0.08, 0.26, HEAD_SIZE + 0.08), hairMat);
    offenCap.position.set(0, 0.08, 0);
    hairOffen.add(offenCap);
    var offenSideGeo = new THREE.BoxGeometry(0.18, 0.75, 0.18);
    var offenSideL = new THREE.Mesh(offenSideGeo, hairMat);
    offenSideL.position.set(-0.46, -0.38, 0.08);
    hairOffen.add(offenSideL);
    var offenSideR = new THREE.Mesh(offenSideGeo, hairMat);
    offenSideR.position.set(0.46, -0.38, 0.08);
    hairOffen.add(offenSideR);
    hairAnchor.add(hairOffen);

    var hairZopf = new THREE.Group();
    var zopfCap = new THREE.Mesh(new THREE.BoxGeometry(HEAD_SIZE + 0.06, 0.24, HEAD_SIZE + 0.06), hairMat);
    zopfCap.position.set(0, 0.1, 0);
    hairZopf.add(zopfCap);
    var ponytail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.58, 0.2), hairMat);
    ponytail.position.set(0.34, -0.16, -0.12);
    ponytail.rotation.z = 0.18;
    hairZopf.add(ponytail);
    hairAnchor.add(hairZopf);

    var hairDutt = new THREE.Group();
    var duttCap = new THREE.Mesh(new THREE.BoxGeometry(HEAD_SIZE + 0.06, 0.24, HEAD_SIZE + 0.06), hairMat);
    duttCap.position.set(0, 0.1, 0);
    hairDutt.add(duttCap);
    var bun = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), hairMat);
    bun.position.set(0, 0.24, -0.34);
    hairDutt.add(bun);
    hairAnchor.add(hairDutt);

    function applyHairStyle3d(style) {
      hairFlamme.visible = style === "flamme";
      hairRund.visible = style === "rund";
      hairSeitlich.visible = style === "seitlich";
      hairKurz.visible = style === "kurz";
      hairOffen.visible = style === "offen";
      hairZopf.visible = style === "zopf";
      hairDutt.visible = style === "dutt";
    }

    var accUmhang = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.1, 0.08), accentMat);
    group.add(accUmhang);

    var accSchal = new THREE.Group();
    var scarfWrap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), accentMat);
    var scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.08), accentMat);
    scarfTail.position.set(0.14, -0.34, 0.21);
    scarfTail.rotation.z = 0.1;
    accSchal.add(scarfWrap, scarfTail);
    group.add(accSchal);

    var pauldronGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    var pauldronL = new THREE.Mesh(pauldronGeo, accentMat);
    var pauldronR = new THREE.Mesh(pauldronGeo, accentMat);
    group.add(pauldronL, pauldronR);

    function applyAccessory3d(acc) {
      accUmhang.visible = acc === "umhang";
      accSchal.visible = acc === "schal";
      pauldronL.visible = acc === "schultern";
      pauldronR.visible = acc === "schultern";
    }

    // "Laufen" wird pro Frame in animate() gesetzt (siehe apply3dWalkFrame
    // unten), nicht hier - diese Funktion sorgt nur dafuer, dass beim Wechsel
    // WEG von "Laufen" Huefte/Arm-Rotation und der Lauf-Huepfer wieder
    // sauber auf 0 stehen.
    function applyPose3d(pose) {
      if (pose === "laufen") return;
      var rad = ((D.POSE_ANGLES_DEG[pose] || 0) * Math.PI) / 180;
      armPivotL.rotation.z = -rad;
      armPivotR.rotation.z = rad;
      armPivotL.rotation.x = 0;
      armPivotR.rotation.x = 0;
      legPivotL.rotation.x = 0;
      legPivotR.rotation.x = 0;
      group.position.y = 0;
    }

    var WALK_SPEED_3D = 6;
    var LEG_SWING_AMP_3D = 0.26;
    var ARM_SWING_AMP_3D = 0.24;
    var WALK_BOB_AMP_3D = 0.022;
    function apply3dWalkFrame(t) {
      var swing = Math.sin(t * WALK_SPEED_3D);
      legPivotL.rotation.x = swing * LEG_SWING_AMP_3D;
      legPivotR.rotation.x = -swing * LEG_SWING_AMP_3D;
      armPivotL.rotation.z = 0;
      armPivotR.rotation.z = 0;
      armPivotL.rotation.x = -swing * ARM_SWING_AMP_3D;
      armPivotR.rotation.x = swing * ARM_SWING_AMP_3D;
      group.position.y = Math.abs(swing) * WALK_BOB_AMP_3D;
    }

    scene.add(group);

    var platform = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 2.6), platformMat);
    platform.position.set(0, -0.08, 0);
    scene.add(platform);

    var DEFAULT_WIDTH = 0.4;
    var OVERLAP = 0.03;
    var LEG_W = 0.34, LEG_D = 0.34, LEG_LEN0 = 0.85;
    var TORSO_D = 0.38, TORSO_LEN0 = 1.0;
    var BASE_TORSO_TOP = LEG_LEN0 - OVERLAP + TORSO_LEN0;

    function applyProportions(character) {
      var w = character.width, h = character.size;
      var legLen = LEG_LEN0 * h;
      legL.scale.set(LEG_W, legLen, LEG_D);
      legR.scale.set(LEG_W, legLen, LEG_D);
      legL.position.y = -legLen / 2;
      legR.position.y = -legLen / 2;
      var legTopY = legLen;
      legPivotL.position.y = legTopY;
      legPivotR.position.y = legTopY;

      var torsoLen = TORSO_LEN0 * (1 + (h - 1) * 0.5);
      var torsoBottomY = legTopY - OVERLAP;
      torso.scale.set(2 * w, torsoLen, TORSO_D);
      torso.position.y = torsoBottomY + torsoLen / 2;
      var torsoTopY = torsoBottomY + torsoLen;

      var skirtTopY = torsoBottomY + 0.05;
      var skirtTier1H = 0.15;
      skirtUpper.scale.set(2 * w + 0.1, skirtTier1H, TORSO_D + 0.1);
      skirtUpper.position.y = skirtTopY - skirtTier1H / 2;
      var skirtTier1BottomY = skirtTopY - skirtTier1H;

      var skirtTier2H = 0.22;
      skirtMid.scale.set(2 * w + 0.55, skirtTier2H, TORSO_D + 0.4);
      skirtMid.position.y = skirtTier1BottomY - skirtTier2H / 2;
      var skirtTier2BottomY = skirtTier1BottomY - skirtTier2H;

      var skirtTier3H = 0.3;
      skirtLower.scale.set(2 * w + 1.0, skirtTier3H, TORSO_D + 0.75);
      skirtLower.position.y = skirtTier2BottomY - skirtTier3H / 2;

      var isGirl = character.bodyType === "maedchen";
      skirtUpper.visible = isGirl;
      skirtMid.visible = isGirl;
      skirtLower.visible = isGirl;

      headGroup.position.y = torsoTopY - BASE_TORSO_TOP;

      var shoulderY = torsoTopY - 0.02;
      armPivotL.position.y = shoulderY;
      armPivotR.position.y = shoulderY;
      pauldronL.position.y = shoulderY + 0.14;
      pauldronR.position.y = shoulderY + 0.14;
      accUmhang.position.y = shoulderY - 0.54;
      accUmhang.position.z = -(TORSO_D / 2 + 0.09);
      scarfWrap.position.y = shoulderY + 0.1;
      scarfTail.position.y = shoulderY + 0.1;

      var armX = w + 0.16;
      armPivotL.position.x = -armX;
      armPivotR.position.x = armX;
      pauldronL.position.x = -armX;
      pauldronR.position.x = armX;

      var legFactor = 0.7 + 0.3 * (w / DEFAULT_WIDTH);
      legPivotL.position.x = -0.2 * legFactor;
      legPivotR.position.x = 0.2 * legFactor;
    }

    function apply3dColors(character) {
      skinMat.color.set(character.skin);
      topMat.color.set(character.top);
      hairMat.color.set(character.hair);
      accentMat.color.set(character.accent);
      eyeMat.color.set(character.eye);
    }

    // ---------- Drehen per Ziehen ----------
    var isDragging = false;
    var lastX = 0;
    var canvas = renderer.domElement;
    function onDown(e) {
      e.preventDefault();
      isDragging = true;
      lastX = e.clientX;
      container.classList.add("is-dragging");
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
    function onMoveDrag(e) {
      if (!isDragging) return;
      var dx = e.clientX - lastX;
      lastX = e.clientX;
      group.rotation.y += dx * 0.01;
    }
    function onUpDrag() {
      isDragging = false;
      container.classList.remove("is-dragging");
    }
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMoveDrag);
    window.addEventListener("pointerup", onUpDrag);
    canvas.addEventListener("pointercancel", onUpDrag);

    // ---------- Groesse ----------
    // ResizeObserver statt window-"resize": greift auch, wenn nur der
    // Container selbst die Groesse aendert (Grid-Umbruch, oder wenn dieser
    // Container gerade erst von hidden auf sichtbar wechselt) - ein reines
    // window-resize-Event wuerde den zweiten Fall verpassen.
    function onResize() {
      var w = container.clientWidth;
      var h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    if (window.ResizeObserver) {
      new ResizeObserver(onResize).observe(container);
    } else {
      window.addEventListener("resize", onResize);
    }
    onResize();

    // ---------- Animationsschleife ----------
    var autoRotate = opts.autoRotate !== false;
    var currentCharacter = null;
    var walkStart = null;
    function animate() {
      requestAnimationFrame(animate);
      if (!isDragging && autoRotate) group.rotation.y += 0.006;
      if (currentCharacter && currentCharacter.pose === "laufen") {
        if (walkStart == null) walkStart = performance.now();
        apply3dWalkFrame((performance.now() - walkStart) / 1000);
      } else {
        walkStart = null;
      }
      renderer.render(scene, camera);
    }
    animate();

    function applyCharacter(character) {
      currentCharacter = character;
      apply3dColors(character);
      applyHairStyle3d(character.hairStyle);
      applyAccessory3d(character.accessory);
      applyPose3d(character.pose);
      applyMouth3d(character.mouth);
      applyProportions(character);
    }

    function setAutoRotate(on) {
      autoRotate = !!on;
    }

    return { applyCharacter: applyCharacter, setAutoRotate: setAutoRotate };
  }

  window.BitiFigure3d = { mount: mount };
})();
