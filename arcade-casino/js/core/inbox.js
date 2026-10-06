// Posteingang – kleine, generische Nachrichten-Infrastruktur (V1.2).
//
// Eine Nachricht: { id, type, ts, title, body, read, payload, action }
//   id      stabile, eindeutige Kennung (z. B. „lotto:daily-2026-10-06“) –
//           dieselbe id wird nie zweimal angelegt (keine Duplikate)
//   type    z. B. „lotto“ – bestimmt, wer die Aktion ausführt
//   action  { label, kind } – Text des Knopfes und was er auslöst
// Die Nachrichten verraten bewusst nichts, was der Spieler selbst entdecken
// soll (z. B. ob eine Lotto-Ziehung gewonnen wurde).

export const INBOX_MAX = 60;

export function defaultInbox() {
  return { items: [] };
}

const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

export function sanitizeInbox(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const seen = new Set();
  const items = [];
  for (const m of Array.isArray(src.items) ? src.items : []) {
    if (!m || typeof m !== "object") continue;
    const id = str(m.id, 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const action = m.action && typeof m.action === "object" ? { label: str(m.action.label, 40), kind: str(m.action.kind, 40) } : null;
    items.push({
      id,
      type: str(m.type, 24) || "info",
      ts: Number.isFinite(m.ts) ? Math.max(0, Math.trunc(m.ts)) : 0,
      title: str(m.title, 120),
      body: str(m.body, 400),
      read: m.read === true,
      payload: m.payload && typeof m.payload === "object" && !Array.isArray(m.payload) ? JSON.parse(JSON.stringify(m.payload)) : {},
      action: action && action.label ? action : null,
    });
  }
  items.sort((a, b) => b.ts - a.ts);
  return { items: items.slice(0, INBOX_MAX) };
}

/**
 * @param {{getState:()=>object, save:()=>void, emit?:(ev:string,d?:any)=>void}} o
 */
export function createInbox({ getState, save, emit = () => {} }) {
  const box = () => {
    const s = getState();
    if (!s.inbox || !Array.isArray(s.inbox.items)) s.inbox = defaultInbox();
    return s.inbox;
  };
  const changed = () => {
    save();
    emit("inbox:change", api.unreadCount());
  };
  const api = {
    list() {
      return box().items.slice();
    },
    get(id) {
      return box().items.find((m) => m.id === id) || null;
    },
    has(id) {
      return Boolean(api.get(id));
    },
    /** Legt eine Nachricht an. Existiert die id schon, passiert nichts (false). */
    add(msg) {
      if (!msg || !msg.id || api.has(msg.id)) return false;
      const clean = sanitizeInbox({ items: [{ ts: Date.now(), read: false, payload: {}, ...msg }] }).items[0];
      if (!clean) return false;
      const b = box();
      b.items.unshift(clean);
      b.items.sort((a, c) => c.ts - a.ts);
      if (b.items.length > INBOX_MAX) b.items.length = INBOX_MAX;
      changed();
      return true;
    },
    markRead(id) {
      const m = api.get(id);
      if (!m || m.read) return false;
      m.read = true;
      changed();
      return true;
    },
    remove(id) {
      const b = box();
      const i = b.items.findIndex((m) => m.id === id);
      if (i < 0) return false;
      b.items.splice(i, 1);
      changed();
      return true;
    },
    unreadCount() {
      return box().items.filter((m) => !m.read).length;
    },
  };
  return api;
}
