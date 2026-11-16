// Making rooms work: every room is a grid of 25 cm slots. Furniture takes the slots under it, and nothing may share a
// slot. Some slots are kept clear: the doorway, a walkway from the door to the hearth, the table and every bed, the
// hearth itself and the stairs. A piece that would land on taken slots is moved to the nearest free spot (or, for the
// house's own odds and ends, left out); while dragging, a piece only goes where it fits.
export const CELL = 0.25;

export function createGrid(W, D) {
  const nx = Math.ceil(W / CELL), nz = Math.ceil(D / CELL), cells = new Array(nx * nz).fill(null);
  const span = (x0, z0, w, d) => [Math.max(0, Math.floor(x0 / CELL + 1e-6)), Math.max(0, Math.floor(z0 / CELL + 1e-6)), Math.min(nx, Math.ceil((x0 + w) / CELL - 1e-6)), Math.min(nz, Math.ceil((z0 + d) / CELL - 1e-6))];
  const inside = (x0, z0, w, d) => x0 >= -1e-6 && z0 >= -1e-6 && x0 + w <= W + 1e-6 && z0 + d <= D + 1e-6;
  function take(x0, z0, w, d, tag) { const [a, b, c, e] = span(x0, z0, w, d); for (let j = b; j < e; j++) for (let i = a; i < c; i++) if (!cells[j * nx + i]) cells[j * nx + i] = tag; }
  function free(x0, z0, w, d, self) {
    if (!inside(x0, z0, w, d)) return false;
    const [a, b, c, e] = span(x0, z0, w, d);
    for (let j = b; j < e; j++) for (let i = a; i < c; i++) { const t = cells[j * nx + i]; if (t && t !== self) return false; }
    return true;
  }
  // The nearest free spot for a piece centred near (cx, cz), searching outward slot by slot (up to `reach` metres).
  function nearest(cx, cz, w, d, self, reach = 2.5) {
    const snap = v => Math.round(v / CELL) * CELL;
    let best = null, bd = 1e9;
    const R = Math.ceil(reach / CELL);
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const x = snap(cx - w / 2) + i * CELL, z = snap(cz - d / 2) + j * CELL, dist = Math.hypot(i, j);
      if (dist >= bd) continue;
      if (free(x, z, w, d, self)) { best = [x + w / 2, z + d / 2]; bd = dist; }
    }
    return best;
  }
  return { W, D, take, free, nearest, cells, nx, nz };
}

// The slots a home keeps clear on a floor (metres): the doorway on the left wall near the front, and a walkway from it
// along the front and up between the furniture; upstairs, a walkway down the middle and over to the stairwell.
export function homeAisles(W, D, floor, floors, hearth) {
  const out = [], w = 0.75;
  if (floor === 0) {
    out.push([0, D - 1.2, 1.1, 1.2]);                                     // inside the door
    const col = floors > 1 ? W * 0.55 : Math.max(W * 0.45, W - 2.45);     // between the table and the beds
    out.push([0, D - 1.0, col + w / 2, 0.7]);                             // along the front
    out.push([col - w / 2, D * 0.3, w, D * 0.7]);                         // up the middle
    if (hearth && hearth.kind !== 'pit') out.push([0, hearth.z - hearth.w / 2 - 0.25, 1.2, hearth.w + 0.5]);   // the hearthstone
    if (hearth && hearth.kind === 'pit') out.push([hearth.x - 0.6, hearth.z - 0.6, 1.2, 1.2]);
  } else {
    out.push([W / 2 - w / 2, 0.5, w, D - 0.5]);                           // down the middle
    out.push([W / 2, D * 0.4 - w / 2, W / 2 - 1.1, w]);                   // over to the stairwell
  }
  return out;
}
