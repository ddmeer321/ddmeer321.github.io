import { appendTestLog } from "./test-logger.js?v=testlogs1";

export function createFPSCounter() {
  let lastTime = performance.now();
  let frames = 0;
  let fps = 0;
  let lastLowFpsLog = 0;

  const el = document.createElement("div");
  el.id = "fpsCounter";
  el.style.position = "fixed";
  el.style.top = "10px";
  el.style.right = "10px";
  el.style.padding = "6px 10px";
  el.style.background = "rgba(0,0,0,0.78)";
  el.style.color = "#b7ff4a";
  el.style.fontFamily = "monospace";
  el.style.fontSize = "14px";
  el.style.fontWeight = "800";
  el.style.zIndex = "2147483647";
  el.style.borderRadius = "6px";
  el.style.border = "1px solid rgba(183,255,74,0.45)";
  el.style.pointerEvents = "none";
  el.style.userSelect = "none";
  el.textContent = "FPS: ...";

  document.body.appendChild(el);

  function update() {
    frames++;
    const now = performance.now();

    if (now - lastTime >= 1000) {
      fps = frames;
      frames = 0;
      lastTime = now;
      el.textContent = `FPS: ${fps}`;
      if (fps < 35 && now - lastLowFpsLog >= 15000) {
        lastLowFpsLog = now;
        appendTestLog("low_fps", { fps });
      }
    }

    requestAnimationFrame(update);
  }

  update();

  return {
    getFPS: () => fps
  };
}
