// Lädt Spiel-Stylesheets erst bei Bedarf (einmalig).
const loaded = new Map();

export function ensureCss(name) {
  if (loaded.has(name)) return loaded.get(name);
  const p = new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `css/${name}.css?v=3`;
    link.onload = () => resolve();
    link.onerror = () => {
      console.warn(`[css] ${name}.css konnte nicht geladen werden`);
      resolve();
    };
    document.head.append(link);
  });
  loaded.set(name, p);
  return p;
}
