/* Show the path that was requested. textContent only, so a crafted URL can't inject markup. */
(() => {
  let path = window.location.pathname;
  try { path = decodeURIComponent(path); } catch { /* keep the raw path if it isn't valid UTF-8 */ }
  if (path.length > 80) path = `${path.slice(0, 77)}...`;
  document.querySelectorAll('[data-path]').forEach((node) => { node.textContent = path; });
})();
