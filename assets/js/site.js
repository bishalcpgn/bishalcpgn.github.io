/*
 * Page behaviour: the theme (follows the system until the visitor picks one), the name's
 * one-time monospace-to-sans morph, the photo fallback, the mobile menu, which section is
 * on screen, the writing filters, and the button that opens the old terminal.
 */
(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const $ = (sel, ctx = doc) => ctx.querySelector(sel);
  const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  /* ---------- theme ---------- */

  const toggle = $('[data-theme-toggle]');
  const themeMetas = $$('meta[name="theme-color"]');
  const effectiveTheme = () => root.getAttribute('data-theme') || (systemDark.matches ? 'dark' : 'light');

  function paintTheme() {
    const theme = effectiveTheme();
    if (toggle) toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (bg) themeMetas.forEach((meta) => meta.setAttribute('content', bg));
  }

  // A choice is stored only while it differs from the system setting, so switching
  // back to match the system means "follow the system" again.
  function setTheme(choice) {
    const system = systemDark.matches ? 'dark' : 'light';
    const follow = choice === 'system' || choice === system;
    if (follow) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', choice);
    try {
      if (follow) window.localStorage.removeItem('theme');
      else window.localStorage.setItem('theme', choice);
    } catch {
      /* storage blocked: the choice lasts for this visit */
    }
    paintTheme();
  }

  if (toggle) toggle.addEventListener('click', () => setTheme(effectiveTheme() === 'dark' ? 'light' : 'dark'));
  systemDark.addEventListener('change', paintTheme);
  doc.addEventListener('site:theme', (event) => {
    if (['light', 'dark', 'system'].includes(event.detail)) setTheme(event.detail);
  });
  paintTheme();

  /* ---------- the name arrives in monospace and settles into sans ---------- */

  const name = $('.name');
  if (name) {
    const settle = () => window.requestAnimationFrame(() => name.classList.add('is-morphed'));
    if (reduceMotion()) settle();
    else (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(() => window.setTimeout(settle, 250));
  }

  /* ---------- photo: hide the frame until assets/img/face.jpg exists ---------- */

  const face = $('[data-face]');
  if (face) {
    const img = $('img', face);
    const hide = () => { face.hidden = true; };
    if (!img || (img.complete && img.naturalWidth === 0)) hide();
    else img.addEventListener('error', hide);
  }

  /* ---------- mobile menu ---------- */

  const menuButton = $('[data-menu]');
  const nav = $('[data-nav]');

  function setMenu(open, returnFocus) {
    nav.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    if (open) {
      const first = $('a', nav);
      if (first) first.focus();
    } else if (returnFocus) {
      menuButton.focus();
    }
  }

  if (menuButton && nav) {
    menuButton.addEventListener('click', () => setMenu(!nav.classList.contains('is-open'), false));
    nav.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false, false); });
    doc.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) setMenu(false, true);
    });
    doc.addEventListener('click', (event) => {
      if (nav.classList.contains('is-open') && !event.target.closest('.top')) setMenu(false, false);
    });
    window.matchMedia('(min-width: 70.01rem)').addEventListener('change', () => setMenu(false, false));
  }

  /* ---------- which section is on screen ---------- */

  const navLinks = $$('[data-nav] a[href^="#"]');
  const sections = navLinks.map((a) => doc.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  let active = null;
  let queued = false;

  function spy() {
    queued = false;
    const line = window.innerHeight * 0.35;
    let current = null;
    sections.forEach((section) => { if (section.getBoundingClientRect().top <= line) current = section; });
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= root.scrollHeight - 4) current = sections[sections.length - 1];
    if (current === active) return;
    active = current;
    navLinks.forEach((a) => {
      if (current && a.getAttribute('href') === `#${current.id}`) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  window.addEventListener('scroll', () => {
    if (!queued) {
      queued = true;
      window.requestAnimationFrame(spy);
    }
  }, { passive: true });
  spy();

  /* ---------- small things ---------- */

  $$('[data-year]').forEach((node) => { node.textContent = String(new Date().getFullYear()); });
  $$('[data-term-open]').forEach((button) => {
    button.addEventListener('click', () => doc.dispatchEvent(new CustomEvent('site:terminal')));
  });
})();
