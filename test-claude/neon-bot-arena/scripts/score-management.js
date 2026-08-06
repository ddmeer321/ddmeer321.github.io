import { deleteOwnedOnlineScore, getOwnedOnlineScores } from "./online-leaderboard.js?v=testids1";
import { t } from "./settings.js?v=settings9";
import { escapeHtml } from "./utils.js";

export function setupScoreManagement() {
  const list = document.querySelector("#ownedScoresList");
  const deleteAllButton = document.querySelector("#deleteAllOnlineScoresBtn");
  const warning = document.querySelector("#deleteOnlineScoresWarning");
  const cancelButton = document.querySelector("#cancelDeleteOnlineScoresBtn");
  const confirmButton = document.querySelector("#confirmDeleteOnlineScoresBtn");
  const status = document.querySelector("#ownedScoresStatus");
  if (!list) return;

  let busy = false;

  const setStatus = (message = "", isError = false) => {
    if (!status) return;
    status.textContent = message;
    status.dataset.state = isError ? "error" : "ok";
  };

  const render = () => {
    const entries = getOwnedOnlineScores();
    if (entries.length === 0) {
      list.innerHTML = `<p class="owned-scores-empty">${escapeHtml(t("scoreManage.empty"))}</p>`;
    } else {
      list.innerHTML = entries.map((entry) => `
        <div class="owned-score-row">
          <span><strong>${escapeHtml(entry.name || "—")}</strong><small>${entry.score} · ${t("hud.wave")} ${entry.wave}</small></span>
          <button class="danger-button" type="button" data-delete-owned-score="${entry.scoreId}">${escapeHtml(t("scoreManage.delete"))}</button>
        </div>
      `).join("");
    }
    deleteAllButton?.classList.toggle("hidden", entries.length === 0);
    if (entries.length === 0) warning?.classList.add("hidden");
  };

  const deleteOne = async (scoreId) => {
    if (busy) return false;
    busy = true;
    setStatus(t("scoreManage.deleting"));
    const result = await deleteOwnedOnlineScore(scoreId);
    busy = false;
    if (!result.ok) {
      setStatus(t("scoreManage.deleteFailed"), true);
      return false;
    }
    setStatus(t("scoreManage.deleted"));
    render();
    window.dispatchEvent(new CustomEvent("onlineleaderboardchange"));
    return true;
  };

  list.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-delete-owned-score]");
    if (!(button instanceof HTMLButtonElement)) return;
    deleteOne(button.dataset.deleteOwnedScore);
  });

  deleteAllButton?.addEventListener("click", () => {
    warning?.classList.remove("hidden");
    confirmButton?.focus();
  });
  cancelButton?.addEventListener("click", () => warning?.classList.add("hidden"));
  confirmButton?.addEventListener("click", async () => {
    if (busy) return;
    const scoreIds = getOwnedOnlineScores().map((entry) => entry.scoreId);
    let allDeleted = true;
    for (const scoreId of scoreIds) {
      if (!await deleteOne(scoreId)) {
        allDeleted = false;
        break;
      }
    }
    warning?.classList.add("hidden");
    if (allDeleted) setStatus(t("scoreManage.deletedAll"));
  });

  window.addEventListener("ownedscoreschange", render);
  window.addEventListener("languagechange", render);
  render();
}
