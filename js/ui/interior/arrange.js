// Rearranging a home (homes only), in the room's isometric view: press on a bed or a piece and drag it across the floor; tap it for Turn, Put away and
// Take upstairs/downstairs; Furnish to buy a new piece and tap where it goes; ▲/▼ to switch floors.
// The layout itself lives in core/furnish.js and is saved with the home; this module is only the hands.
import { PIECES, FURNITURE, TREASURES, canAfford, placePiece, moveItem, turnItem, putAway, itemsOn, floorsOf, BACK_D, syncLayout, removeBed, addBed, FLOOR_NAMES } from '../../core/furnish.js';
import { beds } from '../../core/state.js';
import { CRITTERS, critterLeft, HOME_DECOR } from '../../core/critters.js';
import { fmt } from '../dom.js';

export const nameOf = item => (item.kind === 'bed' ? ((item.ref.n || 1) > 1 ? 'Bunk beds' : 'Bed') : PIECES[item.ref.id].name);

export function createArrange({ g, b, cv, R, st, say, mk }) {
  st.floor = st.floor || 0;
  const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  // The nearest movable thing under the pointer (beds and placed pieces; the house's own things stay put).
  // Of everything whose picture is under the pointer, the one whose footprint is nearest it (so a chair beside a bed can
  // still be picked up).
  const hit = (px, py) => {
    const near = p => { const [cx, cy] = R.V.pt(p.x, 0.3, p.z); return Math.hypot(px - cx, py - cy); };
    return R.placed.filter(p => p.item && p.box && px >= p.box[0] && px <= p.box[2] && py >= p.box[1] && py <= p.box[3]).sort((a, z) => near(a) - near(z))[0] || null;
  };
  const toRoom = (px, py) => { const V = R.V, [x, z] = V.floorAt(px, py); return [x / V.W, z / V.D]; };

  function down(e) {
    if (!R.V) return;
    const [px, py] = local(e);
    if (st.mode === 'place') {
      const p = PIECES[st.piece], [u, d] = toRoom(px, py);
      const res = placePiece(g, b, st.piece, u, p.spot === 'back' ? BACK_D : d, st.floor);
      if (res.ok) { st.mode = null; st.piece = null; st.sel = { kind: 'piece', ref: res.f }; say(`${p.name} placed. Drag it to fine-tune.`); } else say(res.reason);
      return;
    }
    const p = hit(px, py);
    if (!p) { if (st.sel) { st.sel = null; say(''); } return; }
    st.sel = p.item; st.open = false;
    const [u, d] = toRoom(px, py);
    st.drag = { item: p.item, du: p.item.ref.u - u, dd: p.item.ref.d - d, moved: false, x: px, y: py };
    cv.setPointerCapture && cv.setPointerCapture(e.pointerId);
    say('');
  }
  function move(e) {
    const D = st.drag; if (!D) return;
    const [px, py] = local(e);
    if (!D.moved && Math.hypot(px - D.x, py - D.y) < 5) return;
    D.moved = true;
    const back = D.item.kind === 'piece' && PIECES[D.item.ref.id].spot === 'back', [u, d] = toRoom(px, py);
    // only where it fits: snapped to the room's 25 cm slots, never on another piece or the walkway
    const p = R.placed.find(q => q.item && q.item.ref === D.item.ref), V = R.V;
    if (!p || !R.grid) return;
    const snap = v => Math.round(v / 0.25) * 0.25;
    const cx = snap((u + D.du) * V.W - p.w / 2) + p.w / 2, cz = back ? p.d / 2 : snap((d + D.dd) * V.D - p.d / 2) + p.d / 2;
    st.blocked = !R.grid.free(cx - p.w / 2, cz - p.d / 2, p.w, p.d, D.item.ref);
    if (!st.blocked) { D.item.ref.u = cx / V.W; D.item.ref.d = cz / V.D; }
  }
  function up() { st.drag = null; st.blocked = false; }

  // The tools under the room.
  let key = '';
  function tools(el) {
    syncLayout(b);
    const floors = floorsOf(b), sel = st.sel && (st.sel.kind === 'bed' ? (b.beds || []).includes(st.sel.ref) : (b.furn || []).includes(st.sel.ref)) ? st.sel : (st.sel = null);
    const k = [st.mode, st.piece, sel && sel.ref.floor, sel && nameOf(sel), b.bedsOff, beds(b), st.tab, st.open, st.msg, st.floor, floors, FURNITURE.concat(TREASURES).map(id => +canAfford(g, id)).join(''), (b.furn || []).length].join('|');
    if (k === key) return; key = k;
    const btn = (txt, cls, on) => { const e = mk('button', cls, txt); e.onclick = () => { on(); key = ''; }; return e; };
    const row = (...kids) => { const r = mk('div', 'pop-yn'); r.append(...kids); return r; };
    const kids = [];
    if (floors > 1) kids.push(row(...FLOOR_NAMES.slice(0, floors).map((n, f) => btn(['▼ Downstairs', '▲ Upstairs', '▲▲ Attic'][f], 'pbtn' + (st.floor === f ? ' on' : ''), () => { st.floor = f; st.sel = null; }))));
    if (st.msg) kids.push(mk('small', 'in-msg', st.msg));
    if (sel) {
      kids.push(mk('b', null, nameOf(sel)));
      const r = row(btn('✕', 'pbtn', () => { st.sel = null; say(''); }), btn('🔄 Turn', 'pbtn', () => turnItem(sel)));
      if (floors > 1) { const to = (st.floor + 1) % floors; r.append(btn(`⇅ To ${FLOOR_NAMES[to]}`, 'pbtn', () => { moveItem(b, sel, sel.ref.u, sel.ref.d, to); st.sel = null; say(`${nameOf(sel)} moved to ${FLOOR_NAMES[to]}.`); })); }
      if (sel.kind === 'bed') r.append(btn('🗑 Remove', 'pbtn', () => { const res = removeBed(b, sel.ref); st.sel = null; say(res.ok ? `A bed taken away: ${beds(b)} can live here now.` : res.reason); }));
      if (sel.kind === 'piece') r.append(btn('📦 Put away', 'pbtn', () => { const p = PIECES[sel.ref.id]; putAway(g, b, sel); st.sel = null; say(p.treasure ? 'Put away. The critters are back in your collection.' : 'Put away. What it cost is back in the stores.'); }));
      kids.push(r, mk('small', null, 'Drag it to move it.'));
    } else if (st.mode === 'place') {
      kids.push(mk('b', null, `${PIECES[st.piece].icon} ${PIECES[st.piece].name}`), row(btn('✕ Cancel', 'pbtn', () => { st.mode = null; st.piece = null; say(''); })));
    } else if (!st.open) {
      kids.push(row(btn('🛋️ Furnish', 'pbtn primary', () => { st.open = true; say('Choose a piece, then tap where it should go. Drag anything to move it.'); }), ...(b.bedsOff > 0 ? [btn('🛏️ Add a bed', 'pbtn', () => { addBed(b); say(`A bed put back: ${beds(b)} can live here.`); })] : [])), mk('small', null, 'Drag beds and furniture to move them; tap one to turn or remove it.'));
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
