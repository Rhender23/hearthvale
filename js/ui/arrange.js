// Rearranging a home (homes only): press on a bed or a piece and drag it; tap it for Turn, Put away and
// Take upstairs/downstairs; Furnish to buy a new piece and tap where it goes; ▲/▼ to switch floors.
// The layout itself lives in core/furnish.js and is saved with the home; this module is only the hands.
import { PIECES, FURNITURE, TREASURES, canAfford, placePiece, moveItem, turnItem, putAway, itemsOn, floorsOf, BACK_D, syncLayout } from '../core/furnish.js';
import { CRITTERS, critterLeft, HOME_DECOR } from '../core/critters.js';
import { fmt } from './dom.js';

// Screen point back to room units at depth d (the inverse of geom().P).
export function roomAt(G, W, H, px, py, fixedD) {
  const d = fixedD != null ? fixedD : Math.max(0, Math.min(1, (py - G.by1) / (H - G.by1)));
  const span = (G.bx1 - G.bx0) * (1 - d) + W * d, u = (px - G.bx0 * (1 - d)) / span;
  return [u, d];
}
// Roughly where an item shows on screen, for taps: [left, top, right, bottom].
function boxOf(G, item) {
  const { u, d } = item.ref, [x, y] = G.P(u, d), m = G.M(d);
  const p = item.kind === 'bed' ? { w: 2.0, h: 0.9 } : PIECES[item.ref.id], w = Math.max(0.5, p.w) * m, h = Math.max(0.35, p.h || 0.3) * m;
  return [x - w / 2, y - h - 0.1 * m, x + w / 2, y + 0.2 * m];
}
export const nameOf = item => (item.kind === 'bed' ? 'Bed' : PIECES[item.ref.id].name);

export function createArrange({ g, b, cv, G, W, H, st, say, mk }) {
  st.floor = st.floor || 0;
  const hit = (px, py) => {
    const list = itemsOn(b, st.floor).sort((a, z) => z.ref.d - a.ref.d);   // the nearest first
    return list.find(it => { const [l, t, r, bo] = boxOf(G, it); return px >= l && px <= r && py >= t && py <= bo; }) || null;
  };
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  function down(e) {
    const [px, py] = local(e);
    if (st.mode === 'place') {
      const p = PIECES[st.piece], [u, d] = roomAt(G, W, H, px, py, p.spot === 'back' ? BACK_D : null);
      const res = placePiece(g, b, st.piece, u, d, st.floor);
      if (res.ok) { st.mode = null; st.piece = null; st.sel = { kind: 'piece', ref: res.f }; say(`${p.name} placed. Drag it to fine-tune.`); } else say(res.reason);
      return;
    }
    const it = hit(px, py);
    if (!it) { if (st.sel) { st.sel = null; say(''); } return; }
    st.sel = it; st.open = false;
    const [fx, fy] = G.P(it.ref.u, it.ref.d);
    st.drag = { item: it, dx: fx - px, dy: fy - py, moved: false, x: px, y: py };
    cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
    say('');
  }
  function move(e) {
    const D = st.drag; if (!D) return;
    const [px, py] = local(e);
    if (!D.moved && Math.hypot(px - D.x, py - D.y) < 5) return;
    D.moved = true;
    const back = D.item.kind === 'piece' && PIECES[D.item.ref.id].spot === 'back';
    const [u, d] = roomAt(G, W, H, px + D.dx, py + D.dy, back ? BACK_D : null);
    moveItem(b, D.item, u, d);
  }
  function up() { st.drag = null; }

  // The tools under the room.
  let key = '';
  function tools(el) {
    syncLayout(b);
    const floors = floorsOf(b), sel = st.sel && (st.sel.kind === 'bed' ? (b.beds || []).includes(st.sel.ref) : (b.furn || []).includes(st.sel.ref)) ? st.sel : (st.sel = null);
    const k = [st.mode, st.piece, sel && sel.ref.floor, sel && nameOf(sel), st.tab, st.open, st.msg, st.floor, floors, FURNITURE.concat(TREASURES).map(id => +canAfford(g, id)).join(''), (b.furn || []).length].join('|');
    if (k === key) return; key = k;
    const btn = (txt, cls, on) => { const e = mk('button', cls, txt); e.onclick = () => { on(); key = ''; }; return e; };
    const row = (...kids) => { const r = mk('div', 'pop-yn'); r.append(...kids); return r; };
    const kids = [];
    if (floors > 1) kids.push(row(btn('▼ Downstairs', 'pbtn' + (st.floor === 0 ? ' on' : ''), () => { st.floor = 0; st.sel = null; }), btn('▲ Upstairs', 'pbtn' + (st.floor === 1 ? ' on' : ''), () => { st.floor = 1; st.sel = null; })));
    if (st.msg) kids.push(mk('small', 'in-msg', st.msg));
    if (sel) {
      kids.push(mk('b', null, nameOf(sel)));
      const r = row(btn('✕', 'pbtn', () => { st.sel = null; say(''); }), btn('🔄 Turn', 'pbtn', () => turnItem(sel)));
      if (floors > 1) r.append(btn(st.floor ? '▼ Take downstairs' : '▲ Take upstairs', 'pbtn', () => { const to = st.floor ? 0 : 1; moveItem(b, sel, sel.ref.u, sel.ref.d, to); st.sel = null; say(`${nameOf(sel)} taken ${to ? 'upstairs' : 'downstairs'}.`); }));
      if (sel.kind === 'piece') r.append(btn('📦 Put away', 'pbtn', () => { const p = PIECES[sel.ref.id]; putAway(g, b, sel); st.sel = null; say(p.treasure ? 'Put away. The critters are back in your collection.' : 'Put away. What it cost is back in the stores.'); }));
      kids.push(r, mk('small', null, 'Drag it to move it.'));
    } else if (st.mode === 'place') {
      kids.push(mk('b', null, `${PIECES[st.piece].icon} ${PIECES[st.piece].name}`), row(btn('✕ Cancel', 'pbtn', () => { st.mode = null; st.piece = null; say(''); })));
    } else if (!st.open) {
      kids.push(row(btn('🛋️ Furnish', 'pbtn primary', () => { st.open = true; say('Choose a piece, then tap where it should go. Drag anything to move it.'); })), mk('small', null, 'Drag beds and furniture to move them; tap one to turn it.'));
    } else {
      const tabs = mk('div', 'tabs');
      for (const [id, label] of [['furniture', 'Furniture'], ['treasures', 'Treasures']]) tabs.append(btn(label, 'tab' + (st.tab === id ? ' on' : ''), () => { st.tab = id; }));
      tabs.append(btn('Done', 'tab', () => { st.open = false; say(''); }));
      const grid = mk('div', 'cards');
      for (const id of st.tab === 'furniture' ? FURNITURE : TREASURES) {
        const p = PIECES[id], c = mk('button', 'card');
        const price = p.treasure ? `${HOME_DECOR[id] ? HOME_DECOR[id].n : 0} ${CRITTERS[p.critter].icon} (you have ${critterLeft(g, p.critter)})` : fmt(p.cost);
        c.append(mk('span', 'cn', `${p.icon} ${p.name}`), mk('small', null, p.age > g.age ? 'Comes with a later age' : price));
        c.disabled = !canAfford(g, id) || (p.treasure && (b.decor || []).includes(id));
        c.onclick = () => { st.mode = 'place'; st.piece = id; st.sel = null; say(`Tap where it should go${p.spot === 'back' ? ', against the back wall' : ''}.`); key = ''; };
        grid.append(c);
      }
      kids.push(tabs, grid);
    }
    el.replaceChildren(...kids);
  }
  return { down, move, up, tools, refresh: () => { key = ''; } };
}
