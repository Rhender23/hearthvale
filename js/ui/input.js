// Camera and pointer input: one-finger or mouse drag pans, two fingers pinch-zoom,
// the wheel zooms, a short tap is passed to the interface.
import { N, TW, TH } from '../core/config.js';

export function createInput(canvas, view, ui) {
  const cam = view.cam, P = new Map(), keys = {};
  let drag = null, pinch = null;
  const toWorld = (px, py) => [(px - view.W / 2) / cam.z + cam.x, (py - view.H / 2) / cam.z + cam.y];
  const tileAt = (px, py) => { const [wx, wy] = toWorld(px, py); return [Math.round((wy / (TH / 2) + wx / (TW / 2)) / 2), Math.round((wy / (TH / 2) - wx / (TW / 2)) / 2), wx, wy]; };
  const clampCam = () => { cam.x = Math.max(-N * TW / 2, Math.min(N * TW / 2, cam.x)); cam.y = Math.max(0, Math.min(N * TH, cam.y)); cam.z = Math.max(0.6, Math.min(1.8, cam.z)); };

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]);
    if (P.size > 1) { drag = null; pinch = null; return; }
    drag = { x: e.clientX, y: e.clientY, moved: false, btn: e.button };   // right or middle button: pan only, never a tap
  });
  canvas.addEventListener('pointermove', e => {
    const [rx, ry] = tileAt(e.clientX, e.clientY); ui.hoverAt(rx, ry);
    if (P.has(e.pointerId)) P.set(e.pointerId, [e.clientX, e.clientY]);
    if (P.size >= 2) {
      const [a, b] = [...P.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (pinch) { cam.z *= d / pinch.d; cam.x -= (m[0] - pinch.m[0]) / cam.z; cam.y -= (m[1] - pinch.m[1]) / cam.z; clampCam(); }
      pinch = { d, m }; return;
    }
    if (!drag) return;
    if (e.pointerType === 'mouse' && e.buttons === 0) { P.delete(e.pointerId); drag = null; return; }   // the button came up outside the game
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 8) drag.moved = true;
    if (drag.moved) { cam.x -= dx / cam.z; cam.y -= dy / cam.z; drag.x = e.clientX; drag.y = e.clientY; clampCam(); }
  });
  const end = e => {
    P.delete(e.pointerId); if (P.size < 2) pinch = null;
    if (e.type === 'pointerup' && drag && !drag.moved && !drag.btn && !P.size) { const [rx, ry, wx, wy] = tileAt(e.clientX, e.clientY); ui.tap(rx, ry, wx, wy); }
    drag = null;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.z *= e.deltaY < 0 ? 1.1 : 0.91; clampCam(); }, { passive: false });
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); ui.place = null; ui.mode = null; });
  // Shortcuts with Cmd, Ctrl or Alt belong to the browser. (A Mac sends no key-up for letters while Cmd is held, so a
  // held letter would otherwise keep the camera moving.)
  addEventListener('keydown', e => { if (e.metaKey || e.ctrlKey || e.altKey) { for (const k in keys) keys[k] = false; return; } if (!ui.modal && !(e.target && e.target.tagName === 'INPUT')) keys[e.key.toLowerCase()] = true; });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; P.clear(); drag = null; pinch = null; });

  return {
    tick(dt) {
      if (ui.modal) return;
      const sp = 520 * dt / cam.z;
      if (keys.arrowleft || keys.a) cam.x -= sp; if (keys.arrowright || keys.d) cam.x += sp;
      if (keys.arrowup || keys.w) cam.y -= sp; if (keys.arrowdown || keys.s) cam.y += sp;
      clampCam();
    },
  };
}
