// Kurze Hinweise oben am Bildschirm.
import { h } from "./dom.js";

let layer = null;
const MAX = 3;

export function initToasts(el) {
  layer = el;
}

export function toast(text, { icon = "", tone = "", ms = 2600, action = null } = {}) {
  if (!layer) return;
  while (layer.children.length >= MAX) layer.firstChild.remove();
  const btn = action
    ? h("button.btn.btn-sm.btn-primary.toast-action", {
        type: "button",
        onclick: () => {
          el.remove();
          action.onClick();
        },
      }, action.label)
    : null;
  const el = h(`div.toast${tone ? ".tone-" + tone : ""}${action ? ".has-action" : ""}`, { role: "status" }, icon ? h("span.toast-ico", {}, icon) : null, h("span", {}, text), btn);
  layer.append(el);
  setTimeout(() => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 260);
  }, ms);
}
