// Asking before something that can't be undone (New game, Delete, Load…), and asking for a name.
// One rule: the question appears where you are looking, and is never lost.
//   a sheet is open      -> inside the sheet, at the top
//   a bubble is open     -> in the bubble, in place of its buttons
//   neither              -> a small card in the middle of the screen
//   const { ask, askText } = createAsk({ sheet, pop, ui })
//   ask({ text, sub, ok, danger = true, onOk })          askText({ text, value, ok, onOk(name) })
import { el } from './dom.js';
import { openPlay } from './play/overlay.js';

export function createAsk({ sheet, pop, ui }) {
  // A box at the top of the open sheet (replacing any earlier one).
  function inSheet(build) {
    const body = sheet.root.querySelector('.sh-body');
    body.querySelectorAll('.inconfirm').forEach(x => x.remove());
    const box = el('div', { className: 'inconfirm' }); build(box, () => box.remove());
    body.prepend(box); body.scrollTop = 0;
    return box;
  }
  // A card in the middle of the screen.
  function onCard(title, build) {
    const o = openPlay({ title, ui });
    build(o.body, () => o.close());
    return o;
  }
  const buttons = (ok, danger, onOk, done) => {
    const no = el('button', { className: 'pbtn', textContent: 'Cancel' }), yes = el('button', { className: 'pbtn ' + (danger ? 'danger' : 'primary'), textContent: ok });
    no.onclick = () => done(); yes.onclick = () => { done(); onOk(); };
    setTimeout(() => no.focus({ preventScroll: true }), 30);   // the safe choice has the focus
    return el('div', { className: 'row end' }, [no, yes]);
  };

  function ask({ text, sub, ok, danger = true, onOk }) {
    if (sheet.key) return inSheet((box, done) => box.append(el('b', { textContent: text }), sub ? el('small', { textContent: sub }) : '', buttons(ok, danger, onOk, done)));
    if (pop.key) return pop.confirm({ text, sub, ok, danger, onOk });
    return onCard(text, (body, done) => body.append(sub ? el('small', { className: 'play-msg', textContent: sub }) : '', buttons(ok, danger, onOk, done)));
  }

  // A name to type in: a field and Save, in the sheet or on a card (never the browser's own pop-up,
  // which phones often block inside the game's page).
  function askText({ text, value = '', ok = 'Save', max = 32, onOk }) {
    const build = (box, done) => {
      const f = el('input', { type: 'text', value, maxLength: max, className: 'asktext' }); f.setAttribute('aria-label', text);
      const save = () => { const v = f.value.trim(); if (!v) return; done(); onOk(v.slice(0, max)); };
      f.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') done(); });
      const no = el('button', { className: 'pbtn', textContent: 'Cancel' }), yes = el('button', { className: 'pbtn primary', textContent: ok });
      no.onclick = () => done(); yes.onclick = save;
      box.append(f, el('div', { className: 'row end' }, [no, yes]));
      setTimeout(() => { f.focus(); f.select(); }, 30);
    };
    if (sheet.key) return inSheet((box, done) => { box.append(el('b', { textContent: text })); build(box, done); });
    return onCard(text, build);
  }
  return { ask, askText };
}
