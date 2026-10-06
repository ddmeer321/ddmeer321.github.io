// Posteingang-Ansicht (V1.2). Zeigt Nachrichten neueste zuerst; eine Nachricht
// mit Aktion (z. B. „Ziehung ansehen“) gilt erst als gelesen, wenn man sie öffnet.

import { h } from "./dom.js";
import { openModal, closeModal } from "./modal.js";

function when(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}. · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function openInbox({ inbox, onAction }) {
  const items = inbox.list();
  // reine Info-Nachrichten gelten mit dem Öffnen des Posteingangs als gelesen
  for (const m of items) if (!m.action && !m.read) inbox.markRead(m.id);
  const list = items.length
    ? h(
        "ul.inbox-list",
        {},
        items.map((m) =>
          h(
            `li.inbox-item${m.read ? "" : ".is-unread"}`,
            {},
            h("span.inbox-dot", { "aria-hidden": "true" }, m.read ? "" : "●"),
            h(
              "div.inbox-text",
              {},
              h("strong", {}, m.title),
              h("small", {}, when(m.ts), m.read ? "" : " · neu"),
              m.body ? h("p", {}, m.body) : null
            ),
            m.action
              ? h("button.btn.btn-sm.btn-primary.inbox-action", {
                  type: "button",
                  onclick: () => {
                    inbox.markRead(m.id);
                    closeModal(true);
                    onAction(m);
                  },
                }, m.action.label)
              : null
          )
        )
      )
    : h("p.help-text", {}, "Keine Nachrichten. Verpasste Lotto-Ziehungen landen hier – ganz ohne Eile.");
  openModal({
    title: "Posteingang",
    body: h("div.inbox", {}, list),
    actions: [{ label: "Schließen", cls: "btn-ghost" }],
  });
}
