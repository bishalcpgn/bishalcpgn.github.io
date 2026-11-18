/* Runs in <head> before first paint: marks JS as available and applies a saved theme.
   With no saved choice the page follows the visitor's system setting (prefers-color-scheme).
   A separate file because the Content-Security-Policy forbids inline scripts. */
(function () {
  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');
  try {
    var saved = window.localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch {
    /* storage blocked: follow the system setting */
  }
})();
