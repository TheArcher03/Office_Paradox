// The Brain: the hidden task tracker, the cognition meter and the save file.
// Nothing here is ever shown to the player as a list. Tasks are discovered, never assigned.

// Each task: points toward cognition, the name on the achievement pop-up, and the journal entry
// (written in the character's own hand, after the fact).
export const TASKS = {
  paperToss: {
    points: 10, title: 'Swish',
    entry: 'Crumpled a sheet of paper and threw it at the trash can. It went in. Nobody asked me to do that. I thought about it for the rest of the afternoon.',
  },
  chairSpin: {
    points: 10, title: 'Revolutions',
    entry: 'Spun the chair until the walls smeared together. When I stopped, the room kept going without me. I did not know the room could do anything else.',
  },
  shredder: {
    points: 10, title: 'Paper Trail',
    entry: 'Fed the spreadsheet to the shredder instead of finishing it. The sound it made was the best part of the day. The numbers are ribbons now.',
  },
  calendar: {
    points: 12, title: 'Caught Up',
    entry: 'The calendar was weeks behind. I crossed off every day I could not remember having. Now it agrees with me that today is today.',
  },
  ufoGame: {
    points: 10, title: 'Out of Office', replay: false,
    entry: 'The network is down. There is a little game hiding behind the error page: a small traveler in a saucer, hopping rocks on somebody else\'s planet. I rooted for it more than I expected to.',
  },
  printCat: {
    points: 10, title: 'Hard Copy',
    entry: 'Found a picture of a cat on the computer and printed it. It used a great deal of ink. I do not remember ever meeting a cat. I knew what it was anyway.',
  },
  hangCat: {
    points: 16, title: 'Office Pet',
    entry: 'Pinned the cat to the corkboard, next to the memos. It watches the desk now. For the first time the cubicle looks like it belongs to someone.',
  },
  paperPlane: {
    points: 10, title: 'Maiden Voyage',
    entry: 'Folded a sheet into a dart, wings and all, and let it go. For a moment I was riding along right behind it. Then the wall. I would like to know what is on the other side of the wall.',
  },
  drums: {
    points: 10, title: 'Desk Set',
    entry: 'Two pencils, one desk, one coffee mug. I kept time until my hands knew the pattern better than I did. The quarterly numbers have never once had a beat.',
  },
  nap: {
    points: 12, title: 'Out Like a Light', replay: false,
    entry: 'Put my feet up on the desk, leaned back and let my eyes close. I dreamed of a place with two suns, and tall quiet people who seemed to know me. When I woke up it was five o\'clock.',
  },
};
// Rough total for all 10 prototype tasks plus small bonuses. Cognition = points / this.
export const PROTOTYPE_POINTS = 120;
const SAVE_KEY = 'office-paradox-save-v1';

const fresh = () => ({ v: 1, done: {}, order: [], points: 0, clockSec: 9 * 3600, day: 1, calendarDay: null, baskets: 0, pcOn: false, ufoBest: 0, pinned: [] });

export function createBrain({ onComplete = () => {} } = {}) {
  let state = fresh();
  const brain = {
    get state() { return state; },
    isDone: (id) => !!state.done[id],
    cognition: () => Math.min(1, state.points / PROTOTYPE_POINTS),
    // Returns true the first time a task is done.
    complete(id) {
      if (state.done[id] || !TASKS[id]) return false;
      state.done[id] = { day: state.day, clockSec: Math.floor(state.clockSec) };
      state.order.push(id);
      state.points += TASKS[id].points;
      brain.save();
      onComplete(id, TASKS[id]);
      return true;
    },
    // small extra credit for doing something again (capped, so grinding doesn't pay)
    bonus(key, points, cap) {
      state[key] = (state[key] || 0) + 1;
      if (state[key] > 1 && state[key] <= cap + 1) state.points += points;
    },
    entries: () => state.order.map((id) => ({ id, ...TASKS[id], ...state.done[id] })),
    save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* private window: play without saving */ } },
    load() {
      try {
        const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        if (s && s.v === 1) { state = { ...fresh(), ...s }; return true; }
      } catch { /* a broken save is ignored */ }
      return false;
    },
    erase() { try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to erase */ } state = fresh(); },
  };
  return brain;
}

export function clockLabel(clockSec) {
  const h24 = Math.floor(clockSec / 3600) % 24, m = Math.floor(clockSec / 60) % 60;
  const h = ((h24 + 11) % 12) + 1;
  return `${h}:${String(m).padStart(2, '0')}`;
}
