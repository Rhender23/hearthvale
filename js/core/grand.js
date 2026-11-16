// Grand projects, raised in stages (BUILD[k].stages: [{ cost, time }]). Placing one pays for the first stage. When a
// stage's work is done the next is paid for and begun; if the stores can't cover it yet, the site waits (b.waiting)
// and the builders go about other work until there is enough. Taking it down returns every stage that was paid.
import { BUILD } from './config.js';
import { have, pay, notice, addRes } from './state.js';
import { RES } from './config.js';

export const isGrand = k => !!(BUILD[k] && BUILD[k].stages);
export const stagesOf = k => (BUILD[k] && BUILD[k].stages) || null;
export const stageOf = b => b.stage || 0;
export const nextStageCost = b => { const s = stagesOf(b.k); return s && stageOf(b) + 1 < s.length ? s[stageOf(b) + 1].cost : null; };
export const stageLine = b => { const s = stagesOf(b.k); return s ? `Stage ${stageOf(b) + 1} of ${s.length}` : ''; };

// A stage's work just finished. Returns 'next' (the next stage is paid and begun), 'wait' (not enough yet) or 'done'.
export function stageDone(g, b) {
  const s = stagesOf(b.k); if (!s || stageOf(b) + 1 >= s.length) return 'done';
  return beginNext(g, b) ? 'next' : 'wait';
}
export function beginNext(g, b) {
  const cost = nextStageCost(b); if (!cost) return false;
  if (!pay(g, cost)) { b.waiting = true; return false; }
  b.waiting = false; b.stage = stageOf(b) + 1; b.prog = 0; b.time = stagesOf(b.k)[b.stage].time;
  notice(g, `The ${BUILD[b.k].name.toLowerCase()}: stage ${b.stage + 1} of ${stagesOf(b.k).length} begins.`);
  return true;
}
// A waiting site can be worked once the next stage can be paid for.
export const canWork = (g, b) => !b.waiting || have(g, nextStageCost(b));
// Everything paid for so far (for taking it down).
export function paidSoFar(b) {
  const s = stagesOf(b.k); if (!s) return BUILD[b.k].cost;
  const out = {}; for (let i = 0; i <= stageOf(b); i++) for (const [r, n] of Object.entries(s[i].cost)) out[r] = (out[r] || 0) + n;
  return out;
}
export function refund(g, b) { const c = paidSoFar(b); for (const r of RES) if (c[r]) addRes(g, r, c[r]); }
