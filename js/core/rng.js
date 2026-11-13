// Seeded randomness. The simulation never calls Math.random directly,
// so a seed fully reproduces a run (used by the tests).
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = n => (next() * n) | 0;
  next.pick = arr => arr[(next() * arr.length) | 0];
  next.state = () => s;
  next.setState = v => { s = v; };
  return next;
}

// Deterministic hash noise used for terrain (kept identical to the original
// game so existing villages load onto the same map).
export const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
export function valueNoise(x, y, s) {
  x /= s; y /= s;
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
