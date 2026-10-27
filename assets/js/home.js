/* Links and project cards remain usable without JavaScript. */
(() => {
  // The native dialog traps focus and supports Escape. Without JS it stays closed.
  const intro = document.querySelector('.boot-dialog');
  const replay = document.querySelector('.intro-replay');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  // Same character-by-character typing as the original terminal, with fewer lines.
  let typingDelay = 0;
  intro.querySelectorAll('.boot-command, .boot-line').forEach((line) => {
    const characters = line.textContent.length;
    line.style.setProperty('--n', characters);
    line.style.setProperty('--d', `${typingDelay}ms`);
    typingDelay += characters * 9 + 45;
  });
  intro.style.setProperty('--typing-end', `${typingDelay}ms`);
  let introTimer;
  let returnFocus;
  function finishIntro() {
    if (intro.open) intro.close();
  }
  function playIntro() {
    clearTimeout(introTimer);
    returnFocus = document.activeElement;
    intro.classList.remove('is-playing');
    intro.showModal();
    document.documentElement.classList.add('intro-open');
    void intro.offsetWidth;
    intro.classList.add('is-playing');
    introTimer = setTimeout(finishIntro, reducedMotion.matches ? 1200 : 2850);
  }
  intro.addEventListener('close', () => {
    clearTimeout(introTimer);
    intro.classList.remove('is-playing');
    document.documentElement.classList.remove('intro-open');
    if (returnFocus && returnFocus !== document.body) returnFocus.focus({ preventScroll: true });
  });
  intro.querySelector('.boot-skip').addEventListener('click', finishIntro);
  intro.addEventListener('click', (event) => {
    if (!event.target.closest('.boot-skip')) finishIntro();
  });
  if (typeof intro.showModal === 'function') {
    replay.hidden = false;
    replay.addEventListener('click', playIntro);
    // Respect motion preferences and direct links to sections.
    if (!reducedMotion.matches && !location.hash) playIntro();
  }
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#main-nav');
  const menuLabel = menuButton.querySelector('.sr-only');
  document.documentElement.classList.add('js-menu');
  menuButton.hidden = false;
  function setMenu(open) {
    menuButton.setAttribute('aria-expanded', String(open));
    menuLabel.textContent = open ? 'Menü schließen' : 'Menü öffnen';
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
  const filterBar = document.querySelector('.project-filters');
  const filters = [...filterBar.querySelectorAll('button')];
  const cards = [...document.querySelectorAll('.project-card')];
  const status = document.querySelector('#filter-status');
  filterBar.hidden = false;
  filterBar.addEventListener('click', (event) => {
    const selected = event.target.closest('button[data-filter]');
    if (!selected) return;
    filters.forEach((button) => button.setAttribute('aria-pressed', String(button === selected)));
    cards.forEach((card) => {
      card.hidden = selected.dataset.filter !== 'all' && card.dataset.category !== selected.dataset.filter;
    });
    const count = cards.filter((card) => !card.hidden).length;
    status.textContent = `${count} ${count === 1 ? 'Projekt wird' : 'Projekte werden'} angezeigt.`;
  });
})();
