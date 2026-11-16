// The bottom sheet: longer lists (build menu, upgrades, market, details). It slides up from the bottom with a grab handle,
// rests half open or full, and closes when swiped down or when its ✕ is tapped. On wide screens (iPad) it floats as a
// panel at the bottom left, so the map stays in view.
//
//   sheet.open({ key, title, build, refresh, full })
import { el, reduceMotion } from './dom.js';

export function createSheet() {
  const handle = el('div', { className: 'sh-handle' }), title = el('b', { className: 'sh-title' }), x = el('button', { className: 'sh-x', textContent: '✕' });
  x.setAttribute('aria-label', 'Close');
  const head = el('div', { className: 'sh-head' }, [handle, title, x]), body = el('div', { className: 'sh-body' });
  const root = el('div', { id: 'sheet', className: 'sheet', hidden: true }, [head, body]);
  root.setAttribute('role', 'dialog');
  document.body.append(root);
  let spec = null, onClose = null;
  const opened = [];   // called whenever a sheet opens: the one-thing-at-a-time rule (ui.js tidies notes, tips, the bubble)

  function open(s) {
    const same = spec && spec.key === s.key && !root.hidden;
    spec = s; onClose = s.onClose || null;
    title.textContent = s.title || '';
    body.replaceChildren(); s.build(body);
    root.classList.toggle('full', !!s.full);
    if (!same) { for (const f of opened) f(s.key); root.hidden = false; root.classList.remove('in'); if (!reduceMotion()) { void root.offsetWidth; root.classList.add('in'); } }
  }
  function close() { if (root.hidden) return; root.hidden = true; const f = onClose; spec = null; onClose = null; f && f(); }
  function rebuild() { if (spec && !root.hidden) { body.replaceChildren(); spec.build(body); } }
  function tick() { if (spec && !root.hidden && spec.refresh) spec.refresh(body); }
  x.onclick = close;

  // Swipe the head down to close, up to open fully.
  let drag = null;
  head.addEventListener('pointerdown', e => { if (e.target === x) return; drag = { y: e.clientY, dy: 0 }; head.setPointerCapture(e.pointerId); });
  head.addEventListener('pointermove', e => { if (!drag) return; drag.dy = e.clientY - drag.y; root.style.transform = `translateY(${Math.max(0, drag.dy)}px)`; });
  const end = () => {
    if (!drag) return; const dy = drag.dy; drag = null; root.style.transform = '';
    if (dy > 70) close(); else if (dy < -50) root.classList.add('full'); else if (Math.abs(dy) < 4) root.classList.toggle('full');
  };
  head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
  // Pulling down on the list when it is already at its top closes the sheet too (like a phone's own sheets).
  let pull = null;
  body.addEventListener('touchstart', e => { pull = body.scrollTop <= 0 ? { y: e.touches[0].clientY, dy: 0 } : null; }, { passive: true });
  body.addEventListener('touchmove', e => { if (!pull) return; pull.dy = e.touches[0].clientY - pull.y; if (pull.dy > 0 && body.scrollTop <= 0) root.style.transform = `translateY(${Math.min(160, pull.dy * 0.6)}px)`; else if (pull.dy < 0) { pull = null; root.style.transform = ''; } }, { passive: true });
  body.addEventListener('touchend', () => { if (!pull) return; const dy = pull.dy; pull = null; root.style.transform = ''; if (dy > 110) close(); });
  return { open, close, rebuild, tick, root, onOpen: f => opened.push(f), get key() { return spec && !root.hidden ? spec.key : null; } };
}
