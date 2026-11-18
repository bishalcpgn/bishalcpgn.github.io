/*
 * The old terminal, kept as an easter egg. Opens from the Terminal button in the header, or by
 * typing "terminal" into the guardrail. It reads its answers from the page, renders
 * everything with textContent, and closes with exit, Esc or the close button.
 */
(() => {
  'use strict';

  const doc = document;
  const dialog = doc.querySelector('[data-term]');
  if (!dialog || typeof dialog.showModal !== 'function') return;

  const $ = (sel, ctx = doc) => ctx.querySelector(sel);
  const $$ = (sel, ctx = doc) => Array.from(ctx.querySelectorAll(sel));
  const textOf = (node) => (node ? node.textContent.replace(/\s+/g, ' ').trim() : '');
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  const body = $('[data-term-body]', dialog);
  const out = $('[data-term-log]', dialog);
  const form = $('[data-term-form]', dialog);
  const input = $('input', form);
  const past = [];
  let pastIndex = 0;
  let greeted = false;
  let opener = null;

  /* ---------- tiny DOM builders; strings always become text nodes ---------- */

  const make = (tag, cls, text) => {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const span = (cls, text) => make('span', cls, text);
  const line = (...parts) => {
    const p = make('p', 'term__line');
    parts.forEach((part) => p.append(part instanceof Node ? part : doc.createTextNode(String(part))));
    return p;
  };
  const link = (label, href) => {
    const a = make('a', null, label);
    a.setAttribute('href', href);
    return a;
  };
  const prompt = () => {
    const s = span();
    s.setAttribute('aria-hidden', 'true');
    s.append(span('u', 'guest@bishal'), ':', span('p', '~'), '$ ');
    return s;
  };

  // Short, stable fake commit hashes, so `work` reads like `git log --oneline`.
  const hash = (value) => {
    let h = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0').slice(0, 7);
  };

  const SECTIONS = { work: 'work', skills: 'skills', lab: 'lab', blog: 'blog', play: 'play', certs: 'certifications', certifications: 'certifications', contact: 'contact', '~': 'top', '/': 'top', '..': 'top' };

  function print(nodes) {
    nodes.forEach((node) => out.append(node));
    while (out.children.length > 300) out.firstElementChild.remove();
    body.scrollTop = body.scrollHeight;
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  function go(id) {
    const target = doc.getElementById(id);
    close();
    if (target) window.setTimeout(() => target.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }), 50);
  }

  /* ---------- commands (answers come from the page) ---------- */

  const commands = {
    help: () => [
      line('whois  work  skills  lab  blog  certs  play  contact'),
      line('ls  cd <section>  clear  history  theme dark|light|system  exit'),
      line(span('dim', 'Tab completes, up and down walk your history. whoami, id, sudo and aws work too.')),
    ],
    whois: (args) => {
      if (args[0] && args[0].toLowerCase() !== 'bishal') return [line(`%ERROR:101: no entries found for '${args[0]}'`)];
      const current = $('#work [data-job][data-current]');
      const certs = $$('#certifications [data-cert]').map((c) => `${textOf($('[data-cert-name]', c))} (${textOf($('[data-cert-code]', c))})`);
      const rows = [
        ['Name:', textOf($('#name'))],
        ['Title:', current ? `${textOf($('[data-title]', current))}, ${textOf($('[data-org]', current))}` : ''],
        ['Location:', textOf($('[data-location]')).replace(/^Based in /, '')],
        ...certs.map((cert, i) => [i ? '' : 'Certs:', cert]),
      ];
      return [
        line(span('dim', "% Information related to 'bishal'")),
        ...rows.map(([key, value]) => line(span('dim', key.padEnd(10)), value)),
        line(span('dim', 'Remarks:  '), textOf($('[data-summary]'))),
      ];
    },
    work: () => $$('#work [data-job]').map((job) => {
      const title = textOf($('[data-title]', job));
      const l = line(span('hl', hash(title)), ' ');
      if (job.hasAttribute('data-current')) l.append(span('hl', '('), span('info', 'HEAD -> '), span('u', 'current'), span('hl', ') '));
      if (job.getAttribute('data-kind') === 'education') l.append(span('hl', '(tag: v1.0) '));
      l.append(`${title}, ${textOf($('[data-org]', job))}  `, span('dim', textOf($('[data-date]', job))));
      return l;
    }),
    skills: () => [
      line(span('dim', 'Starting Nmap 7.95 ( https://nmap.org )')),
      ...$$('#skills [data-layer]').map((layer) => line(span('u', 'open'), '  ', textOf($('[data-layer-name]', layer)), span('dim', `  ${$$('.tools li', layer).map(textOf).join(', ')}`))),
    ],
    lab: () => $$('#lab [data-lab]').map((item) => line(span('err', textOf($('[data-lab-code]', item))), '  ', textOf($('[data-lab-q]', item)))),
    blog: () => {
      const posts = $$('#blog [data-post]');
      if (!posts.length) return [line('total 0')];
      return posts.map((post) => {
        const a = $('[data-post-title]', post);
        return line(span('dim', textOf($('time', post)).padEnd(9)), ' ', link(textOf(a), a.getAttribute('href')));
      });
    },
    certs: () => $$('#certifications [data-cert]').map((cert) => line(span('dir', cert.getAttribute('data-file') || ''), '  ', textOf($('[data-cert-name]', cert)), span('dim', `  ${textOf($('[data-cert-valid]', cert)).toLowerCase()}`))),
    contact: () => $$('#contact [data-contact]').map((a) => {
      const href = a.getAttribute('href');
      return line(span('dim', (a.getAttribute('data-contact') || '').padEnd(10)), link(href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''), href));
    }),
    ls: () => [line(span('dir', 'work/'), '  ', span('dir', 'skills/'), '  ', span('dir', 'lab/'), '  ', span('dir', 'blog/'), '  ', span('dir', 'certs/'), '  ', span('dir', 'play/'), '  contact')],
    cd: (args) => {
      const key = (args[0] || '~').replace(/\/+$/, '').toLowerCase() || '/';
      if (!own(SECTIONS, key)) return [line(`cd: no such file or directory: ${args[0]}`)];
      go(SECTIONS[key]);
      return [];
    },
    clear: () => {
      out.replaceChildren();
      return [];
    },
    history: () => past.map((entry, i) => line(span('dim', String(i + 1).padStart(4, ' ')), `  ${entry}`)),
    theme: (args) => {
      const choice = (args[0] || '').toLowerCase();
      if (!['dark', 'light', 'system'].includes(choice)) return [line('usage: theme dark|light|system')];
      doc.dispatchEvent(new CustomEvent('site:theme', { detail: choice }));
      return [line(`theme: ${choice}`)];
    },
    whoami: () => [line('guest')],
    id: () => [line('uid=1001(guest) gid=1001(guest) groups=1001(guest)')],
    pwd: () => [line('/home/guest')],
    date: () => [line(new Date().toString())],
    echo: (args) => [line(args.join(' '))],
    sudo: () => [line(span('err', 'guest is not in the sudoers file.  This incident will be reported.'))],
    rm: (args) => (args.includes('/') && args.some((a) => /^-[a-z]*r/i.test(a))
      ? [line("rm: it is dangerous to operate recursively on '/'"), line('rm: use --no-preserve-root to override this failsafe')]
      : [line(`rm: cannot remove '${args.find((a) => !a.startsWith('-')) || ''}': Permission denied`)]),
    aws: (args) => {
      const arn = 'arn:aws:iam::123456789012:user/guest';
      if (args[0] === 'sts' && args[1] === 'get-caller-identity') {
        return ['{', '    "UserId": "AIDAGUESTEXAMPLE00000",', '    "Account": "123456789012",', `    "Arn": "${arn}"`, '}'].map((l) => line(l));
      }
      if (!args.length) return [line('usage: aws [options] <command> <subcommand> [parameters]')];
      const op = (args[1] || args[0]).split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      return [line(span('err', `An error occurred (AccessDenied) when calling the ${op} operation: User: ${arn} is not authorized to perform: ${args[0]}:${op}`))];
    },
    play: () => {
      go('play');
      return [];
    },
    exit: () => {
      close();
      return [];
    },
  };
  commands.logout = commands.exit;
  commands.certifications = commands.certs;
  commands.experience = commands.work;
  commands.writing = commands.blog;

  const NAMES = Object.keys(commands).sort();
  const ARGS = { cd: Object.keys(SECTIONS).filter((k) => /^[a-z]/.test(k)), theme: ['dark', 'light', 'system'], whois: ['bishal'], aws: ['sts', 's3', 'iam'] };

  function run(raw) {
    const words = raw.trim().split(/\s+/).filter(Boolean);
    print([line(prompt(), raw)]);
    if (!words.length) return;
    past.push(raw.trim());
    if (past.length > 100) past.shift();
    pastIndex = past.length;
    const name = words[0].toLowerCase();
    if (!own(commands, name)) {
      print([line(`zsh: command not found: ${words[0]}`), line(span('dim', 'Type help for the list.'))]);
      return;
    }
    const result = commands[name](words.slice(1));
    if (result && result.length) print(result);
  }

  // Returns true when Tab did something, so Tab only stays in the field when it's useful.
  function complete() {
    const value = input.value;
    const words = value.trimStart().split(/\s+/);
    const prefix = words[words.length - 1] || '';
    const key = words[0].toLowerCase();
    const pool = words.length === 1 ? NAMES : (own(ARGS, key) ? ARGS[key] : []);
    const matches = pool.filter((option) => option.startsWith(prefix.toLowerCase()));
    if (!matches.length) return false;
    if (matches.length === 1) {
      input.value = value.slice(0, value.length - prefix.length) + matches[0] + (words.length === 1 ? ' ' : '');
    } else {
      print([line(prompt(), value), line(matches.join('  '))]);
    }
    return true;
  }

  /* ---------- events ---------- */

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const raw = input.value;
    input.value = '';
    run(raw);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Tab' && !event.shiftKey && input.value.trim()) {
      if (complete()) event.preventDefault();
      return;
    }
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && past.length) {
      event.preventDefault();
      pastIndex = Math.min(past.length, Math.max(0, pastIndex + (event.key === 'ArrowUp' ? -1 : 1)));
      input.value = past[pastIndex] || '';
      return;
    }
    if (event.ctrlKey && !event.altKey && !event.metaKey) {
      const key = event.key.toLowerCase();
      if (key === 'l') {
        event.preventDefault();
        out.replaceChildren();
      } else if (key === 'c' && input.selectionStart === input.selectionEnd) {
        event.preventDefault();
        print([line(prompt(), input.value, span('dim', '^C'))]);
        input.value = '';
      }
    }
  });

  function open() {
    if (dialog.open) return;
    opener = doc.activeElement;
    dialog.showModal();
    if (!greeted) {
      greeted = true;
      const now = new Date();
      print([
        line(span('dim', `Last login: ${now.toDateString()} ${now.toTimeString().slice(0, 8)} on ttys001`)),
        line('You found the old terminal. Type help, or exit to go back.'),
      ]);
    }
    input.focus();
  }

  dialog.addEventListener('close', () => {
    if (opener && typeof opener.focus === 'function' && doc.contains(opener)) opener.focus({ preventScroll: true });
  });
  $('[data-term-close]', dialog).addEventListener('click', close);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  body.addEventListener('click', (event) => {
    if (!event.target.closest('a, button') && !String(window.getSelection())) input.focus();
  });
  doc.addEventListener('site:terminal', open);
})();
