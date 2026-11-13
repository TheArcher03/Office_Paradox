// The journal (J): written entries for things you've already done, in the character's handwriting.
// The very last page is reserved for hint doodles. It stays empty until a player stalls (Stage 5).
import { clockLabel } from './brain.js';
import { doodleSvg } from './doodles.js';

const PER_PAGE = 2;

export function createJournal(brain, { onTurn = () => {} } = {}) {
  const el = document.getElementById('journal');
  const body = document.getElementById('journalBody');
  const foot = document.getElementById('journalFoot');
  let open = false, page = 0;

  const pageCount = () => Math.max(1, Math.ceil(brain.entries().length / PER_PAGE)) + 1;   // + the back page
  function render() {
    const entries = brain.entries(), n = pageCount();
    page = Math.max(0, Math.min(n - 1, page));
    const back = page === n - 1;
    el.classList.toggle('back', back);
    body.innerHTML = '';
    if (back) {
      // doodles only, no words: one for each time you got stuck
      const grid = document.createElement('div'); grid.className = 'doodles';
      grid.innerHTML = (brain.state.hints || []).map((id, i) => doodleSvg(id, i)).join('');
      body.append(grid);
    } else {
      for (const e of entries.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)) {
        const d = document.createElement('div'); d.className = 'entry';
        const h = document.createElement('div'); h.className = 'when'; h.textContent = `Day ${e.day} · ${clockLabel(e.clockSec)}`;
        const t = document.createElement('div'); t.textContent = e.entry;
        d.append(h, t); body.append(d);
      }
    }
    foot.textContent = back ? '' : `${page + 1}`;
  }
  return {
    get open() { return open; },
    toggle(force) {
      open = force === undefined ? !open : force;
      if (open) page = Math.max(0, pageCount() - 2);   // opens on the newest written page
      el.style.display = open ? 'flex' : 'none';
      if (open) render();
      onTurn();
    },
    turn(dir) { const p = page; page += dir; render(); if (page !== p) onTurn(); },
    page: () => page, pageCount,
  };
}
