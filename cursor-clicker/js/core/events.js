// Zentraler Event-Bus. Core-Module melden Ereignisse, UI-Module (und spätere
// Systeme wie Quests, Trading oder Leaderboards) hören zu, statt sich gegenseitig
// direkt aufzurufen. So bleiben Spiellogik und Darstellung entkoppelt.
function createEventBus() {
  const listeners = new Map();

  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => listeners.get(event)?.delete(handler);
    },
    emit(event, payload) {
      const handlers = listeners.get(event);
      if (!handlers) return;
      for (const handler of handlers) handler(payload);
    },
  };
}

export const events = createEventBus();
