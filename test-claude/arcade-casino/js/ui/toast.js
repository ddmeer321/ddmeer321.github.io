// Kurze Hinweise oben am Bildschirm.
import { h } from "./dom.js";

let layer = null;
const MAX = 3;

export function initToasts(el) {
  layer = el;
}

export function toast(text, { icon = "", tone = "", ms = 2600 } = {}) {
  if (!layer) return;
  while (layer.children.length >= MAX) layer.firstChild.remove();
  const el = h(`div.toast${tone ? ".tone-" + tone : ""}`, { role: "status" }, icon ? h("span.toast-ico", {}, icon) : null, h("span", {}, text));
  layer.append(el);
  setTimeout(() => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 260);
  }, ms);
}
