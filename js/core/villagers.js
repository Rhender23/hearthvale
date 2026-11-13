// Villager model and the override stack.
//
// Each villager runs one action at a time (`act`). Two holding areas sit behind it:
//   queue - player orders waiting their turn (first in, first out)
//   stack - actions that were interrupted and will resume (last in, first out)
// Autonomous actions are never stacked: if something interrupts them, the
// villager simply re-decides later. Player and schedule actions resume.
import { NAMES, COLORS, SKINS, HAIRS, PRI } from './config.js';

export function createVillager(g, x, y, extra = {}) {
  const n = g.nameI++;
  const v = {
    id: g.nextId++, name: NAMES[n % NAMES.length] + (n >= NAMES.length ? ' ' + (Math.floor(n / NAMES.length) + 1) : ''),
    x, y, col: COLORS[g.villagers.length % COLORS.length], skin: g.rng.pick(SKINS), hair: g.rng.pick(HAIRS), dir: 1, moving: false, path: [],
    act: null, queue: [], stack: [], carry: 0, carryRes: null, carryKind: 0,
    energy: 1, full: 0.85, hyd: 0.85, missed: 0, hardDays: 0, eff: 1, why: '', decideT: 0.5 + g.rng() * 1.5, reevalT: 8 + g.rng() * 4, inside: false,
    ...extra,
  };
  g.villagers.push(v);
  return v;
}

export const action = (type, props) => ({ type, pri: PRI.AUTO, src: 'auto', phase: 'start', t: 0, tries: 0, why: '', ...props });

function release(g, v, a) {
  if (a && a.type === 'sleep' && a.bed) { const b = g.bmap.get(a.bed); if (b) b.sleepers = Math.max(0, b.sleepers - 1); a.bed = null; }
  v.inside = false;
}
function suspend(g, v) {
  const a = v.act;
  if (!a) return;
  v.path = []; v.moving = false;
  if (a.src === 'auto') { release(g, v, a); return; }
  a.phase = 'start'; a.tries = 0;
  if (a.type === 'sleep') release(g, v, a);
  v.stack.push(a);
}

// Player order: always wins. Replaces any previous player order and clears the queue.
export function command(g, v, a) {
  a.pri = PRI.PLAYER; a.src = 'player';
  if (v.act && v.act.src === 'player') { release(g, v, v.act); v.act = null; v.path = []; }
  v.queue = v.queue.filter(q => q.src !== 'player');
  v.stack = v.stack.filter(q => q.src !== 'player');
  suspend(g, v);
  start(v, a);
}
// Player order that waits behind the current player order.
export function enqueue(g, v, a) {
  a.pri = PRI.PLAYER; a.src = 'player';
  if (v.act && v.act.src === 'player') v.queue.push(a); else command(g, v, a);
}
// Schedule or social interrupt: preempts anything with lower priority.
export function interrupt(g, v, a) {
  if (v.act && v.act.pri >= a.pri) return false;
  suspend(g, v); start(v, a);
  return true;
}
// Autonomy: only fills an empty slot or replaces another autonomous choice.
export function choose(g, v, a) {
  if (v.act && v.act.src !== 'auto') return false;
  if (v.act) { release(g, v, v.act); v.path = []; }
  start(v, a);
  return true;
}
function start(v, a) { v.act = a; v.why = a.why || v.why; }

// Called when the current action ends (done or failed). Resumes what was waiting.
export function finish(g, v) {
  release(g, v, v.act);
  v.act = null; v.path = []; v.moving = false;
  const top = v.stack[v.stack.length - 1], head = v.queue[0];
  if (head && (!top || head.pri > top.pri)) start(v, v.queue.shift());
  else if (top) start(v, v.stack.pop());
  else if (head) start(v, v.queue.shift());
  else { v.decideT = 0.6 + g.rng() * 0.8; }
}
export const hasAction = (v, type) => (v.act && v.act.type === type) || v.stack.some(a => a.type === type) || v.queue.some(a => a.type === type);
export const isAsleep = v => v.act && v.act.type === 'sleep' && v.act.phase === 'sleep';
export const isFree = v => !v.act;
