// Entry point: wires the core simulation to the browser (drawing, input, menus, sound, saving).
import { SAVE_KEY, LEGACY_KEY, N, TH } from './core/config.js';
import { createGame, update } from './core/game.js';
import { serialize, deserialize, migrateLegacy } from './core/save.js';
import { createRenderer } from './ui/render.js';
import { createUI } from './ui/ui.js';
import { createInput } from './ui/input.js';
import { createAudio } from './ui/audio.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } },
};
const settings = Object.assign({ sound: true, volume: 0.7, sandbox: store.get('hv-sbx') !== '0', speed: 1, hints: true, hintStep: 0 }, JSON.parse(store.get('hv-settings') || '{}'));
settings.persist = () => store.set('hv-settings', JSON.stringify({ sound: settings.sound, volume: settings.volume, sandbox: settings.sandbox, speed: settings.speed, hints: settings.hints, hintStep: settings.hintStep }));

let game = null, loadedFrom = 'new';
function loadGame() {
  const s = store.get(SAVE_KEY);
  if (s) { try { loadedFrom = 'save'; return deserialize(s); } catch (e) { console.warn('Save could not be read', e); } }
  const old = store.get(LEGACY_KEY);
  if (old) { try { loadedFrom = 'legacy'; return migrateLegacy(old); } catch (e) { console.warn('Old save could not be migrated', e); } }
  loadedFrom = 'new';
  return createGame({ seed: 0, sandbox: settings.sandbox });
}
game = loadGame();
const save = () => store.set(SAVE_KEY, serialize(game));

const canvas = document.getElementById('c');
const view = { W: 0, H: 0, dpr: 1, cam: { x: 0, y: N * TH / 2, z: 1 } };
function resize() {
  view.dpr = Math.min(window.devicePixelRatio || 1, 2.5); view.W = innerWidth; view.H = innerHeight;
  canvas.width = view.W * view.dpr; canvas.height = view.H * view.dpr;
  canvas.style.width = view.W + 'px'; canvas.style.height = view.H + 'px';
}
addEventListener('resize', resize); resize();
view.cam.z = view.W < 600 ? 0.85 : 1.1;

const audio = createAudio();
audio.setOn(settings.sound); audio.setVolume(settings.volume);
const renderer = createRenderer(canvas);
const ui = createUI({
  getGame: () => game, view, settings, save, audio, heightOf: (b, age) => renderer.heightOf(b, age),
  newGame() {
    store.del(SAVE_KEY);
    game = createGame({ seed: 1 + (Date.now() % 999983), sandbox: settings.sandbox });
    audio.bind(game); ui.rebind(); view.cam.x = 0; view.cam.y = N * TH / 2; save();
    ui.toast('A new village begins.');
  },
});
const input = createInput(canvas, view, ui);
audio.bind(game);
addEventListener('pointerdown', () => audio.start(), { once: true });

if (loadedFrom === 'legacy') { save(); setTimeout(() => ui.toast('Welcome back. Your village moved into the new Hearthvale.'), 400); }
else if (loadedFrom === 'save') setTimeout(() => ui.toast('Welcome back. Your village was restored.'), 400);

setInterval(save, 45000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = Math.max(last, now); // first frame can arrive "before" start
  try {
    if (!ui.paused) for (let k = 0; k < settings.speed; k++) update(game, dt); // game speed: run the simulation more often, never in bigger steps
    input.tick(dt); ui.sync(); renderer.draw(game, view, ui, now);
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__hv = { get game() { return game; }, ui, view }; // handy for testing in the console
import('./core/state.js').then(st => { window.__hvAdd = (k, x, y) => st.completeBuilding(game, st.addBuilding(game, k, x, y, false)); });
