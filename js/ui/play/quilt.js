// Quilting at the weaver: a 4×4 quilt and a pattern to follow. Tap a square to change its cloth. Sew it whenever you
// like (it is your quilt); matching the pattern earns a little more culture. The quilt goes on a bed in a home.
import { el } from '../dom.js';
import { openPlay } from './overlay.js';
import { finishQuilt, HANDS } from '../../core/handson.js';

const CLOTH = ['#b5523e', '#4f7fb5', '#e0b040', '#5f8a44', '#efe4cc', '#7a5a9a'];
// Patterns that read well at 4×4: a mirrored design from a few random choices.
function pattern(seed) {
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cols = [0, 1, 2, 3, 4, 5].sort(() => r() - 0.5).slice(0, 3), q = [[0, 0], [0, 1], [1, 0], [1, 1]].map(() => cols[Math.floor(r() * 3)]);
  const P = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const qx = x < 2 ? x : 3 - x, qy = y < 2 ? y : 3 - y; P.push(q[qy * 2 + qx]); }
  return { P, cols };
}

export function openQuilt({ g, ui, say, buzz }) {
  const seed = 1 + Math.floor(Math.random() * 99999), { P, cols } = pattern(seed);
  const cur = P.map(() => cols[0]);
  const o = openPlay({ title: 'Piece a quilt', sub: `Tap squares to change the cloth. Uses ${HANDS.quiltCloth} cloth.`, ui });
  const grid = el('div', { className: 'quilt' }), aim = el('div', { className: 'quilt small' });
  P.forEach(c => { const d = el('i'); d.style.background = CLOTH[c]; aim.append(d); });
  const cells = cur.map((c, k) => { const b = el('button'); b.setAttribute('aria-label', 'Square ' + (k + 1)); b.style.background = CLOTH[c];
    b.onclick = () => { const i = cols.indexOf(cur[k]); cur[k] = cols[(i + 1) % cols.length]; b.style.background = CLOTH[cur[k]]; buzz && buzz(4); check(); }; grid.append(b); return b; });
  const msg = el('div', { className: 'play-msg' }), sew = el('button', { className: 'pbtn primary', textContent: '🧵 Sew it' });
  const check = () => { const same = cur.every((c, k) => c === P[k]); msg.textContent = same ? 'Just like the pattern! ✨' : `${cur.filter((c, k) => c === P[k]).length} of 16 squares match.`; sew.classList.toggle('glow', same); return same; };
  sew.onclick = () => {
    const same = check(), r = finishQuilt(g, cur.map(c => CLOTH[c]));
    if (!r.ok) { msg.textContent = r.reason; return; }
    if (same) g.culture = (g.culture || 0) + 4;
    o.close(); say(same ? 'A perfect quilt. The whole village admires it. 🧵✨' : 'A cozy quilt, all your own. 🧵');
  };
  o.body.append(el('div', { className: 'quiltrow' }, [grid, el('div', { className: 'quiltaim' }, [el('small', { textContent: 'The pattern' }), aim])]), msg, el('div', { className: 'row end' }, [sew]));
  check();
  return o;
}
