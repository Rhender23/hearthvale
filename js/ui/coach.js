// First-steps hints: one short line at a time, pointing at the thing to touch, moving on as soon as the player does it.
// Teaches by doing (select, give work, look around, resources, build, place, buildings, menu); never blocks play.
// Turned off with "Skip" or the 💡 button in the game menu; turning it back on starts again from the first step.
//   settings.hints (on/off), settings.hintStep (progress)
import { el } from './dom.js';
import { NODE } from '../core/config.js';
import { idx, nodeKind } from '../core/world.js';

export function createCoach({ ui, g, view, settings, toScreen, pop }) {
  const ring = el('div', { id: 'ring', hidden: true });
  const text = el('span', { className: 'co-t' }), skip = el('button', { className: 'co-skip', textContent: 'Skip hints' });
  const box = el('div', { id: 'coach', hidden: true, role: 'status' }, [el('span', { className: 'co-i', textContent: '💡' }), text, skip]);
  document.body.append(ring, box);
  skip.onclick = () => { settings.hints = false; settings.persist(); hide(); };
  let cam0 = null, shown = '';
  const iso = (x, y) => [(x - y) * 32, (x + y) * 16];
  const at = (x, y, lift = 14) => { const [sx, sy] = toScreen(...iso(x, y)); return { x: sx, y: sy - lift * view.cam.z, r: 30 * Math.max(0.8, view.cam.z) }; };
  const elAt = id => { const e = document.getElementById(id); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: Math.max(r.width, r.height) / 2 + 6 }; };
  const awake = () => g().villagers.filter(v => !v.inside && !(v.act && v.act.type === 'sleep'));
  function nearestNode(v) {
    const G = g(); let best = null, bd = 1e9;
    for (let y = Math.max(0, Math.round(v.y) - 8); y < Math.min(40, Math.round(v.y) + 9); y++) for (let x = Math.max(0, Math.round(v.x) - 8); x < Math.min(40, Math.round(v.x) + 9); x++) {
      const k = nodeKind(G.w, idx(x, y)); if (k !== NODE.TREE && k !== NODE.BERRY && k !== NODE.STONE) continue;
      const d = Math.hypot(x - v.x, y - v.y); if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }
  const STEPS = [
    { id: 'select', text: 'Tap a villager to choose them.', target: () => { const v = awake().sort((a, b) => Math.hypot(...toScreen(...iso(a.x, a.y)).map((p, i) => p - [innerWidth / 2, innerHeight / 2][i])) - Math.hypot(...toScreen(...iso(b.x, b.y)).map((p, i) => p - [innerWidth / 2, innerHeight / 2][i])))[0]; return v && at(v.x, v.y, 14); }, done: () => ui.sel.size > 0 },
    { id: 'work', text: 'Now tap a tree, berry bush or rock. They will gather from it.', target: () => { const v = [...ui.sel][0]; const n = v && nearestNode(v); return n && at(n[0], n[1], 14); }, done: () => g().villagers.some(v => v.duty || (v.act && v.act.src === 'player')), skipIf: () => !ui.sel.size, back: 'select' },
    { id: 'look', text: 'Drag the map to look around. Pinch, or use the mouse wheel, to zoom.', target: () => null, done: () => cam0 && (Math.hypot(view.cam.x - cam0.x, view.cam.y - cam0.y) > 120 || Math.abs(view.cam.z - cam0.z) > 0.15) },
    { id: 'res', text: 'Tap 🎒 to see what the village has. Tap again for everything.', target: () => elAt('hudbtn'), done: () => ui.hudOpen },
    { id: 'build', text: 'Tap 🔨 to build. A house gives newcomers a bed.', target: () => elAt('buildbtn'), done: () => ui.buildOpen || !!ui.place },
    { id: 'place', text: 'Choose a building, then tap the ground where it should go and press ✓.', target: () => (ui.place && !ui.ghost ? null : elAt('pop')), done: () => ui.coachPlaced },
    { id: 'building', text: 'Tap any building to see what it does and what you can do with it.', target: () => { const b = g().buildings.find(b => b.k === 'tc' && b.done) || g().buildings.find(b => b.k === 'campfire'); return b && at(b.x, b.y, 30); }, done: () => !!ui.selB },
    { id: 'menu', text: 'Tap 🏡 for the game menu: speed, pause, sound, and these hints.', target: () => elAt('fab'), done: () => ui.menuOpen },
  ];
  function hide() { box.hidden = true; ring.hidden = true; shown = ''; }
  function tick() {
    if (!settings.hints || ui.modal) return hide();
    let i = settings.hintStep || 0;
    while (i < STEPS.length && STEPS[i].done()) { i++; settings.hintStep = i; settings.persist(); cam0 = null; }
    if (i >= STEPS.length) { if (shown !== 'end') { shown = 'end'; text.textContent = 'That is all you need to begin. Turn hints back on any time in the 🏡 menu.'; box.hidden = false; ring.hidden = true; place(null); setTimeout(() => { if (shown === 'end') { settings.hints = false; settings.persist(); hide(); } }, 6000); } return; }
    const s = STEPS[i];
    if (s.id === 'look' && !cam0) cam0 = { ...view.cam };
    if (s.skipIf && s.skipIf() && s.back) { const j = STEPS.findIndex(x => x.id === s.back); settings.hintStep = j; return; }
    if (shown !== s.id) { shown = s.id; text.textContent = s.text; box.hidden = false; }
    const t = s.target();
    if (t) { ring.hidden = false; ring.style.left = (t.x - t.r) + 'px'; ring.style.top = (t.y - t.r) + 'px'; ring.style.width = ring.style.height = (t.r * 2) + 'px'; } else ring.hidden = true;
    place(t);
  }
  // The hint sits near the bottom middle, clear of the bubble and of what it points at.
  function place(t) {
    const w = box.offsetWidth, h = box.offsetHeight, P = pop.root.hidden ? null : pop.root.getBoundingClientRect();
    let top = innerHeight - h - 96;
    if (t && Math.abs(t.y - (top + h / 2)) < t.r + h / 2 + 10) top = Math.max(64, t.y - t.r - h - 16);
    if (P && top < P.bottom + 8 && top + h > P.top - 8) top = P.top - h - 12 > 64 ? P.top - h - 12 : Math.min(innerHeight - h - 10, P.bottom + 12);
    box.style.left = Math.max(10, (innerWidth - w) / 2) + 'px'; box.style.top = top + 'px';
  }
  return { tick, restart() { settings.hints = true; settings.hintStep = 0; settings.persist(); shown = ''; } };
}
