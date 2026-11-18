/*
 * Contain the breach: a turn-based containment puzzle.
 *
 * An attacker starts in the middle of an 11 by 11 network and, after each of your turns,
 * moves one hop toward the internet edge along a shortest path. Isolate one host per
 * turn. You win the moment no route out remains; you lose if the attacker reaches the edge.
 *
 * The engine below is pure and deterministic (same seed, same board, same attacker), and
 * is exposed as window.BreachEngine for the curious. Boards: one shared board per day,
 * random boards on demand, and any board can be shared as #breach-<seed>.
 */
(() => {
  'use strict';

  /* ---------- engine ---------- */

  const N = 11;
  const START = Math.floor(N / 2) * N + Math.floor(N / 2);
  const COLUMNS = 'ABCDEFGHIJK';

  const rowOf = (i) => Math.floor(i / N);
  const colOf = (i) => i % N;
  const isEdge = (i) => rowOf(i) === 0 || colOf(i) === 0 || rowOf(i) === N - 1 || colOf(i) === N - 1;
  const nameOf = (i) => `${COLUMNS[colOf(i)]}${rowOf(i) + 1}`;

  // Offset hex layout: odd rows sit half a step to the right.
  const EVEN_ROW = [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
  const ODD_ROW = [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];

  function neighbors(i) {
    const r = rowOf(i);
    const c = colOf(i);
    return (r % 2 ? ODD_ROW : EVEN_ROW)
      .map(([dr, dc]) => [r + dr, c + dc])
      .filter(([nr, nc]) => nr >= 0 && nr < N && nc >= 0 && nc < N)
      .map(([nr, nc]) => nr * N + nc);
  }

  // Hops from every host to the nearest open edge host, through hosts that are not isolated.
  function distances(blocked) {
    const dist = new Array(N * N).fill(Infinity);
    const queue = [];
    for (let i = 0; i < N * N; i += 1) {
      if (isEdge(i) && !blocked[i]) {
        dist[i] = 0;
        queue.push(i);
      }
    }
    for (let q = 0; q < queue.length; q += 1) {
      const i = queue[q];
      neighbors(i).forEach((j) => {
        if (!blocked[j] && dist[j] === Infinity) {
          dist[j] = dist[i] + 1;
          queue.push(j);
        }
      });
    }
    return dist;
  }

  // The attacker's next hop, or -1 when no route to the edge remains. On ties it prefers
  // the host with the most open neighbours (hardest to box in), then the lowest index.
  function attackerStep(blocked, at) {
    const dist = distances(blocked);
    if (dist[at] === Infinity) return -1;
    const open = (j) => neighbors(j).filter((k) => !blocked[k]).length;
    const options = neighbors(at).filter((j) => !blocked[j] && dist[j] === dist[at] - 1);
    options.sort((a, b) => open(b) - open(a) || a - b);
    return options[0];
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 10 to 14 hosts start isolated; boards that start already contained are skipped.
  function createBoard(seed) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const rand = mulberry32((seed + attempt * 7919) >>> 0);
      const blocked = new Array(N * N).fill(false);
      const count = 10 + Math.floor(rand() * 5);
      let placed = 0;
      while (placed < count) {
        const i = Math.floor(rand() * N * N);
        if (i !== START && !blocked[i]) {
          blocked[i] = true;
          placed += 1;
        }
      }
      if (distances(blocked)[START] !== Infinity) return { blocked, attacker: START };
    }
    return { blocked: new Array(N * N).fill(false), attacker: START };
  }

  function newGame(seed) {
    const board = createBoard(seed);
    return { seed, blocked: board.blocked, attacker: board.attacker, trail: [], moves: 0, status: 'playing', last: -1 };
  }

  // One turn: isolate host i, then the attacker answers. Returns the new state, or null
  // if the move is not allowed.
  function play(state, i) {
    if (state.status !== 'playing' || state.blocked[i] || i === state.attacker) return null;
    const blocked = state.blocked.slice();
    blocked[i] = true;
    const moves = state.moves + 1;
    const next = attackerStep(blocked, state.attacker);
    if (next === -1) return { ...state, blocked, moves, status: 'won', last: i };
    return {
      ...state, blocked, moves, last: i,
      trail: state.trail.concat(state.attacker),
      attacker: next,
      status: isEdge(next) ? 'lost' : 'playing',
    };
  }

  window.BreachEngine = Object.freeze({ N, START, neighbors, distances, attackerStep, createBoard, newGame, play, isEdge, nameOf });

  /* ---------- interface ---------- */

  const doc = document;
  const root = doc.querySelector('[data-breach]');
  if (!root) return;

  const $ = (sel, ctx = root) => ctx.querySelector(sel);
  const make = (tag, cls) => {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    return node;
  };

  const board = $('[data-board]');
  const statusEl = $('[data-message]');
  const movesEl = $('[data-moves]');
  const hopsEl = $('[data-hops]');
  const bestEl = $('[data-best]');
  const labelEl = $('[data-board-label]');
  const copyButton = $('[data-copy-result]');
  const announcer = doc.querySelector('[data-announce]');
  const BEST_KEY = 'breach-best';
  const nodes = [];

  const today = Math.floor(Date.now() / 86400000);
  const dailySeed = Math.imul(today, 2654435761) >>> 0;
  const todayLabel = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  let state;
  let daily = true;
  let focusIndex = START;

  function readBest() {
    try {
      const value = Number(window.localStorage.getItem(BEST_KEY));
      return Number.isFinite(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  function writeBest(moves) {
    try {
      window.localStorage.setItem(BEST_KEY, String(moves));
    } catch {
      /* storage blocked: the best score lasts for this visit */
    }
  }

  // Build the 11 rows once; turns only change attributes.
  for (let r = 0; r < N; r += 1) {
    const row = make('div', r % 2 ? 'breach__row breach__row--odd' : 'breach__row');
    row.setAttribute('role', 'row');
    for (let c = 0; c < N; c += 1) {
      const i = r * N + c;
      const cell = make('div', 'breach__cell');
      cell.setAttribute('role', 'gridcell');
      const button = make('button', 'breach__node');
      button.type = 'button';
      button.dataset.i = String(i);
      button.tabIndex = -1;
      button.addEventListener('click', () => move(i));
      cell.append(button);
      row.append(cell);
      nodes.push(button);
    }
    board.append(row);
  }

  function describe(i, st, onTrail, isNext) {
    const words = { free: 'open host', edge: 'internet edge', isolated: 'isolated', attacker: 'attacker' }[st];
    return `${nameOf(i)}, ${words}${onTrail ? ', compromised' : ''}${isNext ? ', attacker\u2019s next hop' : ''}`;
  }

  function render() {
    const dist = distances(state.blocked);
    const next = state.status === 'playing' ? attackerStep(state.blocked, state.attacker) : -1;
    const trail = new Set(state.trail);
    nodes.forEach((button, i) => {
      let st = 'free';
      if (state.blocked[i]) st = 'isolated';
      else if (i === state.attacker) st = 'attacker';
      else if (isEdge(i)) st = 'edge';
      const onTrail = trail.has(i) && st !== 'isolated' && i !== state.attacker;
      const isNext = i === next;
      button.dataset.state = st;
      button.toggleAttribute('data-trail', onTrail);
      button.toggleAttribute('data-next', isNext);
      button.setAttribute('aria-disabled', String(state.status !== 'playing' || st === 'isolated' || st === 'attacker'));
      button.setAttribute('aria-label', describe(i, st, onTrail, isNext));
      button.tabIndex = i === focusIndex ? 0 : -1;
    });
    root.dataset.status = state.status;
    movesEl.textContent = String(state.moves);
    hopsEl.textContent = state.status === 'won' ? 'none' : String(dist[state.attacker]);
    const best = readBest();
    bestEl.textContent = best ? `${best} moves` : '\u2013';
    labelEl.textContent = daily ? `Today\u2019s board, ${todayLabel}` : `Board #${state.seed}`;
    copyButton.hidden = state.status === 'playing';
  }

  function say(message) {
    statusEl.textContent = message;
  }

  function start(seed, isDaily, intro) {
    daily = isDaily;
    state = newGame(seed);
    focusIndex = START;
    render();
    say(`${intro} The attacker is on ${nameOf(state.attacker)}, ${distances(state.blocked)[state.attacker]} hops from the internet. Isolate a host to slow them down.`);
  }

  function move(i) {
    focusIndex = i;
    if (state.status !== 'playing') {
      render();
      say(state.status === 'won' ? 'This one is contained. Start a new board, or replay this one.' : 'This network is lost. Replay the board, or start a new one.');
      return;
    }
    const next = play(state, i);
    if (!next) {
      render();
      say(i === state.attacker ? 'That\u2019s the attacker\u2019s host. Isolate the hosts around it.' : `${nameOf(i)} is already isolated.`);
      return;
    }
    state = next;
    if (state.status === 'won') {
      const best = readBest();
      const record = !best || state.moves < best;
      if (record) writeBest(state.moves);
      render();
      say(`Contained in ${state.moves} moves. The attacker on ${nameOf(state.attacker)} has no route left to the internet.${record ? ' New best.' : ''}`);
    } else if (state.status === 'lost') {
      render();
      say(`Breach. The attacker reached the internet at ${nameOf(state.attacker)} after ${state.moves} moves. Replay this board, or start a new one.`);
    } else {
      render();
      say(`You isolated ${nameOf(i)}. The attacker moved to ${nameOf(state.attacker)}, ${distances(state.blocked)[state.attacker]} hops from the internet.`);
    }
  }

  // Roving focus: one Tab stop for the whole board, arrow keys move between hosts.
  board.addEventListener('keydown', (event) => {
    const r = rowOf(focusIndex);
    const c = colOf(focusIndex);
    const moves = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    let target = null;
    if (moves[event.key]) {
      const [dr, dc] = moves[event.key];
      const nr = Math.min(N - 1, Math.max(0, r + dr));
      const nc = Math.min(N - 1, Math.max(0, c + dc));
      target = nr * N + nc;
    } else if (event.key === 'Home') {
      target = r * N;
    } else if (event.key === 'End') {
      target = r * N + N - 1;
    }
    if (target === null) return;
    event.preventDefault();
    nodes[focusIndex].tabIndex = -1;
    focusIndex = target;
    nodes[focusIndex].tabIndex = 0;
    nodes[focusIndex].focus();
  });

  $('[data-new]').addEventListener('click', () => {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    start(buffer[0], false, 'New board.');
  });
  $('[data-retry]').addEventListener('click', () => start(state.seed, daily, 'Same board, fresh start.'));
  $('[data-daily]').addEventListener('click', () => start(dailySeed, true, 'Today\u2019s board.'));

  copyButton.addEventListener('click', async () => {
    const outcome = state.status === 'won' ? `contained the breach in ${state.moves} moves` : `lost the network after ${state.moves} moves`;
    const where = daily ? `on today\u2019s board (${todayLabel})` : 'on this board';
    const text = `I ${outcome} ${where}. Your turn: ${window.location.origin}${window.location.pathname}#breach-${state.seed}`;
    let ok;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }
    copyButton.textContent = ok ? 'Copied' : 'Copy failed';
    if (announcer) announcer.textContent = ok ? 'Result copied to the clipboard.' : 'Copying failed.';
    window.setTimeout(() => { copyButton.textContent = 'Copy result'; }, 2000);
  });

  // A shared board link (#breach-<seed>) opens that board.
  const shared = window.location.hash.match(/^#breach-(\d{1,10})$/);
  if (shared) {
    start(Number(shared[1]) >>> 0, false, 'Shared board.');
    window.requestAnimationFrame(() => doc.getElementById('play').scrollIntoView({ block: 'start' }));
  } else {
    start(dailySeed, true, 'Today\u2019s board.');
  }
})();
