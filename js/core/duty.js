// Standing jobs. An order to gather, farm, fetch water or work a workshop becomes the villager's job (v.duty) until it is
// changed. Errands (build, move, plant, unload, take down) sit on top of it; when they end the villager goes back to the job.
// With No free will the job is held as an order and resumed every morning; with free will it is a strong preference.
// A job is stored by kind and place, never by live object, so it survives saving.
import { BUILD, PRI } from './config.js';
import { action } from './villagers.js';

const JOB = new Set(['gather', 'farm', 'water', 'craft']);
export const isJob = a => !!a && JOB.has(a.type);
const RETRY = 15;   // seconds before trying a job again after it could not go ahead

export function dutyOf(g, a) {
  if (!isJob(a)) return null;
  if (a.type === 'gather') return { type: 'gather', kind: a.kind, key: a.key };
  if (a.type === 'water') return { type: 'water', key: 'water' };
  const b = g.bmap.get(a.b);
  return b ? { type: a.type, b: b.id, k: b.k, key: a.type === 'farm' ? a.key : 'craft', at: [b.x, b.y] } : null;
}

// The building a job points at, or a stand-in of the same kind (a field taken down: another one at the same farmhouse).
function dutyBuilding(g, v, d) {
  const b = g.bmap.get(d.b);
  if (b && b.done && b.k === d.k) return b;
  if (d.type !== 'farm') return null;
  const near = g.buildings.filter(x => x.k === d.k && x.done).sort((p, q) => Math.hypot(p.x - d.at[0], p.y - d.at[1]) - Math.hypot(q.x - d.at[0], q.y - d.at[1]))[0];
  if (near) { d.b = near.id; d.at = [near.x, near.y]; }
  return near || null;
}

// A fresh action for the villager's job, or null if it cannot be done any more (then the job is let go).
export function dutyAction(g, v) {
  const d = v.duty;
  if (!d) return null;
  let a = null;
  if (d.type === 'gather') a = action('gather', { kind: d.kind, key: d.key });
  else if (d.type === 'water') a = action('water', { key: 'water' });
  else {
    const b = dutyBuilding(g, v, d);
    if (!b) { v.duty = null; if (d.type === 'craft' && v.job === d.b) { v.job = null; v.role = null; } return null; }
    a = action(d.type, { b: b.id, key: d.key });
  }
  a.duty = true;
  return a;
}

// Called each frame for a villager with nothing to do (No free will), and by Back to work.
export function resumeDuty(g, v, src = 'player') {
  if (!v.duty || v.held || g.clock < (v.dutyWait || 0)) return false;
  const a = dutyAction(g, v);
  if (!a) return false;
  a.src = src; a.pri = src === 'player' ? PRI.PLAYER : PRI.AUTO;
  v.act = a; v.why = '';
  return true;
}
export const dutyFailed = (g, v) => { v.dutyWait = g.clock + RETRY; };

// How well an autonomous option matches the villager's job (free will): a strong pull, not a chain.
export function dutyBonus(v, key, target) {
  const d = v.duty;
  if (!d) return 0;
  if (d.type === 'gather') return d.key === key ? 35 : 0;
  if (d.type === 'water') return key === 'water' ? 35 : 0;
  return target === d.b ? 35 : 0;
}

// Saving: buildings get new ids on load, so the place is kept.
export const dutySave = (g, v) => v.duty ? { ...v.duty } : null;
export function dutyLoad(g, v, d) {
  if (!d) return;
  if (d.at) { const id = g.w.occ[d.at[1] * 40 + d.at[0]]; if (!(id > 0) && d.type === 'craft') return; d.b = id > 0 ? id : null; }
  v.duty = d;
}
export const dutyName = (g, d) => !d ? '' : d.type === 'gather' ? { wood: 'Woodcutter', stone: 'Stone miner', gold: 'Gold miner', berry: 'Berry picker', fish: 'Fisher', clay: 'Clay digger' }[(d.key || '').replace(/_.*/, '')] || 'Gatherer'
  : d.type === 'water' ? 'Water carrier' : d.type === 'farm' ? 'Farmhand' : (BUILD[d.k] && BUILD[d.k].name) || 'Worker';
