// Draws frames headlessly against a stub canvas, in every season and during each seasonal festival, to catch
// errors in the drawing code (a missing name, a bad call) without a browser.
import { createGame, update } from '../js/core/game.js';
import { SEASON, DAY } from '../js/core/config.js';
import { createRenderer } from '../js/ui/render.js';
const noop = () => {};
const grad = { addColorStop: noop };
const ctx = new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => grad; if (k === 'measureText') return () => ({ width: 10 }); if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) }); if (k === 'canvas') return { width: 800, height: 600 }; return noop; }, set(t, k, v) { t[k] = v; return true; } });
const canvas = { getContext: () => ctx, width: 800, height: 600, style: {} };
globalThis.document = { createElement: () => canvas }; globalThis.devicePixelRatio = 1;
const r = createRenderer(canvas);
const view = { W: 800, H: 600, dpr: 1, cam: { x: 0, y: 600, z: 1 } };
const ui = { sel: new Set(), selB: null, selN: null, overlay: 'off', place: null, ghost: null, mode: null, hover: [-9, -9], hoverCells: null, ping: null };
const g = createGame({ seed: 8, sandbox: true }); g.freeBuild = true;
let frames = 0, errors = 0;
const frame = () => { try { r.draw(g, view, ui, frames * 16); frames++; } catch (e) { errors++; if (errors < 4) console.error(e); } };
for (let t = 0; t < 120; t += 0.05) update(g, 0.05);
frame();
// every building kind, at every level, finished and under construction
{ const { addBuilding } = await import('../js/core/state.js'); const { BUILD, TIERS } = await import('../js/core/config.js');
  let x = 1, y = 1;
  for (const k of Object.keys(BUILD)) for (let l = 0; l < (TIERS[k] ? TIERS[k].length : 1); l++) for (const done of [true, false]) {
    const b = addBuilding(g, k, x, y, done); b.lvl = l; x += 3; if (x > 36) { x = 1; y += 3; } if (y > 36) y = 1;
  }
  g.age = 3; for (const tod of [0.3, 0.75]) { g.tod = tod; frame(); }
  console.log('every building drawn:', errors === 0);
}
const { skipToFestival } = await import('../js/core/commands.js');
const seen = [];
for (let n = 0; n < 4; n++) {
  const r = skipToFestival(g);
  for (let k = 0; k < 3000 && !(g.seasonal && g.seasonal.phase === 'on'); k++) update(g, 0.25);
  const F = g.seasonal; seen.push(F && F.phase === 'on' ? F.id : 'none');
  for (let k = 0; k < 60; k++) { update(g, 0.25); frame(); }
  g.tod = 0.75; for (let k = 0; k < 4; k++) frame();   // and at night (lights, lanterns, glow)
  console.log(r.name, '->', seen[n]);
}
console.log(`frames ${frames}, errors ${errors}`);
process.exit(errors || new Set(seen).size !== 4 || seen.includes('none') ? 1 : 0);
