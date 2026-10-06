// Both pages own the SAME local save. Prevent stale tabs from overwriting it.
let writable = false;
export const canWriteGame = () => writable;
export async function startGameSession(onLeave) {
  const lockName = location.pathname.includes("/test-claude/") ? "cursorClicker.test" : "cursorClicker.live";
  let release;
  const granted = await new Promise(resolve => {
    if (!navigator.locks) { resolve(false); return; }
    navigator.locks.request(lockName, { ifAvailable: true }, async lock => {
      if (!lock) { resolve(false); return; }
      writable = true;
      resolve(true);
      await new Promise(done => { release = done; });
    }).catch(() => resolve(false));
  });
  if (!granted) {
    document.body.innerHTML = '<main style="max-width:560px;margin:12vh auto;padding:24px;color:#eee;background:#181726;border-radius:20px;font:16px/1.6 system-ui"><h1>Spielstand geschützt</h1><p>Cursor Clicker oder die Fabrik ist bereits in einem anderen Tab geöffnet. Schließe diesen Tab zuerst und lade diese Seite neu.</p><p>Zum Spielen benötigst du einen aktuellen Browser und HTTPS oder localhost.</p><button id="retry-session" style="padding:12px 20px">Erneut versuchen</button></main>';
    document.getElementById("retry-session").onclick = () => location.reload();
    return false;
  }
  window.addEventListener("pagehide", () => {
    if (!writable) return;
    onLeave();
    writable = false;
    release?.();
  });
  window.addEventListener("pageshow", e => { if (e.persisted) location.reload(); });
  return true;
}
