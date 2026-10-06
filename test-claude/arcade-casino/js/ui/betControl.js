// Einheitliche Einsatzsteuerung (− Wert +) für alle Spiele.
import { h } from "./dom.js";
import { fmt } from "./format.js";
import { play } from "../audio/audio.js";
import { haptic } from "../audio/feedback.js";

/**
 * @param {{steps:number[], value:number, label?:string, onChange?:(v:number)=>void, getBalance:()=>number}} o
 */
export function createBetControl({ steps, value, label = "Einsatz", onChange, getBalance }) {
  let idx = Math.max(0, steps.indexOf(value));
  if (steps.indexOf(value) < 0) {
    // nächstkleineren gültigen Wert wählen
    idx = 0;
    steps.forEach((s, i) => {
      if (s <= value) idx = i;
    });
  }
  let disabled = false;
  const minus = h("button.btn.btn-icon", { type: "button", "aria-label": `${label} verringern` }, "−");
  const plus = h("button.btn.btn-icon", { type: "button", "aria-label": `${label} erhöhen` }, "+");
  const val = h("strong.num");
  const box = h("div.bet-value", { role: "status", "aria-live": "polite" }, h("small", {}, label), val);
  const el = h("div.bet-control", {}, minus, box, plus);

  function render() {
    const v = steps[idx];
    val.textContent = fmt(v);
    const tooHigh = v > getBalance();
    val.style.color = tooHigh ? "var(--red)" : "";
    minus.disabled = disabled || idx === 0;
    plus.disabled = disabled || idx === steps.length - 1;
  }

  function change(d) {
    if (disabled) return;
    const next = Math.min(steps.length - 1, Math.max(0, idx + d));
    if (next === idx) return;
    idx = next;
    play("chip", { pitch: 0.9 + idx * 0.03 });
    haptic("tick");
    render();
    onChange?.(steps[idx]);
  }

  minus.addEventListener("click", () => change(-1));
  plus.addEventListener("click", () => change(1));
  render();

  return {
    el,
    get value() {
      return steps[idx];
    },
    set(v) {
      const i = steps.indexOf(v);
      if (i >= 0) {
        idx = i;
        render();
      }
    },
    setDisabled(v) {
      disabled = v;
      render();
    },
    refresh: render,
    /** Senkt den Einsatz auf den höchsten bezahlbaren Wert (z. B. nach Verlust). */
    fitToBalance() {
      const b = getBalance();
      while (idx > 0 && steps[idx] > b) idx--;
      render();
      return steps[idx];
    },
  };
}
