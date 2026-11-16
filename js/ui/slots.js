// Save slots: five named places to keep a village, each with a little picture, its age, day and size.
// The village you are playing also saves on its own (the autosave); a slot is a copy you choose to keep.
//   const slots = createSlots(store)  -> list(), write(i, text, meta), read(i), rename(i, name), clear(i)
export const SLOT_COUNT = 5;
const key = i => 'hv-slot-' + i, metaKey = i => 'hv-slot-meta-' + i;

export function createSlots(store) {
  const meta = i => { try { return JSON.parse(store.get(metaKey(i)) || 'null'); } catch (e) { return null; } };
  return {
    list() { return Array.from({ length: SLOT_COUNT }, (_, i) => ({ i, meta: meta(i) })); },
    read(i) { return store.get(key(i)); },
    write(i, text, m) {
      const old = meta(i);
      if (!store.set(key(i), text)) return false;
      return store.set(metaKey(i), JSON.stringify({ ...m, name: (old && old.name) || m.name }));
    },
    rename(i, name) { const m = meta(i); if (m) { m.name = name; store.set(metaKey(i), JSON.stringify(m)); } },
    clear(i) { store.del(key(i)); store.del(metaKey(i)); },
  };
}

// A small picture of what is on screen now, for the slot card.
export function snapshot(canvas, w = 192, h = 128) {
  try {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const s = Math.max(w / canvas.width, h / canvas.height), sw = w / s, sh = h / s;
    c.getContext('2d').drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2, sw, sh, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.6);
  } catch (e) { return null; }
}

export const whenText = t => {
  const d = new Date(t), now = new Date(), same = d.toDateString() === now.toDateString();
  return same ? 'Today ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};
