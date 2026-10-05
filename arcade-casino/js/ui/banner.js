// Großes Ergebnis-Banner mitten über einem Spiel („GEWONNEN +200“).
import { h } from "./dom.js";

export function showBanner(container, { title, sub = "", tone = "win", ms = 1800 }) {
  const old = container.querySelector(".result-banner");
  if (old) old.remove();
  const el = h(`div.result-banner.tone-${tone}`, { role: "status", "aria-live": "polite" }, h("span.rb-title", {}, title), sub ? h("span.rb-sub.num", {}, sub) : null);
  container.append(el);
  let t2 = 0;
  const t1 = setTimeout(() => {
    el.classList.add("is-leaving");
    t2 = setTimeout(() => el.remove(), 280);
  }, ms);
  return () => {
    clearTimeout(t1);
    clearTimeout(t2);
    el.remove();
  };
}
