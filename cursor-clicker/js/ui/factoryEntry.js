import { state } from "../core/state.js";
import { events } from "../core/events.js";
import { unlockFactory } from "../core/factoryModel.js";
import { saveGame, navigateWithSave } from "../core/save.js";

export function initFactoryEntry() {
  const link = document.getElementById("factory-entry");
  function update() {
    if (unlockFactory(state)) saveGame();
    link.hidden = !state.factory.unlocked;
  }
  events.on("state:changed", update);
  link.addEventListener("click", e => {
    e.preventDefault();
    if (!state.factory.unlocked) return;
    link.setAttribute("aria-busy", "true");
    navigateWithSave(link.href);
  });
  update();
}
