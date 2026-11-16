// Art slots: your images replace the drawn shapes one piece at a time. Every object asks here first, by slot name;
// a slot with an image is drawn from it, otherwise the object falls back to the shapes drawn in code. So art can arrive
// a piece at a time and the game never breaks.
//
// art/manifest.json (written by tools/trim.py; also fine to edit by hand):
//   { "scale": 0.5,                          art is drawn at 2× (a tile is 128×64 in the file, 64×32 on screen)
//     "slots": {
//       "building/house/0": { "file": "building-house-0.png" },
//       "villager/walk":    { "file": "villager-walk.png", "frames": 4, "fps": 8 },
//       "node/tree/winter": { "file": "node-tree-winter.png", "anchor": [64, 180] } } }
//   file    the PNG inside art/
//   frames  a sprite sheet of this many frames side by side (default 1); fps how fast they play (default 6)
//   anchor  the pixel in the image (one frame) that sits on the object's ground point. Default: bottom centre.
//           Ground point: a building's front corner, a tile's centre, a villager's or animal's feet.
//   scale   per-slot override of the global scale
// Overlays: a slot "<name>-snow" is drawn on top in winter, "<name>-night" on top after dusk (fading in with the dark).
//
// Slot names try the most specific first, e.g. a level-2 house in winter: building/house/2/winter → building/house/2 →
// building/house/winter → building/house. The full list of slots is art/SLOTS.md (node tools/slots.mjs).
export function createSprites(base = 'art/') {
  const slots = {};
  let scale = 0.5, loaded = 0;
  try {
    fetch(base + 'manifest.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(m => {
      if (!m) return;
      scale = m.scale ?? scale;
      // Packed into atlases (tools/pack_atlas.py): a few big sheets, each slot a rectangle on one. Else one file a slot.
      const sheets = Array.from({ length: m.atlases || 0 }, (_, k) => { const i = new Image(); i.src = base + `atlas-${k}.png`; return i; });
      for (const [key, s] of Object.entries(m.slots || {})) {
        if (s.rect && sheets[s.atlas]) {
          const img = sheets[s.atlas], set = () => { slots[key] = { ...s, img, sx: s.rect[0], sy: s.rect[1], fw: s.rect[2] / (s.frames || 1), fh: s.rect[3] }; loaded++; };
          if (img.complete && img.naturalWidth) set(); else img.addEventListener('load', set, { once: true });
          continue;
        }
        const img = new Image();
        img.onload = () => { slots[key] = { ...s, img, sx: 0, sy: 0, fw: img.width / (s.frames || 1), fh: img.height }; loaded++; };
        img.src = base + s.file;
      }
    }).catch(() => {});
  } catch (e) { /* no fetch (tests): everything stays drawn in code */ }

  const pick = keys => { for (const k of keys) if (slots[k]) return k; return null; };
  function blit(ctx, s, x, y, o) {
    const k = (s.scale ?? scale) * (o.mul || 1), n = s.frames || 1;
    const f = n > 1 ? (s.random ? (o.seed || 0) % n : Math.floor((o.t || 0) * (s.fps || 6)) % n) : 0;   // "random": true picks a frame by position (variety), not time
    const ax = s.anchor ? s.anchor[0] : s.fw / 2, ay = s.anchor ? s.anchor[1] : (o.centre ? s.fh / 2 : s.fh);
    if (o.flip) { ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(s.img, s.sx + f * s.fw, s.sy, s.fw, s.fh, -ax * k, -ay * k, s.fw * k, s.fh * k); ctx.restore(); }
    else ctx.drawImage(s.img, s.sx + f * s.fw, s.sy, s.fw, s.fh, x - ax * k, y - ay * k, s.fw * k, s.fh * k);
  }
  return {
    // Draw the first slot of `keys` that has an image, at ground point (x, y). Returns false when none does.
    //   o: { t: seconds (animation), flip: mirror, winter: bool, night: 0..1, seed: picks a "random" variant,
    //        mul: size multiplier (a growing sapling), centre: default anchor is the image centre (ground tiles) }
    draw(ctx, keys, x, y, o = {}) {
      const key = pick(keys); if (!key) return false;
      blit(ctx, slots[key], x, y, o);
      if (o.winter && slots[key + '-snow']) blit(ctx, slots[key + '-snow'], x, y, o);
      if (o.night > 0 && slots[key + '-night']) { const a = ctx.globalAlpha; ctx.globalAlpha = a * Math.min(1, o.night); blit(ctx, slots[key + '-night'], x, y, o); ctx.globalAlpha = a; }
      return true;
    },
    has: keys => !!pick(Array.isArray(keys) ? keys : [keys]),
    get count() { return loaded; },
  };
}

// The slot names an object asks for, most specific first.
export const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'];
export function chain(base, ...parts) {
  // chain('building/house', 2, 'winter') → building/house/2/winter, building/house/2, building/house/winter, building/house
  const out = [];
  const n = parts.length;
  for (let mask = (1 << n) - 1; mask >= 0; mask--) {
    const used = parts.filter((p, i) => mask & (1 << (n - 1 - i)) && p !== undefined && p !== null);
    if (used.length !== parts.filter((p, i) => mask & (1 << (n - 1 - i))).length) continue;
    out.push([base, ...used].join('/'));
  }
  return [...new Set(out)];
}
