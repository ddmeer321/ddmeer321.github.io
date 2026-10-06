// Ein-Tab-Sperre gegen Race Conditions zwischen mehreren Tabs.
// Zwei gleichzeitig offene Tabs würden sich gegenseitig das Guthaben
// überschreiben. Deshalb ist immer nur der zuletzt aktivierte Tab „aktiv“ und
// darf speichern; der andere zeigt einen Hinweis mit „Hier weiterspielen“.

const LOCK_KEY = "neonpalast.activeTab";

export function createTabLock({ onLost }) {
  const myId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let owner = true;

  function claim() {
    owner = true;
    try {
      window.localStorage.setItem(LOCK_KEY, JSON.stringify({ id: myId, t: Date.now() }));
    } catch {
      /* ohne localStorage gibt es auch keine Tab-übergreifenden Konflikte */
    }
  }

  function onStorage(e) {
    if (e.key !== LOCK_KEY || !e.newValue) return;
    try {
      const data = JSON.parse(e.newValue);
      if (data && data.id !== myId && owner) {
        owner = false;
        onLost();
      }
    } catch {
      /* ignorieren */
    }
  }

  window.addEventListener("storage", onStorage);
  claim();

  return {
    isOwner: () => owner,
    claim,
  };
}
