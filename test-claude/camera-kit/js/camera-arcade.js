import {
  Transform2D,
  bootstrapCameraKit,
  createMediaStreamSource,
} from "@snap/camera-kit";

const POSE_ROUNDS = 5;
const FREEZE_ROUNDS = 5;
const POSE_TIME_MS = 8000;
const FREEZE_TIME_MS = 7000;
const BEST_KEY = "camera-arcade:best:v1";

const POSE_PROMPTS = [
  "Zeig dein breitestes Grinsen",
  "Schau so überrascht wie möglich",
  "Mach eine Superhelden-Pose",
  "Bleib komplett ernst",
  "Zeig einen Daumen nach oben",
  "Tu so, als hättest du gerade gewonnen",
  "Mach dein bestes Roboter-Gesicht",
  "Schau geheimnisvoll in die Kamera",
];

const elements = {
  best: document.getElementById("ca-best"),
  cameraSelect: document.getElementById("ca-camera-select"),
  canvas: document.getElementById("ca-canvas"),
  challenge: document.getElementById("ca-challenge"),
  challengeText: document.getElementById("ca-challenge-text"),
  flash: document.getElementById("ca-flash"),
  freezeCursor: document.getElementById("ca-freeze-cursor"),
  freezeMeter: document.getElementById("ca-freeze-meter"),
  gallery: document.getElementById("ca-gallery"),
  lensCount: document.getElementById("ca-lens-count"),
  lensList: document.getElementById("ca-lens-list"),
  livePill: document.getElementById("ca-live-pill"),
  modeLabel: document.getElementById("ca-mode-label"),
  modeList: document.getElementById("ca-mode-list"),
  overlay: document.getElementById("ca-stage-overlay"),
  overlayText: document.getElementById("ca-overlay-text"),
  overlayTitle: document.getElementById("ca-overlay-title"),
  photoCount: document.getElementById("ca-photo-count"),
  round: document.getElementById("ca-round"),
  score: document.getElementById("ca-score"),
  shutter: document.getElementById("ca-shutter"),
  shutterLabel: document.getElementById("ca-shutter-label"),
  start: document.getElementById("ca-start"),
  status: document.getElementById("ca-status"),
  stop: document.getElementById("ca-stop"),
  timer: document.getElementById("ca-timer"),
  timerBar: document.getElementById("ca-timer-bar"),
  timerValue: document.getElementById("ca-timer-value"),
};

let runtime = null;
let selectedMode = "lab";
let score = 0;
let round = 0;
let remainingMs = 0;
let freezePosition = 0;
let activeLensIndex = -1;
let loopFrame = 0;
let nextRoundTimer = 0;
let lifecycle = 0;
let captures = [];
let isStarting = false;

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch (error) {
    return 0;
  }
}

function writeBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch (error) {
    // Das Spiel bleibt auch ohne lokalen Speicher vollständig spielbar.
  }
}

function setStatus(message) {
  elements.status.textContent = message;
}

function updateHud() {
  elements.score.textContent = String(score);
  elements.round.textContent = selectedMode === "lab" ? "frei" : `${round}/${selectedMode === "pose" ? POSE_ROUNDS : FREEZE_ROUNDS}`;
  elements.best.textContent = String(readBest());
}

function setLive(isLive) {
  elements.livePill.dataset.state = isLive ? "on" : "off";
  elements.livePill.textContent = isLive ? "Live" : "Kamera aus";
}

function cancelLoops() {
  if (loopFrame) cancelAnimationFrame(loopFrame);
  if (nextRoundTimer) clearTimeout(nextRoundTimer);
  loopFrame = 0;
  nextRoundTimer = 0;
}

function setModesDisabled(disabled) {
  elements.modeList.querySelectorAll("button[data-mode]").forEach((button) => {
    button.disabled = disabled;
  });
}

function setLensButtonsDisabled(disabled) {
  elements.lensList.querySelectorAll("button[data-lens-index]").forEach((button) => {
    button.disabled = disabled;
  });
}

function setModeVisual(mode) {
  selectedMode = mode;
  elements.modeList.querySelectorAll("button[data-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });
}

function clearCaptureUrls() {
  captures.forEach((capture) => URL.revokeObjectURL(capture.url));
  captures = [];
  renderGallery();
}

function renderGallery() {
  elements.photoCount.textContent = String(captures.length);
  elements.gallery.replaceChildren();

  if (!captures.length) {
    const empty = document.createElement("p");
    empty.className = "ca-empty";
    empty.textContent = "Noch kein Schnappschuss.";
    elements.gallery.appendChild(empty);
    return;
  }

  captures.slice(-8).reverse().forEach((capture, index) => {
    const image = document.createElement("img");
    image.src = capture.url;
    image.alt = `Schnappschuss ${captures.length - index}`;
    image.width = 160;
    image.height = 160;
    elements.gallery.appendChild(image);
  });
}

function friendlyError(error) {
  if (error && error.name === "NotAllowedError") return "Der Kamerazugriff wurde nicht erlaubt.";
  if (error && error.name === "NotFoundError") return "Es wurde keine Kamera gefunden.";
  if (error && error.name === "NotReadableError") return "Die Kamera wird bereits von einem anderen Programm verwendet.";
  return "Camera Kit konnte nicht starten. Prüfe Staging-Token, Lens Group und Trusted Origin.";
}

async function requestCamera(deviceId) {
  const video = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
  if (deviceId) video.deviceId = { exact: deviceId };

  return navigator.mediaDevices.getUserMedia({ video, audio: false });
}

async function attachStream(session, stream) {
  const track = stream.getVideoTracks()[0];
  const settings = track && track.getSettings ? track.getSettings() : {};
  const isBackCamera = settings.facingMode === "environment";
  const source = createMediaStreamSource(stream, {
    cameraType: isBackCamera ? "back" : "front",
  });

  await session.setSource(source);
  if (!isBackCamera) source.setTransform(Transform2D.MirrorX);
  return source;
}

async function fillCameraSelect() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const cameras = devices.filter((device) => device.kind === "videoinput");
  const currentTrack = runtime && runtime.stream && runtime.stream.getVideoTracks()[0];
  const currentId = currentTrack && currentTrack.getSettings().deviceId;

  elements.cameraSelect.replaceChildren();
  cameras.forEach((camera, index) => {
    const option = document.createElement("option");
    option.value = camera.deviceId;
    option.textContent = camera.label || `Kamera ${index + 1}`;
    option.selected = camera.deviceId === currentId;
    elements.cameraSelect.appendChild(option);
  });
  elements.cameraSelect.disabled = cameras.length < 2;
}

function renderLenses(lenses) {
  elements.lensCount.textContent = String(lenses.length);
  elements.lensList.replaceChildren();

  lenses.forEach((lens, index) => {
    const button = document.createElement("button");
    button.className = "ca-lens";
    button.type = "button";
    button.dataset.lensIndex = String(index);
    button.title = lens.name || `Lens ${index + 1}`;

    if (lens.iconUrl) {
      const image = document.createElement("img");
      image.src = lens.iconUrl;
      image.alt = "";
      image.loading = "lazy";
      button.appendChild(image);
    } else {
      const placeholder = document.createElement("span");
      placeholder.className = "ca-lens-placeholder";
      placeholder.textContent = "✦";
      button.appendChild(placeholder);
    }

    const name = document.createElement("span");
    name.textContent = lens.name || `Lens ${index + 1}`;
    button.appendChild(name);
    elements.lensList.appendChild(button);
  });
}

async function applyLens(index, runId) {
  if (!runtime || !runtime.lenses.length) return;
  const normalized = ((index % runtime.lenses.length) + runtime.lenses.length) % runtime.lenses.length;
  setStatus("Lens wird angewendet …");
  await runtime.session.applyLens(runtime.lenses[normalized]);
  if (runId !== lifecycle || !runtime) return;

  activeLensIndex = normalized;
  elements.lensList.querySelectorAll("button[data-lens-index]").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.lensIndex) === normalized);
  });
  setStatus(`${runtime.lenses[normalized].name || "Lens"} ist aktiv.`);
}

function randomLensIndex() {
  if (!runtime || runtime.lenses.length < 2) return 0;
  let next = activeLensIndex;
  while (next === activeLensIndex) next = Math.floor(Math.random() * runtime.lenses.length);
  return next;
}

function randomPrompt() {
  return POSE_PROMPTS[Math.floor(Math.random() * POSE_PROMPTS.length)];
}

function flashStage() {
  elements.flash.classList.remove("is-active");
  void elements.flash.offsetWidth;
  elements.flash.classList.add("is-active");
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (!canvas || !canvas.width || !canvas.height) {
      reject(new Error("Es ist noch kein Kamerabild verfügbar."));
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Der Schnappschuss konnte nicht erstellt werden."));
    }, "image/jpeg", 0.9);
  });
}

async function captureFrame() {
  if (!runtime) throw new Error("Die Kamera ist nicht aktiv.");
  flashStage();
  const blob = await canvasToBlob(runtime.session.output.capture);
  const entry = { blob, url: URL.createObjectURL(blob) };
  captures.push(entry);
  if (captures.length > 8) {
    const removed = captures.shift();
    URL.revokeObjectURL(removed.url);
  }
  renderGallery();
  return entry;
}

async function beginLab(runId) {
  cancelLoops();
  round = 0;
  score = 0;
  updateHud();
  elements.challenge.hidden = false;
  elements.modeLabel.textContent = "Lens-Labor";
  elements.challengeText.textContent = "Wähle rechts eine Lens und probiere sie aus";
  elements.timer.hidden = true;
  elements.freezeMeter.hidden = true;
  elements.shutterLabel.textContent = "Foto";
  elements.shutter.disabled = false;
  setLensButtonsDisabled(false);
  if (activeLensIndex < 0) await applyLens(0, runId);
  setStatus("Lens-Labor bereit. Schnappschüsse bleiben nur in diesem Tab.");
}

function runPoseTimer(runId, startTime) {
  const tick = (now) => {
    if (runId !== lifecycle || selectedMode !== "pose" || !runtime) return;
    remainingMs = Math.max(0, POSE_TIME_MS - (now - startTime));
    elements.timerValue.textContent = (remainingMs / 1000).toFixed(1);
    elements.timerBar.style.transform = `scaleX(${remainingMs / POSE_TIME_MS})`;

    if (remainingMs <= 0) {
      elements.shutter.disabled = true;
      setStatus("Zeit vorbei – nächste Aufgabe.");
      nextRoundTimer = window.setTimeout(() => beginPoseRound(runId), 700);
      return;
    }
    loopFrame = requestAnimationFrame(tick);
  };
  loopFrame = requestAnimationFrame(tick);
}

async function beginPoseRound(runId) {
  cancelLoops();
  if (runId !== lifecycle || selectedMode !== "pose" || !runtime) return;
  if (round >= POSE_ROUNDS) {
    await finishScoredMode("Pose-Blitz geschafft");
    return;
  }

  round += 1;
  updateHud();
  elements.challenge.hidden = false;
  elements.modeLabel.textContent = "Pose-Blitz";
  elements.challengeText.textContent = randomPrompt();
  elements.timer.hidden = false;
  elements.freezeMeter.hidden = true;
  elements.shutterLabel.textContent = "Auslösen";
  elements.shutter.disabled = true;
  setLensButtonsDisabled(true);

  await applyLens(randomLensIndex(), runId);
  if (runId !== lifecycle || selectedMode !== "pose" || !runtime) return;
  elements.shutter.disabled = false;
  remainingMs = POSE_TIME_MS;
  setStatus("Aufgabe läuft – je schneller das Foto, desto mehr Punkte.");
  runPoseTimer(runId, performance.now());
}

function runFreezeMeter(runId, startTime) {
  const tick = (now) => {
    if (runId !== lifecycle || selectedMode !== "freeze" || !runtime) return;
    const elapsed = now - startTime;
    remainingMs = Math.max(0, FREEZE_TIME_MS - elapsed);
    freezePosition = 50 + 49 * Math.sin(elapsed / 390);
    elements.freezeCursor.style.left = `${freezePosition}%`;
    elements.timerValue.textContent = (remainingMs / 1000).toFixed(1);
    elements.timerBar.style.transform = `scaleX(${remainingMs / FREEZE_TIME_MS})`;

    if (remainingMs <= 0) {
      elements.shutter.disabled = true;
      setStatus("Zu spät – nächste Runde.");
      nextRoundTimer = window.setTimeout(() => beginFreezeRound(runId), 700);
      return;
    }
    loopFrame = requestAnimationFrame(tick);
  };
  loopFrame = requestAnimationFrame(tick);
}

async function beginFreezeRound(runId) {
  cancelLoops();
  if (runId !== lifecycle || selectedMode !== "freeze" || !runtime) return;
  if (round >= FREEZE_ROUNDS) {
    await finishScoredMode("Freeze Frame beendet");
    return;
  }

  round += 1;
  updateHud();
  elements.challenge.hidden = false;
  elements.modeLabel.textContent = "Freeze Frame";
  elements.challengeText.textContent = "Löse aus, wenn der Lichtpunkt im grünen Feld ist";
  elements.timer.hidden = false;
  elements.freezeMeter.hidden = false;
  elements.shutterLabel.textContent = "Stopp!";
  elements.shutter.disabled = true;
  setLensButtonsDisabled(true);

  await applyLens(randomLensIndex(), runId);
  if (runId !== lifecycle || selectedMode !== "freeze" || !runtime) return;
  elements.shutter.disabled = false;
  remainingMs = FREEZE_TIME_MS;
  setStatus("Beobachte die Timing-Leiste.");
  runFreezeMeter(runId, performance.now());
}

async function startSelectedMode() {
  const runId = lifecycle;
  score = 0;
  round = 0;
  updateHud();

  if (selectedMode === "pose") await beginPoseRound(runId);
  else if (selectedMode === "freeze") await beginFreezeRound(runId);
  else await beginLab(runId);
}

async function finishScoredMode(title) {
  const finalScore = score;
  if (finalScore > readBest()) writeBest(finalScore);
  updateHud();
  await stopRuntime();

  elements.overlay.hidden = false;
  elements.overlayTitle.textContent = title;
  elements.overlayText.textContent = `${finalScore} Punkte · ${captures.length} Schnappschüsse. Die Bilder bleiben nur bis zum Neuladen in diesem Tab.`;
  elements.start.disabled = false;
  elements.start.textContent = "Noch einmal starten";
  setStatus("Kamera wurde beendet.");
}

async function stopRuntime() {
  lifecycle += 1;
  cancelLoops();
  elements.shutter.disabled = true;
  elements.stop.disabled = true;
  elements.cameraSelect.disabled = true;
  elements.timer.hidden = true;
  elements.freezeMeter.hidden = true;
  setModesDisabled(false);

  const oldRuntime = runtime;
  runtime = null;
  if (oldRuntime && oldRuntime.stream) {
    oldRuntime.stream.getTracks().forEach((track) => track.stop());
  }
  if (oldRuntime && oldRuntime.cameraKit && typeof oldRuntime.cameraKit.destroy === "function") {
    try {
      await oldRuntime.cameraKit.destroy();
    } catch (error) {
      // Aufräumen darf das Menü nicht blockieren.
    }
  }
  setLive(false);
}

async function start(config) {
  if (isStarting || runtime) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Dieser Browser unterstützt keinen Kamerazugriff.");
  }

  isStarting = true;
  lifecycle += 1;
  const runId = lifecycle;
  elements.overlay.hidden = false;
  elements.overlayTitle.textContent = "Camera Kit wird vorbereitet";
  elements.overlayText.textContent = "SDK, Kamera und Demo-Lenses werden geladen …";
  setStatus("Camera Kit wird geladen …");
  setModesDisabled(true);

  let cameraKit;
  let stream;
  try {
    cameraKit = await bootstrapCameraKit({ apiToken: config.apiToken, logger: "noop" });
    const session = await cameraKit.createSession({ liveRenderTarget: elements.canvas });
    session.events.addEventListener("error", (event) => {
      const message = event && event.detail && event.detail.error && event.detail.error.message;
      setStatus(message ? `Lens-Fehler: ${message}` : "Eine Lens wurde wegen eines Fehlers entfernt.");
    });

    stream = await requestCamera();
    await attachStream(session, stream);
    await session.play();

    const groupResult = await cameraKit.lensRepository.loadLensGroups([config.lensGroupId]);
    const lenses = groupResult && Array.isArray(groupResult.lenses) ? groupResult.lenses : [];
    if (!lenses.length) throw new Error("In der Demo Lens Group wurden keine Lenses gefunden.");
    if (runId !== lifecycle) return;

    runtime = { cameraKit, session, stream, lenses };
    renderLenses(lenses);
    await fillCameraSelect();
    setLive(true);
    elements.overlay.hidden = true;
    elements.stop.disabled = false;
    setModesDisabled(false);
    await startSelectedMode();
  } catch (error) {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (cameraKit && typeof cameraKit.destroy === "function") {
      try { await cameraKit.destroy(); } catch (destroyError) { /* nichts weiter */ }
    }
    runtime = null;
    setLive(false);
    setModesDisabled(false);
    elements.overlay.hidden = false;
    elements.overlayTitle.textContent = "Camera Kit konnte nicht starten";
    elements.overlayText.textContent = error && error.message && error.message.includes("Demo Lens Group")
      ? error.message
      : friendlyError(error);
    throw error;
  } finally {
    isStarting = false;
  }
}

async function onShutter() {
  if (!runtime || elements.shutter.disabled) return;
  elements.shutter.disabled = true;
  const runId = lifecycle;
  cancelLoops();

  try {
    await captureFrame();
    if (runId !== lifecycle) return;

    if (selectedMode === "pose") {
      const gained = 100 + Math.round((remainingMs / POSE_TIME_MS) * 300);
      score += gained;
      updateHud();
      setStatus(`+${gained} Punkte – starke Reaktion!`);
      nextRoundTimer = window.setTimeout(() => beginPoseRound(runId), 750);
    } else if (selectedMode === "freeze") {
      const distance = Math.abs(freezePosition - 50);
      const gained = Math.max(50, Math.round(500 - distance * 12));
      score += gained;
      updateHud();
      setStatus(distance <= 7 ? `Perfektes Timing: +${gained}` : `+${gained} Punkte`);
      nextRoundTimer = window.setTimeout(() => beginFreezeRound(runId), 750);
    } else {
      setStatus("Schnappschuss im Sitzungsspeicher hinzugefügt.");
      elements.shutter.disabled = false;
    }
  } catch (error) {
    setStatus(error && error.message ? error.message : "Schnappschuss fehlgeschlagen.");
    elements.shutter.disabled = false;
  }
}

async function switchCamera(deviceId) {
  if (!runtime || !deviceId) return;
  elements.cameraSelect.disabled = true;
  elements.shutter.disabled = true;
  setStatus("Kamera wird gewechselt …");

  let newStream;
  try {
    newStream = await requestCamera(deviceId);
    const oldStream = runtime.stream;
    runtime.session.pause();
    await attachStream(runtime.session, newStream);
    runtime.stream = newStream;
    oldStream.getTracks().forEach((track) => track.stop());
    await runtime.session.play();
    await fillCameraSelect();
    elements.shutter.disabled = false;
    setStatus("Kamera gewechselt.");
  } catch (error) {
    if (newStream) newStream.getTracks().forEach((track) => track.stop());
    if (runtime) await runtime.session.play();
    elements.cameraSelect.disabled = false;
    elements.shutter.disabled = false;
    setStatus("Kamera konnte nicht gewechselt werden.");
  }
}

elements.best.textContent = String(readBest());
renderGallery();
updateHud();

elements.modeList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-mode]");
  if (!button || button.disabled) return;
  const mode = button.dataset.mode;
  if (!mode || mode === selectedMode) return;

  lifecycle += 1;
  cancelLoops();
  setModeVisual(mode);
  if (runtime) await startSelectedMode();
});

elements.lensList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-lens-index]");
  if (!button || button.disabled || selectedMode !== "lab" || !runtime) return;
  elements.shutter.disabled = true;
  const runId = lifecycle;
  try {
    await applyLens(Number(button.dataset.lensIndex), runId);
  } finally {
    if (runtime && runId === lifecycle) elements.shutter.disabled = false;
  }
});

elements.shutter.addEventListener("click", onShutter);
elements.cameraSelect.addEventListener("change", () => switchCamera(elements.cameraSelect.value));
elements.stop.addEventListener("click", async () => {
  await stopRuntime();
  elements.overlay.hidden = false;
  elements.overlayTitle.textContent = "Arcade beendet";
  elements.overlayText.textContent = "Die Kamera ist aus und alle Camera-Kit-Ressourcen wurden freigegeben.";
  elements.start.disabled = false;
  elements.start.textContent = "Camera Arcade starten";
  setStatus("Camera Kit ist beendet.");
});

export { destroy, start };

async function destroy() {
  await stopRuntime();
  clearCaptureUrls();
}
