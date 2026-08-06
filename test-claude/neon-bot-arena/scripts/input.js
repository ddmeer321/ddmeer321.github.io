export function setupInput({ dom, state, startGame, togglePause, useSpecial }) {
  document.querySelectorAll(".device-btn[data-device]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".device-btn[data-device]").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      state.device = button.dataset.device;
    });
  });

  document.querySelectorAll(".difficulty-btn[data-difficulty]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".difficulty-btn[data-difficulty]").forEach((item) => item.classList.remove("selected"));
      button.classList.add("selected");
      state.difficulty = button.dataset.difficulty || "normal";
    });
  });


  dom.playerNameInput?.addEventListener("keydown", (event) => event.stopPropagation());
  dom.playerNameInput?.addEventListener("keyup", (event) => event.stopPropagation());
  dom.startBtn.addEventListener("click", startGame);
  dom.pauseBtn.addEventListener("click", togglePause);

  window.addEventListener("keydown", (event) => {
    if (isTyping(event.target)) return;
    if (!state.running && event.code !== "Escape") return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space"].includes(event.code)) event.preventDefault();
    state.keys.add(event.code);
    if (event.code === "KeyP" || event.code === "Escape") togglePause();
    if (event.code === "Space" && !state.player?.dead) useSpecial();
  });

  window.addEventListener("keyup", (event) => {
    if (isTyping(event.target)) return;
    if (!state.running) return;
    state.keys.delete(event.code);
  });

  dom.canvas.addEventListener("pointermove", (event) => updatePointer(event, dom, state));
  dom.canvas.addEventListener("pointerdown", (event) => {
    if (state.device === "mobile") return;
    updatePointer(event, dom, state);
    state.mouse.down = true;
  });
  window.addEventListener("pointerup", () => {
    state.mouse.down = false;
  });

  addTouchGuard(dom.gamePanel);
  addTouchGuard(dom.touchControls);
  addTouchGuard(dom.touchFire);
  addTouchGuard(dom.touchSpecial);
  addTouchGuard(dom.touchStick);

  dom.touchSpecial?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (!state.player?.dead) useSpecial();
  });
  dom.touchFire?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    state.touch.fire = true;
  });
  dom.touchFire?.addEventListener("pointerup", () => {
    state.touch.fire = false;
  });
  dom.touchFire?.addEventListener("pointercancel", () => {
    state.touch.fire = false;
  });
  dom.touchStick?.addEventListener("pointerdown", (event) => startTouchMove(event, dom, state));
  dom.touchStick?.addEventListener("pointermove", (event) => updateTouchMove(event, dom, state));
  dom.touchStick?.addEventListener("pointerup", (event) => stopTouchMove(event, dom, state));
  dom.touchStick?.addEventListener("pointercancel", (event) => stopTouchMove(event, dom, state));
}


function addTouchGuard(element) {
  if (!element) return;
  element.addEventListener("touchstart", (event) => {
    if (event.target.closest("button, input, textarea, .message")) return;
    event.preventDefault();
  }, { passive: false });
  element.addEventListener("contextmenu", (event) => {
    if (event.target.closest("button, input, textarea, .message")) return;
    event.preventDefault();
  });
  element.addEventListener("gesturestart", (event) => event.preventDefault());
}

function updatePointer(event, dom, state) {
  if (state.device === "mobile") return;
  const rect = dom.canvas.getBoundingClientRect();
  state.mouse.x = ((event.clientX - rect.left) / rect.width) * dom.canvas.width;
  state.mouse.y = ((event.clientY - rect.top) / rect.height) * dom.canvas.height;
}

function startTouchMove(event, dom, state) {
  event.preventDefault();
  state.touch.stickPointer = event.pointerId;
  dom.touchStick.setPointerCapture(event.pointerId);
  updateTouchMove(event, dom, state);
}

function updateTouchMove(event, dom, state) {
  if (state.touch.stickPointer !== event.pointerId) return;
  const rect = dom.touchStick.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const rawX = event.clientX - centerX;
  const rawY = event.clientY - centerY;
  const length = Math.hypot(rawX, rawY);
  const max = rect.width * 0.34;
  const limited = Math.min(length, max);
  const angle = Math.atan2(rawY, rawX);
  const knobX = Math.cos(angle) * limited;
  const knobY = Math.sin(angle) * limited;
  state.touch.moveX = length > 8 ? knobX / max : 0;
  state.touch.moveY = length > 8 ? knobY / max : 0;
  dom.touchKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;
}

function stopTouchMove(event, dom, state) {
  if (state.touch.stickPointer !== event.pointerId) return;
  state.touch.stickPointer = null;
  state.touch.moveX = 0;
  state.touch.moveY = 0;
  dom.touchKnob.style.transform = "translate(-50%, -50%)";
}

function isTyping(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
}
