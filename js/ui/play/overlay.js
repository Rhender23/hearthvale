// A small card in the middle of the screen for the hands-on moments (fishing, quilting, sorting). The game keeps
// running behind it. Closing it never costs anything.
//   const o = openPlay({ title, onClose }); o.body (a div); o.close()
import { el } from '../dom.js';

let current = null;
export function openPlay({ title, sub, onClose, ui }) {
  if (current) current.close();
  const x = el('button', { className: 'sh-x', textContent: '✕' }); x.setAttribute('aria-label', 'Close');
  const body = el('div', { className: 'play-body' });
  const card = el('div', { className: 'play-card', role: 'dialog' }, [el('div', { className: 'play-head' }, [el('b', { textContent: title }), sub ? el('small', { textContent: sub }) : null, x]), body]);
  const root = el('div', { className: 'play' }, [card]);
  document.body.append(root);
  if (ui) ui.modal = true;
  const close = () => { if (!root.isConnected) return; root.remove(); if (ui) ui.modal = false; current = null; onClose && onClose(); };
  x.onclick = close;
  root.addEventListener('pointerdown', e => { if (e.target === root) close(); });
  current = { body, close, card };
  return current;
}

// "+6 🥕" rising from a point on screen.
export function floatText(text, x, y) {
  const e = el('div', { className: 'floaty', textContent: text });
  e.style.left = x + 'px'; e.style.top = y + 'px';
  document.body.append(e); setTimeout(() => e.remove(), 1300);
}
