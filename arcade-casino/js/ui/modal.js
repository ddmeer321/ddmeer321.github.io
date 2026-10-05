// Dialoge. Nur einer gleichzeitig; Escape und Klick auf den Hintergrund schließen.
import { h, clear } from "./dom.js";
import { play } from "../audio/audio.js";

let layer = null;
let current = null;

export function initModal(el) {
  layer = el;
  layer.addEventListener("click", (e) => {
    if (e.target === layer && current?.dismissible) closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && current?.dismissible) closeModal();
  });
}

export function isModalOpen() {
  return Boolean(current);
}

/**
 * @param {{title: string, body: Node|Node[], actions?: {label:string, cls?:string, onClick?:Function, keepOpen?:boolean}[], dismissible?: boolean, onClose?: Function}} o
 */
export function openModal({ title, body, actions = [], dismissible = true, onClose }) {
  if (!layer) return;
  if (current) closeModal(true);
  clear(layer);
  const box = h(
    "div.modal",
    { role: "dialog", "aria-modal": "true", "aria-label": title },
    dismissible ? h("button.btn.btn-ghost.btn-icon.btn-sm.modal-close", { "aria-label": "Schließen", onclick: () => closeModal() }, "✕") : null,
    h("h2.neon-title", {}, title),
    body,
    actions.length
      ? h(
          "div.modal-actions",
          {},
          actions.map((a) =>
            h(`button.btn${a.cls ? "." + a.cls.split(" ").join(".") : ""}`, {
              onclick: () => {
                play("ui.tap");
                a.onClick?.();
                if (!a.keepOpen) closeModal();
              },
            }, a.label)
          )
        )
      : null
  );
  layer.append(box);
  layer.classList.add("is-open");
  current = { dismissible, onClose };
  play("ui.open");
  const focusable = box.querySelector(".modal-actions .btn, .btn");
  focusable?.focus({ preventScroll: true });
}

export function closeModal(silent = false) {
  if (!current || !layer) return;
  const cb = current.onClose;
  current = null;
  layer.classList.remove("is-open");
  clear(layer);
  if (!silent) play("ui.back");
  cb?.();
}
