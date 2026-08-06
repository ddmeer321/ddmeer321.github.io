// Kleine, sich selbst entfernende Benachrichtigungen (z.B. Achievement freigeschaltet).
import { state } from "../core/state.js";

export function showToast(message, variant = "default") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "cc-toast cc-toast-" + variant;
  toast.textContent = message;
  container.appendChild(toast);

  const lifetime = state.settings.animations ? 3600 : 2200;
  requestAnimationFrame(() => toast.classList.add("cc-toast-visible"));
  setTimeout(() => {
    toast.classList.remove("cc-toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, lifetime);
}
