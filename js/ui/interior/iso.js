// The room's view: the game's own 2:1 isometric, in metres. x runs along the back wall (to the lower right on screen),
// z away from it (to the lower left), y up. The room's front corner (W, 0, D) sits at the screen point (ax, ay).
// One metre of x is (64, 32) art pixels, one of z (−64, 32), one of y (0, −78.4); k scales art pixels to the canvas.
export const UX = [64, 32], UZ = [-64, 32], UY = [0, -78.38];

export function createView(W, D, k, ax, ay, dpr = 1) {
  const pt = (x, y, z) => [ax + k * (UX[0] * (x - W) + UZ[0] * (z - D)), ay + k * (UX[1] * (x - W) + UZ[1] * (z - D) + UY[1] * y)];
  // A floor point (y = 0) under a screen point.
  const floorAt = (px, py) => { const a = (px - ax) / (k * 64), b = (py - ay) / (k * 32); return [(a + b) / 2 + W, (b - a) / 2 + D]; };
  // Draw on a plane with ctx.setTransform: on the back wall (z = 0) units are (x, y up); on the left wall (x = 0) (z, y up);
  // on the floor (x, z).
  const q = dpr, onBack = (ctx, z = 0.02) => { const o = pt(0, 0, z); ctx.setTransform(q * k * UX[0], q * k * UX[1], 0, q * k * UY[1], q * o[0], q * o[1]); };
  const onLeft = (ctx, x = 0.02) => { const o = pt(x, 0, 0); ctx.setTransform(q * k * UZ[0], q * k * UZ[1], 0, q * k * UY[1], q * o[0], q * o[1]); };
  const onFloor = (ctx, y = 0.005) => { const o = pt(0, y, 0); ctx.setTransform(q * k * UX[0], q * k * UX[1], q * k * UZ[0], q * k * UZ[1], q * o[0], q * o[1]); };
  const reset = ctx => ctx.setTransform(q, 0, 0, q, 0, 0);   // back to plain canvas pixels
  const m = k * 78.38;   // pixels per metre, upright (for sizing figures and flames)
  return { W, D, k, pt, floorAt, onBack, onLeft, onFloor, reset, m };
}
