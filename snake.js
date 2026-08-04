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
    localStorage.setItem(KEYS.highscore, "0");
    localStorage.setItem(KEYS.records, "[]");
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
          localStorage.setItem(KEYS.owned, JSON.stringify(owned));
          localStorage.setItem(KEYS.coins, String(coins));
        }
        skin = id;
        localStorage.setItem(KEYS.skin, id);
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
    localStorage.setItem(KEYS.records, JSON.stringify(records));
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
    boardWrap.style.width = size + "px";
    boardWrap.style.height = size + "px";
    canvas.width = size;
    canvas.height = size;
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

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    var colors = SKINS[skin];
    ctx.fillStyle = "#0f2a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    for (var x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cell, 0);
      ctx.lineTo(x * cell, canvas.height);
      ctx.stroke();
    }
    for (var y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cell);
      ctx.lineTo(canvas.width, y * cell);
      ctx.stroke();
    }

    ctx.fillStyle = "#3a5a45";
    obstacles.forEach(function (o) {
      roundRect(o.x * cell + cell * 0.08, o.y * cell + cell * 0.08, cell * 0.84, cell * 0.84, cell * 0.18);
      ctx.fill();
    });

    ctx.fillStyle = "#ffc247";
    roundRect(food.x * cell + cell * 0.15, food.y * cell + cell * 0.15, cell * 0.7, cell * 0.7, cell * 0.3);
    ctx.fill();

    if (bonusFood) {
      var cx = bonusFood.x * cell + cell / 2;
      var cy = bonusFood.y * cell + cell / 2;
      ctx.fillStyle = "#ff5fa2";
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = Math.max(2, cell * 0.08);
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.46, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (bonusFood.ttl / BONUS_TTL)));
      ctx.stroke();
    }

    snake.forEach(function (segment, i) {
      ctx.fillStyle = i === 0 ? colors.head : colors.body;
      roundRect(segment.x * cell + cell * 0.1, segment.y * cell + cell * 0.1, cell * 0.8, cell * 0.8, cell * 0.3);
      ctx.fill();
    });
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
      localStorage.setItem(KEYS.highscore, String(highscore));
      highscoreEl.textContent = highscore;
    }
    addRecord(score);
    var earned = Math.floor(score / 10);
    if (earned > 0) {
      coins += earned;
      localStorage.setItem(KEYS.coins, String(coins));
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
