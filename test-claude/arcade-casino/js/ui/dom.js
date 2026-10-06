// Kleiner DOM-Helfer: h("button.btn.btn-primary", { onclick }, "Text")

export function h(spec, props = {}, ...children) {
  const [tag, ...classes] = spec.split(".");
  const el = document.createElement(tag || "div");
  if (classes.length) el.className = classes.join(" ");
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className += (el.className ? " " : "") + v;
    else if (k === "style" && typeof v === "object") {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith("--")) el.style.setProperty(sk, String(sv));
        else el.style[sk] = sv;
      }
    }
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k === "html") el.innerHTML = v;
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

/** pointerdown-basierter Tap mit sofortigem Feedback, aber Auslösung beim click. */
export function onTap(el, fn) {
  el.addEventListener("click", fn);
}
