/* Optional terminal intro with session persistence and a bounded fallback. */
(function () {
  var root = document.documentElement;
  var output = document.getElementById('ausgabe');
  var restart = document.getElementById('neustart');
  var overlay = document.getElementById('lade');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var timer, safety, previousFocus;
  var seen = false;
  try { seen = sessionStorage.getItem('deep-boot-seen') === '1'; } catch (_) {}
  function finish() {
    clearTimeout(timer); clearTimeout(safety); clearTimeout(window.deepBootSafety);
    root.classList.remove('laedt'); root.classList.add('fertig');
    removeEventListener('keydown', onKey); removeEventListener('wheel', finish);
    if (overlay && overlay.contains(document.activeElement) && previousFocus) previousFocus.focus({preventScroll:true});
    try { sessionStorage.setItem('deep-boot-seen', '1'); } catch (_) {}
  }
  function onKey(event) {
    if (event.key === 'Escape' || event.key === 'Tab') finish();
  }
  function start() {
    if (!output || reduced.matches) { finish(); return; }
    clearTimeout(timer); clearTimeout(safety);
    previousFocus = document.activeElement;
    root.classList.remove('tippt', 'fertig');
    var elapsed = 0;
    output.querySelectorAll('.z').forEach(function (line) {
      var count = line.textContent.length;
      line.style.setProperty('--n', count);
      line.style.setProperty('--d', elapsed + 'ms');
      elapsed += count * 3 + 16;
    });
    root.style.setProperty('--ms', '3ms');
    void output.offsetWidth;
    root.classList.add('laedt', 'tippt');
    addEventListener('keydown', onKey);
    addEventListener('wheel', finish, {passive:true});
    var skip = overlay && overlay.querySelector('button');
    if (skip) skip.focus({preventScroll:true});
    timer = setTimeout(finish, Math.min(elapsed + 200, 2400));
    safety = setTimeout(finish, 3000);
  }
  if (overlay) overlay.addEventListener('click', finish);
  if (seen || reduced.matches || !root.classList.contains('laedt')) finish();
  else start();
  if (restart) restart.addEventListener('click', function () {
    scrollTo({top:0, behavior:'auto'}); start();
  });
  reduced.addEventListener('change', function () { if (reduced.matches) finish(); });
  var sections = document.querySelectorAll('.anim');
  if ('IntersectionObserver' in window && !reduced.matches) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('sichtbar'); observer.unobserve(entry.target);
        }
      });
    }, {rootMargin:'0px 0px -6% 0px'});
    sections.forEach(function (section) { observer.observe(section); });
    root.classList.add('jsan');
  }
})();
