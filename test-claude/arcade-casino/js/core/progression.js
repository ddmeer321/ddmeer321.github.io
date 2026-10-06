// Leichte Progression: XP, Level, Achievements, Bestwerte, Themes.
// Progression blockiert keine Spiele – alle Automaten sind ab Level 1 spielbar.
// Freischaltbar sind nur kosmetische Hallen-Themes und Level-Boni.

export const ACHIEVEMENTS = [
  { id: "first-win", icon: "🎉", title: "Erster Gewinn", desc: "Gewinne irgendeine Runde." },
  { id: "bj-natural", icon: "🂡", title: "Natural", desc: "Erhalte einen Blackjack." },
  { id: "bj-split-win", icon: "✂️", title: "Doppelt hält besser", desc: "Gewinne beide Hände nach einem Split." },
  { id: "bj-double-win", icon: "⏫", title: "Mutig verdoppelt", desc: "Gewinne nach Double Down." },
  { id: "roulette-straight", icon: "🎯", title: "Volltreffer", desc: "Treffe eine einzelne Zahl beim Roulette." },
  { id: "slots-big", icon: "🎰", title: "Walzenkönig", desc: "Gewinne mindestens das 20-Fache des Einsatzes an einem Slot." },
  { id: "slots-all", icon: "🍒", title: "Slot-Tourist", desc: "Spiele alle drei Slotmaschinen." },
  { id: "slots-free", icon: "🌠", title: "Sternschnuppe", desc: "Löse Freispiele bei Kosmo 5 aus." },
  { id: "pusher-50", icon: "🪙", title: "Kantenschubser", desc: "Schiebe insgesamt 50 Münzen über die Kante." },
  { id: "pusher-gold", icon: "⭐", title: "Goldrausch", desc: "Schiebe eine Goldmünze über die Kante." },
  { id: "hoops-10", icon: "🏀", title: "Korbjäger", desc: "Triff 10 Körbe in einer Runde." },
  { id: "hoops-combo", icon: "🔥", title: "On Fire", desc: "Erreiche eine Serie von 5 Treffern." },
  { id: "stacker-top", icon: "🧱", title: "Bis unters Dach", desc: "Baue den Stapler bis ganz nach oben." },
  { id: "cyclone-jackpot", icon: "🌀", title: "Auge des Sturms", desc: "Stoppe das Licht auf dem Jackpot-Feld." },
  { id: "high-roller", icon: "💎", title: "High Roller", desc: "Setze 500 Credits oder mehr in einer Runde." },
  { id: "rich", icon: "💰", title: "Neonmillionär (fast)", desc: "Besitze 10.000 Credits." },
  { id: "explorer", icon: "🗺️", title: "Entdecker", desc: "Spiele jedes Spiel der Halle mindestens einmal." },
  { id: "level-5", icon: "⭐", title: "Stammgast", desc: "Erreiche Level 5." },
  { id: "level-10", icon: "👑", title: "VIP", desc: "Erreiche Level 10." },
];

export const THEME_UNLOCKS = [
  { id: "neon", name: "Neon", level: 1 },
  { id: "sunset", name: "Sonnenuntergang", level: 3 },
  { id: "ocean", name: "Tiefsee", level: 5 },
  { id: "jungle", name: "Dschungel", level: 8 },
  { id: "royal", name: "Royal", level: 12 },
];

/** XP, die man von Level n auf n+1 braucht. */
export function xpForLevel(level) {
  return Math.round(120 * Math.pow(level, 1.35));
}

/** Level-Info aus Gesamt-XP. */
export function levelInfo(totalXp) {
  let level = 1;
  let rest = Math.max(0, Math.floor(totalXp) || 0);
  while (level < 99 && rest >= xpForLevel(level)) {
    rest -= xpForLevel(level);
    level++;
  }
  const need = xpForLevel(level);
  return { level, into: rest, need, progress: Math.min(1, rest / need) };
}

/** XP für eine abgerechnete Runde (Grundwert + Anteil am Einsatz, gedeckelt). */
export function xpForRound(stake) {
  return 4 + Math.min(60, Math.floor(stake / 10));
}

export function levelReward(level) {
  return 100 * level;
}

export function createProgression({ getState, save, emit }) {
  function award(id) {
    const s = getState();
    if (s.achievements[id]) return false;
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (!def) return false;
    s.achievements[id] = Date.now();
    save();
    emit("achievement", def);
    return true;
  }

  function addXp(amount) {
    const n = Math.max(0, Math.floor(amount) || 0);
    if (!n) return;
    const s = getState();
    const before = levelInfo(s.xp).level;
    s.xp += n;
    const info = levelInfo(s.xp);
    save();
    emit("xp", { ...info, gained: n });
    for (let lv = before + 1; lv <= info.level; lv++) {
      emit("levelup", { level: lv, reward: levelReward(lv), themes: THEME_UNLOCKS.filter((t) => t.level === lv) });
      if (lv >= 5) award("level-5");
      if (lv >= 10) award("level-10");
    }
  }

  function bump(counter, by = 1) {
    const s = getState();
    s.counters[counter] = (s.counters[counter] || 0) + by;
    save();
    return s.counters[counter];
  }

  function setBest(key, value) {
    const s = getState();
    const v = Math.max(0, Math.floor(value) || 0);
    if (v > (s.bests[key] || 0)) {
      s.bests[key] = v;
      save();
      return true;
    }
    return false;
  }

  return {
    award,
    addXp,
    bump,
    setBest,
    best: (key) => getState().bests[key] || 0,
    has: (id) => Boolean(getState().achievements[id]),
    info: () => levelInfo(getState().xp),
    unlockedThemes: () => THEME_UNLOCKS.filter((t) => t.level <= levelInfo(getState().xp).level),
  };
}
