const STORAGE_KEY = "neon-bot-arena-test-ad-rewards-v2";
const DAILY_REWARDS = [25, 50, 100, 125, 150, 200, 250, 300];
const DAILY_LIMIT = DAILY_REWARDS.length;
const DURATION_MS = 30_000;

const translations = {
  de: {
    title: "Testwerbung",
    hint: "Bis zu 8 Testwerbungen täglich. Die Belohnung steigt nach jeder Werbung.",
    button: "Testwerbung ansehen – {reward} Münzen",
    remaining: "{remaining} von 8 heute verfügbar",
    limit: "Tageslimit erreicht",
    dialogTitle: "Simulierte Testwerbung",
    dialogHint: "Keine echte Werbung · Countdown pausiert, wenn du den Tab verlässt.",
    countdown: "Belohnung in {seconds} Sekunden",
    cancel: "Abbrechen",
    rewarded: "{reward} Münzen wurden gutgeschrieben.",
    canceled: "Testwerbung abgebrochen – keine Münzen erhalten."
  },
  en: {
    title: "Test ad",
    hint: "Up to 8 test ads daily. The reward increases after every ad.",
    button: "Watch test ad – {reward} coins",
    remaining: "{remaining} of 8 available today",
    limit: "Daily limit reached",
    dialogTitle: "Simulated test ad",
    dialogHint: "Not a real ad · The countdown pauses when you leave the tab.",
    countdown: "Reward in {seconds} seconds",
    cancel: "Cancel",
    rewarded: "{reward} coins have been added.",
    canceled: "Test ad canceled – no coins received."
  },
  fr: {
    title: "Publicité test",
    hint: "Jusqu’à 8 publicités test par jour. La récompense augmente après chaque publicité.",
    button: "Voir la publicité test – {reward} pièces",
    remaining: "{remaining} sur 8 disponibles aujourd’hui",
    limit: "Limite quotidienne atteinte",
    dialogTitle: "Publicité test simulée",
    dialogHint: "Aucune vraie publicité · Le compte à rebours se met en pause si tu quittes l’onglet.",
    countdown: "Récompense dans {seconds} secondes",
    cancel: "Annuler",
    rewarded: "{reward} pièces ont été ajoutées.",
    canceled: "Publicité test annulée – aucune pièce reçue."
  },
  es: {
    title: "Anuncio de prueba",
    hint: "Hasta 8 anuncios de prueba al día. La recompensa aumenta con cada anuncio.",
    button: "Ver anuncio de prueba – {reward} monedas",
    remaining: "{remaining} de 8 disponibles hoy",
    limit: "Límite diario alcanzado",
    dialogTitle: "Anuncio de prueba simulado",
    dialogHint: "No es un anuncio real · La cuenta atrás se pausa si sales de la pestaña.",
    countdown: "Recompensa en {seconds} segundos",
    cancel: "Cancelar",
    rewarded: "Se añadieron {reward} monedas.",
    canceled: "Anuncio cancelado – no recibiste monedas."
  },
  it: {
    title: "Pubblicità di prova",
    hint: "Fino a 8 pubblicità di prova al giorno. Il premio aumenta dopo ogni pubblicità.",
    button: "Guarda la pubblicità di prova – {reward} monete",
    remaining: "{remaining} su 8 disponibili oggi",
    limit: "Limite giornaliero raggiunto",
    dialogTitle: "Pubblicità di prova simulata",
    dialogHint: "Non è una vera pubblicità · Il conto alla rovescia si ferma se lasci la scheda.",
    countdown: "Premio tra {seconds} secondi",
    cancel: "Annulla",
    rewarded: "Sono state aggiunte {reward} monete.",
    canceled: "Pubblicità annullata – nessuna moneta ricevuta."
  },
  pl: {
    title: "Reklama testowa",
    hint: "Do 8 reklam testowych dziennie. Nagroda rośnie po każdej reklamie.",
    button: "Obejrzyj reklamę testową – {reward} monet",
    remaining: "Dostępne dziś: {remaining} z 8",
    limit: "Osiągnięto dzienny limit",
    dialogTitle: "Symulowana reklama testowa",
    dialogHint: "To nie jest prawdziwa reklama · Odliczanie zatrzymuje się po opuszczeniu karty.",
    countdown: "Nagroda za {seconds} sekund",
    cancel: "Anuluj",
    rewarded: "Dodano {reward} monet.",
    canceled: "Reklama anulowana – nie przyznano monet."
  },
  nl: {
    title: "Testadvertentie",
    hint: "Maximaal 8 testadvertenties per dag. De beloning stijgt na iedere advertentie.",
    button: "Bekijk testadvertentie – {reward} munten",
    remaining: "{remaining} van 8 vandaag beschikbaar",
    limit: "Daglimiet bereikt",
    dialogTitle: "Gesimuleerde testadvertentie",
    dialogHint: "Geen echte advertentie · De timer pauzeert wanneer je het tabblad verlaat.",
    countdown: "Beloning over {seconds} seconden",
    cancel: "Annuleren",
    rewarded: "{reward} munten zijn toegevoegd.",
    canceled: "Testadvertentie geannuleerd – geen munten ontvangen."
  },
  "zh-CN": {
    title: "测试广告",
    hint: "每天最多观看8次测试广告，每次广告后的奖励都会增加。",
    button: "观看测试广告 – {reward}金币",
    remaining: "今天还可观看 {remaining}/8 次",
    limit: "已达到每日上限",
    dialogTitle: "模拟测试广告",
    dialogHint: "这不是真实广告 · 离开此标签页时倒计时会暂停。",
    countdown: "{seconds}秒后获得奖励",
    cancel: "取消",
    rewarded: "已获得{reward}金币。",
    canceled: "已取消测试广告，未获得金币。"
  }
};

export function getRewardDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function readRewardState(storage = localStorage, dayKey = getRewardDayKey()) {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "{}");
    const count = parsed.day === dayKey ? Math.trunc(Number(parsed.count) || 0) : 0;
    return { day: dayKey, count: Math.max(0, Math.min(DAILY_LIMIT, count)) };
  } catch {
    return { day: dayKey, count: 0 };
  }
}

export function setupRewardedAdTest({ awardCoins }) {
  const button = document.querySelector("#testRewardAdBtn");
  const remainingText = document.querySelector("#testRewardAdRemaining");
  const status = document.querySelector("#testRewardAdStatus");
  const overlay = document.querySelector("#testAdOverlay");
  const countdown = document.querySelector("#testAdCountdown");
  const cancelButton = document.querySelector("#testAdCancelBtn");
  if (!button || !remainingText || !status || !overlay || !countdown || !cancelButton) return;

  let timer = 0;
  let running = false;
  let visibleElapsed = 0;
  let lastTick = 0;

  const language = () => {
    const value = document.documentElement.lang || "de";
    if (translations[value]) return value;
    const short = value.toLowerCase().split("-")[0];
    return translations[short] ? short : short === "zh" ? "zh-CN" : "de";
  };
  const text = (key, values = {}) => {
    let value = translations[language()]?.[key] || translations.de[key] || key;
    for (const [name, replacement] of Object.entries(values)) {
      value = value.replaceAll(`{${name}}`, String(replacement));
    }
    return value;
  };

  const saveState = (state) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // The test reward still works for this page view.
    }
  };

  const render = () => {
    const rewardState = readRewardState();
    const remaining = Math.max(0, DAILY_LIMIT - rewardState.count);
    const nextReward = DAILY_REWARDS[rewardState.count] || 0;
    document.querySelectorAll("[data-ad-text]").forEach((element) => {
      element.textContent = text(element.dataset.adText);
    });
    remainingText.textContent = remaining > 0 ? text("remaining", { remaining }) : text("limit");
    button.disabled = running || remaining === 0;
    button.textContent = remaining === 0 ? text("limit") : text("button", { reward: nextReward });
  };

  const closeAd = (messageKey, values = {}) => {
    if (timer) window.clearInterval(timer);
    timer = 0;
    running = false;
    overlay.classList.add("hidden");
    overlay.style.display = "none";
    status.textContent = text(messageKey, values);
    render();
    button.focus();
  };

  const completeAd = () => {
    const rewardState = readRewardState();
    if (rewardState.count >= DAILY_LIMIT) {
      closeAd("limit");
      return;
    }
    const reward = DAILY_REWARDS[rewardState.count];
    saveState({ day: rewardState.day, count: rewardState.count + 1 });
    awardCoins(reward);
    closeAd("rewarded", { reward });
  };

  const startAd = () => {
    const rewardState = readRewardState();
    if (running || rewardState.count >= DAILY_LIMIT) {
      render();
      return;
    }
    running = true;
    visibleElapsed = 0;
    lastTick = performance.now();
    status.textContent = "";
    overlay.classList.remove("hidden");
    overlay.style.removeProperty("display");
    countdown.textContent = text("countdown", { seconds: 30 });
    render();
    cancelButton.focus();

    timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.min(1_000, Math.max(0, now - lastTick));
      lastTick = now;
      if (document.visibilityState === "visible") visibleElapsed += elapsed;
      const seconds = Math.max(0, Math.ceil((DURATION_MS - visibleElapsed) / 1_000));
      countdown.textContent = text("countdown", { seconds });
      if (visibleElapsed >= DURATION_MS) completeAd();
    }, 250);
  };

  button.addEventListener("click", startAd);
  cancelButton.addEventListener("click", () => closeAd("canceled"));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && running) closeAd("canceled");
  });
  window.addEventListener("languagechange", render);
  render();
}
