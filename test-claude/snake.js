(function () {
  var SKINS = {
    classic: { name: "Classic", cost: 0, head: "#bff7a0", body: "#22c55e" },
    feuer: { name: "Feuer", cost: 20, head: "#ff7a3d", body: "#ffcf3d" },
    ozean: { name: "Ozean", cost: 20, head: "#2fd6c0", body: "#4a8cff" },
    mitternacht: { name: "Mitternacht", cost: 15, head: "#b892ff", body: "#3d2f66" },
    gold: { name: "Gold", cost: 35, head: "#f4c430", body: "#fff1b8" },
    retro: { name: "Retro-Terminal", cost: 45, head: "#39ff14", body: "#052e0f" },
  };
  var DIFFICULTIES = {
    leicht: { label: "Leicht", start: 170, min: 100, step: 2 },
    normal: { label: "Normal", start: 140, min: 70, step: 3 },
    schwer: { label: "Schwer", start: 110, min: 55, step: 4 },
  };
  var KEYS = {
    highscore: "snakeHighscore",
    coins: "snakeCoins",
    owned: "snakeOwnedSkins",
    skin: "snakeSkin",
    wrap: "snakeWrap",
    obstacles: "snakeObstacles",
    difficulty: "snakeDifficulty",
    sound: "snakeSound",
    records: "snakeRecords",
  };

  var highscore = Number(localStorage.getItem(KEYS.highscore)) || 0;
  var coins = Number(localStorage.getItem(KEYS.coins)) || 0;
  var owned = JSON.parse(localStorage.getItem(KEYS.owned) || '["classic"]');
  var skin = localStorage.getItem(KEYS.skin) || "classic";
  var wrapEnabled = localStorage.getItem(KEYS.wrap) === "1";
  var obstaclesEnabled = localStorage.getItem(KEYS.obstacles) === "1";
  var difficulty = localStorage.getItem(KEYS.difficulty) || "normal";
  var soundEnabled = localStorage.getItem(KEYS.sound) !== "0";
  var records = JSON.parse(localStorage.getItem(KEYS.records) || "[]");

  // Testmodus: Fortschritt (Highscore, Münzen, Skins, Bestenliste) darf hier nicht persistiert werden.
  var PROGRESS_KEYS = {};
  [KEYS.highscore, KEYS.coins, KEYS.owned, KEYS.skin, KEYS.records].forEach(function (k) { PROGRESS_KEYS[k] = true; });
  function persist(key, value) {
    if (PROGRESS_KEYS[key]) return;
    localStorage.setItem(key, value);
  }

  var views = {};
  document.querySelectorAll(".mini-view").forEach(function (el) { views[el.id] = el; });

  function showView(id) {
    Object.keys(views).forEach(function (key) {
      views[key].classList.toggle("hidden", key !== id);
    });
    document.body.classList.toggle("in-game", id !== "view-intro");
  }

  document.getElementById("open-menu-button").addEventListener("click", function () { showView("view-menu"); });
  document.querySelectorAll("[data-back-to-menu]").forEach(function (btn) {
    btn.addEventListener("click", function () { stopGame(); showView("view-menu"); renderCoins(); });
  });
  document.getElementById("settings-button").addEventListener("click", function () { showView("view-settings"); renderSettings(); });
  document.getElementById("shop-button").addEventListener("click", function () { showView("view-shop"); renderShop(); });
  document.getElementById("records-button").addEventListener("click", function () { showView("view-records"); renderRecords(); });

  function renderCoins() {
    var text = "🪙 " + coins + " Münzen";
    document.getElementById("menu-coins").textContent = text;
    document.getElementById("shop-coins").textContent = text;
    document.getElementById("game-coins").textContent = coins;
  }

  function renderSettings() {
    document.getElementById("wrap-toggle").classList.toggle("on", wrapEnabled);
    document.getElementById("obstacles-toggle").classList.toggle("on", obstaclesEnabled);
    document.getElementById("sound-toggle").classList.toggle("on", soundEnabled);
    document.getElementById("difficulty-select").value = difficulty;
  }
  document.getElementById("wrap-toggle").addEventListener("click", function () {
    wrapEnabled = !wrapEnabled;
    localStorage.setItem(KEYS.wrap, wrapEnabled ? "1" : "0");
    renderSettings();
  });
  document.getElementById("obstacles-toggle").addEventListener("click", function () {
    obstaclesEnabled = !obstaclesEnabled;
    localStorage.setItem(KEYS.obstacles, obstaclesEnabled ? "1" : "0");
    renderSettings();
  });
  document.getElementById("sound-toggle").addEventListener("click", function () {
    soundEnabled = !soundEnabled;
    localStorage.setItem(KEYS.sound, soundEnabled ? "1" : "0");
    renderSettings();
  });
  document.getElementById("difficulty-select").addEventListener("change", function (e) {
    difficulty = e.target.value;
    localStorage.setItem(KEYS.difficulty, difficulty);
  });
  document.getElementById("reset-highscore-button").addEventListener("click", function () {
    highscore = 0;
    records = [];
    persist(KEYS.highscore, "0");
    persist(KEYS.records, "[]");
    document.getElementById("highscore").textContent = "0";
  });

  function renderShop() {
    var grid = document.getElementById("shop-grid");
    grid.innerHTML = "";
    Object.keys(SKINS).forEach(function (id) {
      var s = SKINS[id];
      var isOwned = owned.indexOf(id) !== -1;
      var isSelected = skin === id;
      var card = document.createElement("div");
      card.className = "shop-card" + (isSelected ? " selected" : "");
      var canAfford = isOwned || coins >= s.cost;
      var btnLabel = isSelected ? "Ausgewählt" : isOwned ? "Auswählen" : "Kaufen (" + s.cost + " 🪙)";
      card.innerHTML =
        '<div class="shop-swatch" style="background:linear-gradient(145deg,' + s.head + "," + s.body + ')"></div>' +
        "<h3>" + s.name + "</h3>" +
        "<p>" + (isOwned ? "Freigeschaltet" : s.cost + " Münzen") + "</p>" +
        '<button class="mini-btn"' + (isSelected || !canAfford ? " disabled" : "") + ">" + btnLabel + "</button>";
      card.querySelector("button").addEventListener("click", function () {
        if (isSelected || !canAfford) return;
        if (!isOwned) {
          if (coins < s.cost) return;
          coins -= s.cost;
          owned.push(id);
          persist(KEYS.owned, JSON.stringify(owned));
          persist(KEYS.coins, String(coins));
        }
        skin = id;
        persist(KEYS.skin, id);
        renderCoins();
        renderShop();
      });
      grid.appendChild(card);
    });
  }

  function renderRecords() {
    var list = document.getElementById("records-list");
    list.innerHTML = "";
    if (!records.length) {
      list.innerHTML = '<p class="mini-help">Noch keine Runde gespielt. Starte eine Runde, um hier zu erscheinen.</p>';
      return;
    }
    records.forEach(function (r, i) {
      var row = document.createElement("div");
      row.className = "record-row";
      row.innerHTML =
        '<span class="record-rank">' + (i + 1) + "</span>" +
        '<span class="record-score">' + r.score + " Punkte</span>" +
        '<span class="record-date">' + r.date + "</span>";
      list.appendChild(row);
    });
  }

  function addRecord(finalScore) {
    records.push({ score: finalScore, date: new Date().toLocaleDateString("de-DE") });
    records.sort(function (a, b) { return b.score - a.score; });
    records = records.slice(0, 5);
    persist(KEYS.records, JSON.stringify(records));
  }

  var audioCtx = null;
  function ensureAudio() {
    if (audioCtx || !soundEnabled) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
  document.addEventListener("pointerdown", ensureAudio, { once: true });
  document.addEventListener("keydown", ensureAudio, { once: true });

  function beep(freq, dur, type) {
    if (!soundEnabled || !audioCtx) return;
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.type = type || "square";
    o.frequency.value = freq;
    g.gain.value = 0.06;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.stop(audioCtx.currentTime + dur);
  }

  var canvas = document.getElementById("snake-board");
  var ctx = canvas.getContext("2d");
  var boardWrap = document.getElementById("board-wrap");
  var gridCount = 22;
  var cell, cols, rows;
  // Logische Brettgroesse in CSS-Pixeln. Die Canvas-Pixel koennen dank
  // Pixeldichte-Skalierung groesser sein (siehe sizeBoard), deshalb darf im
  // Zeichencode NICHT canvas.width verwendet werden.
  var boardSize = 0;

  var scoreEl = document.getElementById("score");
  var highscoreEl = document.getElementById("highscore");
  highscoreEl.textContent = highscore;
  var overlay = document.getElementById("overlay");
  var overlayTitle = document.getElementById("overlay-title");
  var overlayText = document.getElementById("overlay-text");
  var pauseOverlay = document.getElementById("pause-overlay");
  var pauseButton = document.getElementById("pause-button");

  var snake, direction, nextDirection, food, bonusFood, obstacles, score, speed, timer, running, paused, foodCount;
  var BONUS_TTL = 45;
  var BONUS_SCORE = 30;

  function sizeBoard() {
    var available = Math.min(window.innerWidth - 40, 560, window.innerHeight - 260);
    var size = Math.max(240, Math.floor(available / gridCount) * gridCount);
    cell = size / gridCount;
    cols = gridCount;
    rows = gridCount;
    boardSize = size;
    boardWrap.style.width = size + "px";
    boardWrap.style.height = size + "px";
    // Auf hochaufloesenden Displays mit mehr Canvas-Pixeln zeichnen und per
    // CSS auf die logische Groesse zurueckskalieren, damit Rundungen, Augen
    // und Glanzkanten scharf bleiben. Auf 2 gedeckelt, damit sehr grosse
    // Pixeldichten die Zeichenflaeche nicht unnoetig aufblaehen.
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    // Muss NACH dem Setzen von width/height passieren - das setzt den
    // Kontext (inkl. Transform) zurueck.
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function inStartZone(x, y) {
    return x < 11 && y > 7 && y < 13;
  }

  function placeObstacles() {
    obstacles = [];
    if (!obstaclesEnabled) return;
    var target = Math.round(cols * rows * 0.045);
    var guard = 0;
    while (obstacles.length < target && guard < 2000) {
      guard++;
      var x = Math.floor(Math.random() * cols);
      var y = Math.floor(Math.random() * rows);
      if (inStartZone(x, y)) continue;
      if (obstacles.some(function (o) { return o.x === x && o.y === y; })) continue;
      obstacles.push({ x: x, y: y });
    }
  }

  function resetState() {
    snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    direction = "right";
    nextDirection = "right";
    score = 0;
    foodCount = 0;
    bonusFood = null;
    paused = false;
    pauseOverlay.classList.add("hidden");
    speed = DIFFICULTIES[difficulty].start;
    scoreEl.textContent = "0";
    placeObstacles();
    placeFood();
  }

  function freeCells(exclude) {
    var options = [];
    for (var x = 0; x < cols; x++) {
      for (var y = 0; y < rows; y++) {
        var onSnake = snake.some(function (s) { return s.x === x && s.y === y; });
        var onObstacle = obstacles.some(function (o) { return o.x === x && o.y === y; });
        var onExclude = exclude && exclude.x === x && exclude.y === y;
        if (!onSnake && !onObstacle && !onExclude) options.push({ x: x, y: y });
      }
    }
    return options;
  }

  function placeFood() {
    var options = freeCells();
    food = options[Math.floor(Math.random() * options.length)];
  }

  function maybeSpawnBonus() {
    if (bonusFood || obstaclesEnabled && Math.random() < 0.001) return;
    if (foodCount > 0 && foodCount % 4 === 0) {
      var options = freeCells(food);
      if (options.length) {
        var spot = options[Math.floor(Math.random() * options.length)];
        bonusFood = { x: spot.x, y: spot.y, ttl: BONUS_TTL };
      }
    }
  }

  // --- Zeichen-Hilfen -------------------------------------------------
  // addRoundRect() haengt nur eine Teilform an den offenen Pfad an (kein
  // beginPath). Dadurch lassen sich Koerper und Verbindungsstuecke der
  // Schlange zu EINEM Pfad zusammenfassen und in einem einzigen fill() mit
  // Schein zeichnen - deutlich guenstiger als ein Aufruf je Segment.
  function addRoundRect(x, y, w, h, r) {
    var max = Math.min(w, h) / 2;
    if (r > max) r = max;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    addRoundRect(x, y, w, h, r);
  }

  // Mischt eine Hex-Farbe Richtung Weiss (amount > 0) bzw. Schwarz (< 0).
  // Damit leiten sich Glanzlicht und Schattenkante aus der jeweiligen
  // Skin-Farbe ab, statt fuer jeden Skin eigene Farbwerte zu pflegen.
  function shade(hex, amount) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var t = amount < 0 ? 0 : 255;
    var p = Math.abs(amount);
    r = Math.round(r + (t - r) * p);
    g = Math.round(g + (t - g) * p);
    b = Math.round(b + (t - b) * p);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  var DIRECTION_VECTORS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  // Zwei Segmente gelten nur als verbunden, wenn sie direkt benachbart sind.
  // Bei aktiviertem Wanddurchlauf springt die Schlange von einer Kante zur
  // gegenueberliegenden - dort darf KEIN Verbindungsstueck quer ueber das
  // ganze Feld gezeichnet werden.
  function isAdjacent(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  }

  function addLink(a, b, width) {
    var inset = (cell - width) / 2;
    var x = Math.min(a.x, b.x) * cell + inset;
    var y = Math.min(a.y, b.y) * cell + inset;
    var horizontal = a.y === b.y;
    addRoundRect(
      x, y,
      horizontal ? cell + width : width,
      horizontal ? width : cell + width,
      width * 0.3
    );
  }

  function drawBackground() {
    ctx.fillStyle = "#0b1d13";
    ctx.fillRect(0, 0, boardSize, boardSize);

    ctx.strokeStyle = "rgba(120, 255, 170, 0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 1; i < cols; i++) {
      var p = Math.round(i * cell) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, boardSize);
      ctx.moveTo(0, p);
      ctx.lineTo(boardSize, p);
    }
    ctx.stroke();
  }

  // Hindernisse hoben sich frueher kaum vom Hintergrund ab. Jetzt: dunkler
  // Block mit hellem Oberkanten-Bevel und Rand, damit sie eindeutig als
  // Wand lesbar sind.
  function drawObstacles() {
    if (!obstacles.length) return;
    var pad = cell * 0.06;
    var size = cell - pad * 2;

    ctx.beginPath();
    obstacles.forEach(function (o) {
      addRoundRect(o.x * cell + pad, o.y * cell + pad, size, size, cell * 0.16);
    });
    ctx.fillStyle = "#23342c";
    ctx.fill();
    ctx.strokeStyle = "rgba(130, 200, 160, 0.45)";
    ctx.lineWidth = Math.max(1, cell * 0.05);
    ctx.stroke();

    ctx.beginPath();
    obstacles.forEach(function (o) {
      addRoundRect(o.x * cell + pad * 2.2, o.y * cell + pad * 2.2, size * 0.68, size * 0.3, cell * 0.08);
    });
    ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
    ctx.fill();
  }

  // Frucht als gewoelbte Kugel mit Schein, Stiel und Blatt statt eines
  // flachen Kaestchens.
  function drawFruit(gx, gy, color, radiusFactor) {
    var cx = gx * cell + cell / 2;
    var cy = gy * cell + cell / 2 + cell * 0.04;
    var r = cell * radiusFactor;

    var gradient = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.15, cx, cy, r);
    gradient.addColorStop(0, shade(color, 0.45));
    gradient.addColorStop(0.55, color);
    gradient.addColorStop(1, shade(color, -0.35));

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = cell * 0.55;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.34, cy - r * 0.42, r * 0.22, r * 0.15, -Math.PI / 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#7a5a2a";
    ctx.lineWidth = Math.max(1, cell * 0.05);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.9);
    ctx.lineTo(cx + r * 0.1, cy - r * 1.3);
    ctx.stroke();

    ctx.fillStyle = "#4caf50";
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.42, cy - r * 1.2, r * 0.32, r * 0.16, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnake(colors) {
    var count = snake.length;
    var headWidth = cell * 0.86;
    var tailWidth = cell * 0.52;

    function widthAt(i) {
      if (count < 2) return headWidth;
      return headWidth + (tailWidth - headWidth) * (i / (count - 1));
    }

    // Ein Pfad aus allen Segmenten UND den Verbindungsstuecken dazwischen:
    // dadurch wirkt die Schlange als durchgehender Koerper statt als Reihe
    // einzelner Kacheln - und der Schein wird nur einmal berechnet.
    ctx.beginPath();
    for (var i = 0; i < count; i++) {
      var w = widthAt(i);
      var inset = (cell - w) / 2;
      addRoundRect(snake[i].x * cell + inset, snake[i].y * cell + inset, w, w, w * 0.32);
      if (i > 0 && isAdjacent(snake[i - 1], snake[i])) {
        addLink(snake[i - 1], snake[i], Math.min(widthAt(i - 1), w));
      }
    }
    // Der Schein ist bewusst eine AUFGEHELLTE Variante der Koerperfarbe, nicht
    // die Farbe selbst: dunkle Skins (z.B. Retro-Terminal mit #052e0f) waeren
    // sonst kaum vom Hintergrund zu unterscheiden und man liefe in den eigenen
    // Schwanz. So bleibt die Silhouette bei jedem Skin lesbar.
    // Zweimal fuellen: der Schein legt sich dabei doppelt uebereinander und
    // ergibt einen deutlich sichtbaren Saum. Guenstiger als ein groesserer
    // shadowBlur und noetig, damit dunkle Skins ihre Kontur behalten.
    ctx.save();
    ctx.shadowColor = shade(colors.body, 0.45);
    ctx.shadowBlur = cell * 0.5;
    ctx.fillStyle = colors.body;
    ctx.fill();
    ctx.fill();
    ctx.restore();

    // Glanzkante oben auf jedem Segment - gibt den Bloecken Tiefe, ohne die
    // durchgehende Silhouette aufzubrechen.
    ctx.beginPath();
    for (var j = 0; j < count; j++) {
      var sw = widthAt(j);
      var si = (cell - sw) / 2;
      addRoundRect(
        snake[j].x * cell + si + sw * 0.16,
        snake[j].y * cell + si + sw * 0.12,
        sw * 0.68, sw * 0.26, sw * 0.13
      );
    }
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fill();

    // Kopf zuletzt, damit er ueber dem Hals liegt.
    var head = snake[0];
    var hw = headWidth;
    var hi = (cell - hw) / 2;
    ctx.save();
    ctx.shadowColor = shade(colors.head, 0.4);
    ctx.shadowBlur = cell * 0.6;
    ctx.fillStyle = colors.head;
    roundRect(head.x * cell + hi, head.y * cell + hi, hw, hw, hw * 0.34);
    ctx.fill();
    ctx.restore();

    drawEyes(head, colors);
  }

  // Augen zeigen in Laufrichtung - erst dadurch ist auf einen Blick klar,
  // wo vorne ist.
  function drawEyes(head, colors) {
    var dir = DIRECTION_VECTORS[direction] || DIRECTION_VECTORS.right;
    var cx = head.x * cell + cell / 2;
    var cy = head.y * cell + cell / 2;
    var forward = cell * 0.15;
    var side = cell * 0.19;
    var eyeR = cell * 0.115;
    var pupilR = cell * 0.058;
    // Senkrecht zur Laufrichtung, damit die Augen nebeneinander sitzen.
    var px = -dir.y;
    var py = dir.x;

    for (var s = -1; s <= 1; s += 2) {
      var ex = cx + dir.x * forward + px * side * s;
      var ey = cy + dir.y * forward + py * side * s;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = shade(colors.body, -0.75);
      ctx.beginPath();
      ctx.arc(ex + dir.x * eyeR * 0.35, ey + dir.y * eyeR * 0.35, pupilR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    var colors = SKINS[skin];

    drawBackground();
    drawObstacles();
    drawFruit(food.x, food.y, "#ffc247", 0.3);

    if (bonusFood) {
      drawFruit(bonusFood.x, bonusFood.y, "#ff5fa2", 0.33);
      // Restlaufzeit als Ring um die Bonusfrucht (Mechanik unveraendert).
      var bx = bonusFood.x * cell + cell / 2;
      var by = bonusFood.y * cell + cell / 2;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(2, cell * 0.075);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(bx, by, cell * 0.44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (bonusFood.ttl / BONUS_TTL));
      ctx.stroke();
    }

    drawSnake(colors);
  }

  function step() {
    if (paused) return;
    direction = nextDirection;
    var head = { x: snake[0].x, y: snake[0].y };
    if (direction === "up") head.y -= 1;
    if (direction === "down") head.y += 1;
    if (direction === "left") head.x -= 1;
    if (direction === "right") head.x += 1;

    if (wrapEnabled) {
      head.x = (head.x + cols) % cols;
      head.y = (head.y + rows) % rows;
    }

    var hitsWall = head.x < 0 || head.x >= cols || head.y < 0 || head.y >= rows;
    var hitsSelf = snake.some(function (s) { return s.x === head.x && s.y === head.y; });
    var hitsObstacle = obstacles.some(function (o) { return o.x === head.x && o.y === head.y; });

    if (hitsWall || hitsSelf || hitsObstacle) {
      gameOver();
      return;
    }

    snake.unshift(head);

    if (bonusFood && head.x === bonusFood.x && head.y === bonusFood.y) {
      score += BONUS_SCORE;
      scoreEl.textContent = score;
      bonusFood = null;
      beep(760, 0.14, "triangle");
    }

    if (head.x === food.x && head.y === food.y) {
      score += 10;
      foodCount++;
      scoreEl.textContent = score;
      speed = Math.max(DIFFICULTIES[difficulty].min, speed - DIFFICULTIES[difficulty].step);
      placeFood();
      maybeSpawnBonus();
      restartTimer();
      beep(520, 0.08, "square");
    } else {
      snake.pop();
    }

    if (bonusFood) {
      bonusFood.ttl--;
      if (bonusFood.ttl <= 0) bonusFood = null;
    }

    draw();
  }

  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(step, speed);
  }

  function gameOver() {
    running = false;
    clearInterval(timer);
    beep(160, 0.3, "sawtooth");
    if (score > highscore) {
      highscore = score;
      persist(KEYS.highscore, String(highscore));
      highscoreEl.textContent = highscore;
    }
    addRecord(score);
    var earned = Math.floor(score / 10);
    if (earned > 0) {
      coins += earned;
      persist(KEYS.coins, String(coins));
      renderCoins();
    }
    overlayTitle.textContent = "Game Over";
    overlayText.textContent = "Du hast " + score + " Punkte erreicht" + (earned > 0 ? " und " + earned + " Münzen verdient." : ".");
    overlay.classList.remove("hidden");
  }

  function startGame() {
    sizeBoard();
    resetState();
    draw();
    running = true;
    overlay.classList.add("hidden");
    restartTimer();
  }

  function stopGame() {
    clearInterval(timer);
    running = false;
    paused = false;
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    if (paused) {
      clearInterval(timer);
      pauseOverlay.classList.remove("hidden");
    } else {
      pauseOverlay.classList.add("hidden");
      restartTimer();
    }
  }

  function setDirection(dir) {
    if (!running || paused) return;
    var opposite = { up: "down", down: "up", left: "right", right: "left" };
    if (opposite[dir] === direction) return;
    nextDirection = dir;
  }

  var keyMap = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    w: "up", s: "down", a: "left", d: "right",
    W: "up", S: "down", A: "left", D: "right",
  };
  document.addEventListener("keydown", function (e) {
    var dir = keyMap[e.key];
    if (dir) {
      e.preventDefault();
      setDirection(dir);
      return;
    }
    if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      if (!views["view-game"].classList.contains("hidden")) togglePause();
    }
  });

  var touchStart = null;
  boardWrap.addEventListener("touchstart", function (e) {
    var t = e.changedTouches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  boardWrap.addEventListener("touchend", function (e) {
    if (!touchStart) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - touchStart.x;
    var dy = t.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirection(dx > 0 ? "right" : "left");
    } else {
      setDirection(dy > 0 ? "down" : "up");
    }
  }, { passive: true });

  document.querySelectorAll("[data-dir]").forEach(function (btn) {
    btn.addEventListener("click", function () { setDirection(btn.getAttribute("data-dir")); });
  });

  pauseButton.addEventListener("click", togglePause);
  document.getElementById("resume-button").addEventListener("click", togglePause);
  document.getElementById("pause-menu-button").addEventListener("click", function () {
    stopGame();
    showView("view-menu");
    renderCoins();
  });
  document.getElementById("game-menu-button").addEventListener("click", function () {
    stopGame();
    showView("view-menu");
    renderCoins();
  });

  document.getElementById("start-button").addEventListener("click", function () {
    showView("view-game");
    startGame();
  });
  document.getElementById("retry-button").addEventListener("click", startGame);

  renderCoins();
})();
