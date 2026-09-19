// Meldet den Service Worker an. Mehr nicht.
//
// Bewusst KEIN eigener "Jetzt installieren"-Knopf: Auf dem iPhone gibt es
// die noetige Browser-Schnittstelle gar nicht (dort laeuft es ueber Teilen ->
// Zum Home-Bildschirm), ein Knopf waere also auf der Haelfte der Geraete
// eine Luege. Der Browser bietet es von selbst an, wenn er so weit ist.
(function () {
  if (!("serviceWorker" in navigator)) return;
  // Nur auf dem oeffentlichen Teil. Die Testbereiche haben eigene Regeln,
  // und der Service Worker laesst sie ohnehin in Ruhe.
  var p = location.pathname;
  if (p.indexOf("/test-claude/") === 0 || p.indexOf("/test-chatgpt/") === 0 ||
      p.indexOf("/admin/") === 0) return;

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {
      // Kein Grund, jemanden zu behelligen: Ohne Service Worker funktioniert
      // die Seite genau wie vorher, nur ohne Offline-Vorrat.
    });
  });
})();
