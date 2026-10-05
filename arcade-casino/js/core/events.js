// Minimaler Event-Emitter für lose Kopplung zwischen Systemen (Economy → HUD usw.).

export function createEmitter() {
  const handlers = new Map();
  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type)?.delete(fn);
    },
    emit(type, payload) {
      const set = handlers.get(type);
      if (!set) return;
      for (const fn of [...set]) {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[events] Handler für "${type}" ist fehlgeschlagen`, err);
        }
      }
    },
  };
}

// Globaler Bus der App.
export const bus = createEmitter();
