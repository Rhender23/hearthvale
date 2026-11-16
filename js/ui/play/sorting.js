// Sorting the merchant's cart: a jumble of goods; tap one, then tap its crate (or drag it there). No clock, no wrong
// answers: a piece put in the wrong crate just hops back out. When the cart is empty the merchant pays for the help.
import { el } from '../dom.js';
import { openPlay } from './overlay.js';
import { cartSorted } from '../../core/handson.js';

const KINDS = [['pottery', '🏺', 'Pottery'], ['cloth', '🧵', 'Cloth'], ['food', '🍎', 'Food'], ['tools', '🔨', 'Tools']];

export function openSorting({ g, ui, say, buzz }) {
  const o = openPlay({ title: "Sort the merchant's cart", sub: 'Tap a piece, then its crate.', ui });
  const use = KINDS.slice(0, 3 + (g.age >= 1 ? 1 : 0)), items = [];
  for (const [k] of use) for (let n = 0; n < 3; n++) items.push(k);
  items.sort(() => Math.random() - 0.5);
  const cart = el('div', { className: 'cart' }), crates = el('div', { className: 'crates' }), msg = el('div', { className: 'play-msg', textContent: `${items.length} to sort.` });
  let picked = null, left = items.length;
  const pieces = items.map(k => { const [, ic] = use.find(u => u[0] === k), b = el('button', { className: 'piece', textContent: ic }); b.dataset.k = k;
    b.style.transform = `rotate(${(Math.random() - 0.5) * 30}deg)`;
    b.onclick = () => { if (picked) picked.classList.remove('on'); picked = picked === b ? null : b; if (picked) picked.classList.add('on'); buzz && buzz(4); };
    cart.append(b); return b; });
  for (const [k, ic, name] of use) {
    const c = el('button', { className: 'crate' }, [el('span', { textContent: ic }), el('small', { textContent: name }), el('b', { className: 'cn', textContent: '0' })]);
    c.onclick = () => {
      if (!picked) return;
      if (picked.dataset.k !== k) { picked.classList.add('hop'); setTimeout(() => picked && picked.classList.remove('hop'), 400); msg.textContent = 'Not that one, that goes elsewhere.'; return; }
      picked.remove(); picked = null; left--; c.querySelector('.cn').textContent = String(+c.querySelector('.cn').textContent + 1); buzz && buzz(8);
      msg.textContent = left ? `${left} to sort.` : 'All sorted!';
      if (!left) { const r = cartSorted(g); setTimeout(() => { o.close(); say(r.ok ? `The merchant thanks you with ${r.n} 🪙.` : 'All sorted. The merchant is grateful.'); }, 500); }
    };
    crates.append(c);
  }
  o.body.append(cart, crates, msg);
  return o;
}
