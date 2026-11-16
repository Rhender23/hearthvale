// The menus around the map, laid out like a phone game:
//   the top bar   — the village's stores (tap for everything) and the clock (pause, speed)
//   the tab bar   — Build · Village · Book · Game, at the bottom on a phone, down the left on an iPad or computer
// Each tab opens one sheet. Only one thing is ever open at a time: opening a sheet tucks away the bubble and the hint,
// and tapping the open tab again closes it.
import { $, el, val, buzz } from './dom.js';
import { icon, iconSvg } from './icons.js';
import { createSlots, snapshot, whenText } from './slots.js';
import { paintFlag, FLAG_COLOURS, PATTERNS, EMBLEMS, DEFAULT_FLAG } from './flag.js';
import { AGES, SEASONS, VERSION } from '../core/config.js';
import { dayNumber, seasonIndex, flagUp } from '../core/state.js';

const TABS = [['build', 'build', 'Build'], ['village', 'village', 'Village'], ['book', 'book', 'Book'], ['game', 'game', 'Game']];
// Which picture goes with which button in the lists.
const PIC = { storage: 'storage', album: 'animals', overlay: 'overlay', free: 'free', nextfest: 'festival', sound: 'sound', hints: 'hints', sandbox: 'sandbox', newgame: 'newgame', glossary: 'glossary', tree: 'tree', idle: 'idle', home: 'home', flag: 'flag' };

export function createMenus(m) {
  const { ui, g, sheet, pop, ACT, api, ctx, settings, audio, say, toast } = m;
  const slots = createSlots(ctx.store);

  // ---------- tab bar ----------
  const bar = $('tabbar'), tabBtn = {};
  for (const [k, ic, label] of TABS) {
    const b = bar.querySelector(`[data-tab="${k}"]`); tabBtn[k] = b;
    b.replaceChildren(icon(ic, 24), el('span', { textContent: label }));
    b.onclick = () => { buzz(6); tap(k); };
  }
  function tap(k) {
    ui.hudMode = 1;
    if (k === 'build') {
      if (ui.place) { m.cancelPlace(); return; }
      if (sheet.key === 'build') { sheet.close(); return; }
      ui.selB = null; ui.selN = null; api.openBuild(); return;
    }
    if (owner(sheet.key) === k) { sheet.close(); return; }
    ({ village: openVillage, book: () => api.openGlossary(), game: openGame })[k]();
  }
  const owner = key => !key ? null : key === 'build' ? 'build' : ['village', 'storage', 'library', 'flag'].includes(key) ? 'village' : ['glossary', 'tree'].includes(key) ? 'book' : key === 'game' ? 'game' : null;

  // ---------- clock: pause and speed ----------
  const pauseB = $('pausebtn'), speedB = $('speedbtn');
  pauseB.onclick = () => { buzz(6); ACT.pause.run(); };
  speedB.onclick = () => { buzz(6); ACT.speed.run(); };
  pauseB.dataset.tip = 'pause'; speedB.dataset.tip = 'speed';

  // ---------- the resource bar: tap for everything ----------
  ui.hudOpen = true; ui.hudMode = ui.hudMode || 1;
  $('hud').addEventListener('click', e => { if (e.target.closest('[data-tip]') && ui.hudMode === 2) return; ui.hudMode = ui.hudMode === 2 ? 1 : 2; });

  // ---------- a list row (like a phone's settings) ----------
  function row(k, opts = {}) {
    const a = ACT[k], [name, desc] = val(a.tip);
    const value = el('span', { className: 'lv' }), b = el('button', { className: 'lrow' + (a.danger ? ' danger' : '') }, [icon(opts.pic || PIC[k] || 'more', 22), el('span', { className: 'ln' }, [el('b', { textContent: opts.name || name }), el('small', { textContent: opts.desc || desc })]), value]);
    b.dataset.k = k;
    const sync = () => {
      const [n2, d2] = val(a.tip); b.querySelector('b').textContent = opts.name || n2; b.querySelector('small').textContent = opts.desc || d2;
      value.textContent = opts.value ? opts.value() : a.on ? (a.on() ? 'On' : 'Off') : '';
      b.hidden = a.hide ? !!a.hide() : false; b.classList.toggle('dis', a.dis ? !!a.dis() : false);
    };
    b.onclick = () => { buzz(6); if (a.dis && a.dis()) { say(val(a.why) || 'Not available right now.'); return; } a.run(); if (opts.close) sheet.close(); sync(); };
    b._sync = sync; sync(); return b;
  }
  const group = (title, rows) => [el('span', { className: 'secth', textContent: title }), el('div', { className: 'lgroup' }, rows)];
  const refreshRows = body => body.querySelectorAll('.lrow').forEach(b => b._sync && b._sync());

  // ---------- Village ----------
  function openVillage() {
    sheet.open({ key: 'village', title: 'Village', build: body => {
      const G = g();
      body.append(el('small', { className: 'shsub', textContent: `Day ${dayNumber(G)} · ${SEASONS[seasonIndex(G)]} · ${AGES[G.age].name} Age · ${G.villagers.length} villagers` }));
      body.append(...group('Look after', [row('storage'), row('album'), row('flag')]));
      body.append(...group('How the village runs', [row('free', { value: () => ['Off', 'Work', 'All'][m.willLevel()] }), row('overlay', { value: () => ({ off: 'Off', beauty: 'Beauty', directors: 'Directors' })[ui.overlay] }), row('nextfest')]));
      body.append(...group('Find', [row('home', { close: true }), row('idle', { close: true })]));
    }, refresh: refreshRows });
  }

  // ---------- the village flag designer ----------
  const flagCanvas = (f, w, h, cls = 'flagprev') => { const c = el('canvas', { className: cls }); c.width = w * 2; c.height = h * 2; c.style.width = w + 'px'; c.style.height = h + 'px'; const x = c.getContext('2d'); x.scale(2, 2); paintFlag(x, f, w, h); return c; };
  function openFlag(fresh) {
    const G = g(); if (!flagUp(G)) { say('Put up a village flag first: Build → Decoration, 50 gold.'); return; }
    if (!G.flag) G.flag = { ...DEFAULT_FLAG };
    const set = (k, v) => { G.flag = { ...G.flag, [k]: v }; sheet.rebuild(); };
    sheet.open({ key: 'flag', title: 'Village flag', build: body => {
      const f = G.flag;
      if (!fresh) body.append(el('button', { className: 'shback', textContent: '‹ Village', onclick: openVillage }));
      else body.append(el('small', { className: 'shsub', textContent: 'Your village flag is going up. Choose how it looks; you can change it any time from the flag.' }));
      body.append(el('div', { className: 'flagstage' }, [flagCanvas(f, 180, 118)]));
      const colours = (k) => el('div', { className: 'swatches' }, FLAG_COLOURS.map(c => { const b = el('button', { className: 'swc' + (f[k] === c ? ' on' : '') }); b.style.background = c; b.setAttribute('aria-label', c); b.onclick = () => set(k, c); return b; }));
      const choices = (k, list, look) => el('div', { className: 'flagopts' }, list.map(v => { const b = el('button', { className: 'flagopt' + (f[k] === v ? ' on' : '') }, [flagCanvas(look(v), 46, 30, 'mini')]); b.setAttribute('aria-label', v); b.onclick = () => set(k, v); return b; }));
      body.append(el('span', { className: 'secth', textContent: 'Field' }), colours('bg'));
      body.append(el('span', { className: 'secth', textContent: 'Pattern' }), choices('pattern', PATTERNS, v => ({ ...f, pattern: v, emblem: 'none' })), colours('fg'));
      body.append(el('span', { className: 'secth', textContent: 'Emblem' }), choices('emblem', EMBLEMS, v => ({ ...f, emblem: v })), colours('ec'));
      body.append(el('small', { className: 'shsub', textContent: 'It flies over the village and hangs in the great hall, and shows on your save slots.' }));
    } });
  }
  api.openFlag = openFlag;

  // ---------- Game: save slots and settings ----------
  function slotCard(s) {
    const M = s.meta, pic = M && M.thumb ? el('img', { src: M.thumb, alt: '' }) : el('div', { className: 'noimg', textContent: 'Empty' });
    const btn = (t, f, danger) => { const b = el('button', { textContent: t, className: danger ? 'danger' : '' }); b.onclick = e => { e.stopPropagation(); buzz(6); f(); }; return b; };
    const info = el('div', {}, [
      el('b', {}, [...(M && M.flag ? [flagCanvas(M.flag, 18, 12, 'slotflag')] : []), M ? M.name : `Slot ${s.i + 1}`]),
      el('small', { style: 'display:block', textContent: M ? `${M.age} Age · Day ${M.day} · ${M.pop} villagers · ${whenText(M.when)}` : 'Nothing kept here yet.' }),
      el('div', { className: 'sm' }, [btn(M ? 'Save over' : 'Save here', () => saveTo(s.i, !!M)), ...(M ? [btn('Load', () => loadFrom(s.i)), btn('Rename', () => rename(s.i)), btn('Delete', () => wipe(s.i), true)] : [])])]);
    return el('div', { className: 'slot' }, [pic, info]);
  }
  function saveTo(i, over) {
    const go = () => {
      const G = g(), ok = slots.write(i, ctx.current(), { flag: flagUp(G) ? G.flag || DEFAULT_FLAG : null, name: `${AGES[G.age].name} village`, day: dayNumber(G), pop: G.villagers.length, age: AGES[G.age].name, when: Date.now(), thumb: snapshot(ctx.canvas) });
      toast(ok ? `Kept in slot ${i + 1}.` : 'There is no room left to save. Delete a slot first.'); sheet.rebuild();
    };
    if (!over) return go();
    confirmIn(`Save over slot ${i + 1}?`, 'The village kept there is replaced by this one.', 'Save over', go);
  }
  function loadFrom(i) {
    confirmIn('Load this village?', 'The village you are playing now is replaced. Keep it in a slot first if you want it.', 'Load', () => {
      try { ctx.loadText(slots.read(i)); sheet.close(); toast('Welcome back.'); } catch (e) { console.warn(e); toast('That save could not be read.'); }
    });
  }
  function rename(i) { const s = slots.list()[i]; const n = prompt('Name this village', s.meta ? s.meta.name : ''); if (n && n.trim()) { slots.rename(i, n.trim().slice(0, 32)); sheet.rebuild(); } }
  function wipe(i) { confirmIn(`Delete slot ${i + 1}?`, 'The village kept there is gone for good.', 'Delete', () => { slots.clear(i); sheet.rebuild(); }); }
  // A confirm that sits inside the sheet, not a second layer over it.
  function confirmIn(text, sub, ok, onOk) {
    const body = sheet.root.querySelector('.sh-body'), box = el('div', { className: 'inconfirm' }, [el('b', { textContent: text }), el('small', { textContent: sub })]);
    const yes = el('button', { className: 'pbtn primary', textContent: ok }), no = el('button', { className: 'pbtn', textContent: 'Cancel' });
    yes.onclick = () => { box.remove(); onOk(); }; no.onclick = () => box.remove();
    box.append(el('div', { className: 'row end' }, [no, yes]));
    body.querySelectorAll('.inconfirm').forEach(x => x.remove()); body.prepend(box); body.scrollTop = 0;
  }
  function exportFile() {
    const G = g(), blob = new Blob([ctx.current()], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `hearthvale-day${dayNumber(G)}.json`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Your village was saved to a file.');
  }
  function importFile() {
    const f = el('input', { type: 'file', accept: '.json,application/json' });
    f.onchange = () => { const file = f.files[0]; if (!file) return; file.text().then(t => confirmIn('Open this village?', 'The village you are playing now is replaced.', 'Open', () => { try { ctx.loadText(t); sheet.close(); toast('Village opened.'); } catch (e) { toast('That file is not a Hearthvale village.'); } })); };
    f.click();
  }
  function openGame() {
    sheet.open({ key: 'game', title: `Hearthvale · v${VERSION}`, full: innerHeight < 700, build: body => {
      body.append(el('span', { className: 'secth', textContent: 'Save slots' }), el('small', { className: 'shsub', textContent: 'Your village also saves on its own as you play.' }));
      for (const s of slots.list()) body.append(slotCard(s));
      const fileRow = (pic, name, desc, f) => { const b = el('button', { className: 'lrow' }, [icon(pic, 22), el('span', { className: 'ln' }, [el('b', { textContent: name }), el('small', { textContent: desc })])]); b.onclick = () => { buzz(6); f(); }; return b; };
      const unread = ctx.store.get('hearthvale-unread');
      if (unread) body.append(el('div', { className: 'lgroup', style: 'margin-top:8px' }, [fileRow('load', 'Open your earlier village', 'An older version could not open it. This one can.', () => confirmIn('Open your earlier village?', 'The village you are playing now is replaced. Keep it in a slot first if you want it.', 'Open', () => { try { ctx.loadText(unread); ctx.store.del('hearthvale-unread'); sheet.close(); toast('Welcome back.'); } catch (e) { toast('That village still could not be read.'); } }))]));
      body.append(el('div', { className: 'lgroup', style: 'margin-top:8px' }, [fileRow('export', 'Save to a file', 'Keep a copy anywhere, or move it to another device.', exportFile), fileRow('load', 'Open a file', 'Open a village saved to a file.', importFile)]));
      const sound = row('sound', { value: () => settings.sound ? 'On' : 'Off' });
      const vol = el('input', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round((settings.volume ?? 0.7) * 100)) });
      vol.setAttribute('aria-label', 'Volume'); vol.oninput = () => { settings.volume = vol.value / 100; audio.setVolume(settings.volume); settings.persist(); };
      const volRow = el('label', { className: 'lrow volrow' }, [icon('sound', 22), el('span', { textContent: 'Volume' }), vol]);
      body.append(...group('Settings', [sound, volRow, row('hints'), row('sandbox')]));
      body.append(...group('Start again', [row('newgame')]));
    }, refresh: body => { refreshRows(body); const v = body.querySelector('.volrow'); if (v) v.hidden = !settings.sound; } });
  }

  // ---------- every frame ----------
  function tick() {
    const k = owner(sheet.key);
    for (const [t] of TABS) tabBtn[t].classList.toggle('on', t === k || (t === 'build' && !!ui.place));
    tabBtn.build.classList.toggle('place', !!ui.place);
    const p = ui.paused ? 'play' : 'pause';
    if (pauseB.dataset.ic !== p) { pauseB.dataset.ic = p; pauseB.innerHTML = iconSvg(p, 18); pauseB.setAttribute('aria-label', ui.paused ? 'Resume' : 'Pause'); }
    pauseB.classList.toggle('on', !!ui.paused);
    const sp = settings.speed + '×'; if (speedB.textContent !== sp) speedB.textContent = sp;
    speedB.classList.toggle('on', settings.speed > 1);
    document.body.classList.toggle('sheet-open', !!sheet.key);
    $('hud').classList.toggle('simple', ui.hudMode !== 2); $('hud').classList.toggle('full', ui.hudMode === 2);
  }
  return { tick, tap, openVillage, openGame, owner };
}
