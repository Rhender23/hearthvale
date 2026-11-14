// The bubble menu: opens beside what was tapped, above it (below when there is no room), with a little arrow pointing at
// it, and follows it as it moves or the map pans. One bubble at a time. Confirmations happen inside it.
//
//   pop.open({ key, at, build, refresh })
//     key      what it is for; opening the same key again keeps the bubble (no flicker)
//     at()     where it points, in screen pixels: { x, top, bottom } (the target's top and foot), or an element
//     build(b) fills the bubble body (called on open and after a cancelled confirmation)
//     refresh  optional, called every frame while open (live text, button states)
//   pop.confirm({ text, ok, danger, onOk })  swaps the body for a question with Cancel and the action
import { el, reduceMotion } from './dom.js';

const GAP = 12, EDGE = 10;

export function createPopover() {
  const arrow = el('div', { className: 'pop-arrow' }), body = el('div', { className: 'pop-body' });
  const root = el('div', { id: 'pop', className: 'pop', hidden: true }, [body, arrow]);
  root.setAttribute('role', 'dialog');
  document.body.append(root);
  let spec = null, mode = 'menu';

  function anchorOf() {
    const a = spec.at();
    if (!a) return null;
    if (a instanceof Element) { const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, top: r.top, bottom: r.bottom }; }
    return a;
  }
  function place() {
    const a = anchorOf();
    if (!a) return close();
    const w = root.offsetWidth, h = root.offsetHeight, W = innerWidth, H = innerHeight;
    const topRoom = a.top - GAP - h, below = topRoom < 56;   // keep clear of the resource bar at the top
    let top = below ? a.bottom + GAP : topRoom;
    if (below && top + h > H - EDGE) top = Math.max(EDGE, H - EDGE - h);
    const left = Math.max(EDGE, Math.min(W - EDGE - w, a.x - w / 2));
    root.style.left = left + 'px'; root.style.top = top + 'px';
    root.classList.toggle('below', below);
    arrow.style.left = Math.max(14, Math.min(w - 14, a.x - left)) + 'px';
    root.style.transformOrigin = `${Math.max(14, Math.min(w - 14, a.x - left))}px ${below ? '0' : '100%'}`;
  }
  function open(s) {
    if (spec && spec.key === s.key && !root.hidden) { spec = s; return; }
    spec = s; mode = 'menu';
    body.replaceChildren(); s.build(body);
    root.hidden = false; root.classList.remove('in'); place();
    if (!reduceMotion()) { void root.offsetWidth; root.classList.add('in'); }
  }
  function close() { spec = null; mode = 'menu'; root.hidden = true; }
  function confirm({ text, sub, ok, danger = true, onOk }) {
    if (!spec) return;
    mode = 'confirm';
    const no = el('button', { className: 'pbtn', textContent: 'Cancel' }), yes = el('button', { className: 'pbtn' + (danger ? ' danger' : ' primary'), textContent: ok });
    no.onclick = () => { mode = 'menu'; body.replaceChildren(); spec.build(body); place(); };
    yes.onclick = () => { mode = 'menu'; onOk(); };
    body.replaceChildren(el('div', { className: 'pop-q' }, [el('b', { textContent: text }), sub ? el('small', { textContent: sub }) : null]), el('div', { className: 'pop-yn' }, [no, yes]));
    place(); setTimeout(() => no.focus({ preventScroll: true }), 30);   // the safe choice has the focus
  }
  function tick() {
    if (!spec || root.hidden) return;
    if (mode === 'menu' && spec.refresh) spec.refresh(body);
    place();
  }
  return { open, close, confirm, tick, root, get key() { return spec && !root.hidden ? spec.key : null; }, get confirming() { return mode === 'confirm'; } };
}
