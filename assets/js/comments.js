/*
 * Comments on blog posts: GitHub Discussions, shown with giscus (https://giscus.app).
 *
 * Nothing loads from giscus.app until a reader asks for comments, so posts stay free
 * of third-party code by default. Readers who have signed in to comment before (giscus
 * keeps a session in this site's localStorage) see comments straight away.
 *
 * Setup: fill in assets/js/giscus-config.js from giscus.app (README, "Comments").
 * Until then only the LinkedIn option shows.
 */
(() => {
  'use strict';

  const GISCUS = Object.assign({ repo: '', repoId: '', category: 'Comments', categoryId: '' }, window.GISCUS_CONFIG || {});

  const ORIGIN = 'https://giscus.app';
  const SESSION_KEY = 'giscus-session';

  const doc = document;
  const root = doc.documentElement;
  const section = doc.querySelector('[data-comments]');
  if (!section || !GISCUS.repo || !GISCUS.repoId || !GISCUS.categoryId) return;

  const gate = section.querySelector('[data-comments-gate]');
  const thread = section.querySelector('[data-comments-frame]');
  const button = section.querySelector('[data-comments-load]');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  let loaded = false;

  gate.hidden = false;

  const theme = () => {
    const site = root.getAttribute('data-theme') || (systemDark.matches ? 'dark' : 'light');
    return site === 'dark' ? 'noborder_dark' : 'noborder_light';
  };

  function load(moveFocus) {
    if (loaded) return;
    loaded = true;
    gate.hidden = true;
    thread.textContent = 'Loading comments…';
    if (moveFocus) thread.focus();

    const script = doc.createElement('script');
    script.src = `${ORIGIN}/client.js`;
    Object.entries({
      repo: GISCUS.repo,
      repoId: GISCUS.repoId,
      category: GISCUS.category,
      categoryId: GISCUS.categoryId,
      mapping: 'pathname',  // one discussion per post URL
      strict: '1',          // exact matching, so similar URLs never share a thread
      reactionsEnabled: '1',
      emitMetadata: '0',
      inputPosition: 'bottom',
      theme: theme(),
      lang: 'en',
    }).forEach(([key, value]) => { script.dataset[key] = value; });
    script.crossOrigin = 'anonymous';
    script.async = true;
    section.append(script);
  }

  button.addEventListener('click', () => load(true));

  // Coming back from GitHub sign-in (?giscus=...) or already signed in: show comments at once.
  let signedIn;
  try {
    signedIn = window.localStorage.getItem(SESSION_KEY) !== null;
  } catch {
    signedIn = false;
  }
  const returning = new URL(window.location.href).searchParams.has('giscus');
  if (returning || signedIn) {
    load(false);
    if (returning) window.requestAnimationFrame(() => section.scrollIntoView({ block: 'start' }));
  }

  // Keep the comment thread in the site's theme, including when the visitor toggles it.
  function syncTheme() {
    const frame = thread.querySelector('iframe.giscus-frame');
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ giscus: { setConfig: { theme: theme() } } }, ORIGIN);
    }
  }
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  systemDark.addEventListener('change', syncTheme);
})();
