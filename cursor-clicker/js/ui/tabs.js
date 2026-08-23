// Tab-Navigation zwischen den Hauptbereichen (Home/Boxen/Inventar/...).
export function initTabs() {
  const tabs = document.querySelectorAll(".cc-tab");
  const panels = document.querySelectorAll(".cc-panel");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetId = "tab-" + tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      panels.forEach((panel) => panel.classList.toggle("hidden", panel.id !== targetId));
    });
  });
}
