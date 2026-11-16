// Interior art: rooms and furniture rendered from 3D (tools/models/interiors.py → art/interior/), loaded the first time
// a door is opened, not with the game. rooms.json says how big each room and piece is and where the live things go
// (the hearth's firebox, the windows). Until it has loaded, or if a picture is missing, rooms are drawn plainly in code.
const BASE = 'art/interior/';
let state = null;   // { slots: { key: { img, anchor, w, h } }, spec, ready }

export function loadInteriorArt() {
  if (state) return state;
  state = { slots: {}, spec: null, ready: false, pending: 0 };
  try {
    Promise.all([fetch(BASE + 'manifest.json').then(r => (r.ok ? r.json() : null)), fetch(BASE + 'rooms.json').then(r => (r.ok ? r.json() : null))]).then(([m, spec]) => {
      state.spec = spec;
      if (!m) { state.ready = true; return; }
      const entries = Object.entries(m.slots || {});
      // Packed into atlases (tools/pack_atlas.py) when they are there: a few downloads instead of one a picture.
      if (m.atlases) {
        state.pending = m.atlases;
        for (let k = 0; k < m.atlases; k++) {
          const img = new Image();
          img.onload = () => { for (const [key, s] of entries) if (s.atlas === k) state.slots[key] = { img, anchor: s.anchor, sx: s.rect[0], sy: s.rect[1], w: s.rect[2], h: s.rect[3] }; if (--state.pending <= 0) state.ready = true; };
          img.onerror = () => { if (--state.pending <= 0) state.ready = true; };
          img.src = BASE + `atlas-${k}.png`;
        }
        return;
      }
      state.pending = entries.length;
      for (const [key, s] of entries) {
        const img = new Image();
        img.onload = () => { state.slots[key] = { img, anchor: s.anchor, sx: 0, sy: 0, w: img.width, h: img.height }; if (--state.pending <= 0) state.ready = true; };
        img.onerror = () => { if (--state.pending <= 0) state.ready = true; };
        img.src = BASE + s.file;
      }
      if (!entries.length) state.ready = true;
    }).catch(() => { state.ready = true; });
  } catch (e) { state.ready = true; }
  return state;
}
export const art = () => state || loadInteriorArt();
export const spec = () => (art().spec || { rooms: {}, props: {} });
export const roomSpec = style => spec().rooms[style] || { size: [6, 5], wallH: 2.6, hearth: null, windows: [] };
export const propSize = (id, turned) => { const p = spec().props[id]; const s = p ? p.size : [0.8, 0.8]; return turned ? [s[1], s[0]] : s; };
export const has = key => !!art().slots[key];

// Draw a picture with its anchor at (x, y), scaled by k (art is drawn at 2×, so k already includes that).
export function blit(ctx, key, x, y, k) {
  const s = art().slots[key]; if (!s) return false;
  ctx.drawImage(s.img, s.sx, s.sy, s.w, s.h, x - s.anchor[0] * k, y - s.anchor[1] * k, s.w * k, s.h * k);
  return true;
}
