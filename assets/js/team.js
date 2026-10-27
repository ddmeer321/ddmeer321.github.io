/* Eigenes Skript statt home.js: das dortige greift ohne Null-Pruefung auf
   .boot-dialog und .project-filters zu und wuerde hier sofort abbrechen.
   Hier wird nur das Handy-Menue aufgeklappt; ohne JavaScript ist die
   Navigation offen und die Seite vollstaendig benutzbar.

   Die Commit-Zahlen stehen bewusst fest im HTML und werden NICHT zur Laufzeit
   geholt. Ein Abruf bei api.github.com wuerde die IP jedes Besuchers an GitHub
   schicken - das gehoerte in die Datenschutzerklaerung - und laeuft ohne
   Anmeldung nach 60 Anfragen pro Stunde und IP in einen 403. Fuer einen
   Zaehler, der sich im Monat um ein paar Dutzend bewegt, ist das ein
   schlechter Tausch. Neue Werte holt man so:
     git fetch --unshallow origin   # der Standardklon ist flach
     git log --format='%an' | sort | uniq -c | sort -rn
   und traegt sie in team.html ein. */
(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#main-nav');
  if (!menuButton || !navigation) return;
  const menuLabel = menuButton.querySelector('.sr-only');
  document.documentElement.classList.add('js-menu');
  menuButton.hidden = false;
  function setMenu(open) {
    menuButton.setAttribute('aria-expanded', String(open));
    if (menuLabel) menuLabel.textContent = open ? 'Menü schließen' : 'Menü öffnen';
    navigation.classList.toggle('is-open', open);
  }
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menuButton.focus();
    }
  });
})();
