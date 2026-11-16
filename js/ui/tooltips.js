// Tips: hover with a mouse, or press and hold on touch, over anything with a data-tip. They sit clear of the bubble or
// sheet they came from, close after a few seconds, and close at once on the next touch or any scrolling.
// A greyed button (aria-disabled) answers a tap by saying what it still needs.
//   const tips = createTooltips({ g, ACT, CARD_TIPS, say })  -> { show(el), hide() }
import { $, el, val } from './dom.js';
import { oneLine } from './tips.js';
import { costEl } from './costs.js';

export function createTooltips({ g, ACT, CARD_TIPS, say }) {
  const tipEl = $('tip'); let tipT = 0, lpT = 0, lpFired = false;
  function showTip(b) {
    const k = b.dataset.tip, a = ACT[k] || CARD_TIPS[k]; if (!a || !a.tip) return;
    const [name, desc] = val(a.tip); const c = a.cost ? val(a.cost) : null;
    tipEl.replaceChildren(el('b', { textContent: name }), el('div', { textContent: oneLine(desc) }), ...(c ? [costEl(g(), c, 'tipcost')] : []), ...(b.dataset.why ? [el('div', { className: 'tipwhy', textContent: '🔒 ' + b.dataset.why })] : []));
    tipEl.hidden = false;
    // Clear of the bubble or panel it came from: above it, else below, else beside it.
    const r = b.getBoundingClientRect(), box = b.closest('#pop, #sheet, #hud, #dir'), R = box ? box.getBoundingClientRect() : r, th = tipEl.offsetHeight, tw = 240;
    let left = Math.max(8, Math.min(innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)), top;
    if (R.top - th - 8 >= 8) top = R.top - th - 8;
    else if (R.bottom + th + 8 <= innerHeight - 8) top = R.bottom + 8;
    else { top = Math.max(8, Math.min(innerHeight - th - 8, r.top)); left = R.left >= tw + 16 ? R.left - tw - 8 : Math.min(innerWidth - tw - 8, R.right + 8); }
    tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
    clearTimeout(tipT); tipT = setTimeout(() => { tipEl.hidden = true; }, 4000);
  }
  const tipTarget = e => e.target.closest && e.target.closest('[data-tip]');
  document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse') { const b = tipTarget(e); if (b) showTip(b); } });
  document.addEventListener('pointerout', e => { if (e.pointerType === 'mouse' && tipTarget(e)) tipEl.hidden = true; });
  document.addEventListener('pointerdown', e => { tipEl.hidden = true; if (e.pointerType === 'mouse') return; const b = tipTarget(e); clearTimeout(lpT); lpFired = false; if (b) lpT = setTimeout(() => { lpFired = true; showTip(b); buzz(8); }, 450); });
  document.addEventListener('pointerup', () => clearTimeout(lpT));
  document.addEventListener('scroll', () => { tipEl.hidden = true; clearTimeout(lpT); }, true);   // a tip never stays over something you are scrolling
  document.addEventListener('click', e => { if (lpFired && tipTarget(e)) { lpFired = false; e.stopPropagation(); e.preventDefault(); return; }
    const dis = e.target.closest && e.target.closest('[aria-disabled="true"]');
    if (dis) { e.stopPropagation(); e.preventDefault(); if (dis.dataset.why) say(dis.dataset.why); }
  }, true);
  return { show: showTip, hide() { tipEl.hidden = true; clearTimeout(lpT); } };
}
