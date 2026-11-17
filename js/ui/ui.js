// The interface: what was tapped, which bubble or sheet is open, the resource bar, tips and messages.
// Buttons live in actions.js (one table), text about things in panels.js, the bubble in popover.js, the sheet in sheet.js.
//
//   tap a villager  -> bubble above their head (Build, Unload, Back to work, More)
//   tap a building  -> bubble above its roof (its own actions, Details, More)
//   with villagers selected, tap a tree, field, workshop or site -> they get to work (a short note says so)
//   Build -> sheet of buildings -> tap the ground to see it there -> ✓ Place (or tap the same spot again)
//   Take down, Say goodbye, New game -> asked once, inside the bubble

import { PATH_KINDS, TIERS, NODE, PANTRY, PANTRY_ICON, FARM, BUILD, ICON, RES, BASICS, GOODS, AGES, SEASONS, N } from '../core/config.js';
import { idx, inMap, nodeKind, WATER, walkable } from '../core/world.js';
import { popCap, seasonIndex, darkness, cap, hub } from '../core/state.js';

import * as cmd from '../core/commands.js';

import { $, el, val, buzz } from './dom.js';
import { createPopover } from './popover.js';
import { createSheet } from './sheet.js';
import { createActions, OWNS, PRIMARY } from './actions.js';
import { NODE_NAME, buildingTitle, buildingSummary, villagerTitle, villagerSummary, villagerJob, nodeSummary, villagerWants, buildingWants } from './panels.js';
import { placeHint, orderNote } from '../core/hints.js';
import { createCoach } from './coach.js';
import { shortOf, buildNeeds } from '../core/requires.js';

import { costEl, stepEl, refreshStep } from './costs.js';

import { addFill, syncFill, fullLine } from './storage.js';

import { createMenus } from './menus.js';
import { createAsk } from './ask.js';
import { createSheets } from './sheets.js';
import { createTooltips } from './tooltips.js';
import { directorView } from './directorview.js';
import * as hands from '../core/handson.js';
import { floatText } from './play/overlay.js';
import { openFishing } from './play/fishing.js';
import { openQuilt } from './play/quilt.js';
import { openSorting } from './play/sorting.js';

import { linePlan, KIND_NAME } from './pathline.js';

export { OWNS };

export function createUI(ctx) {
  const { getGame, view, settings, audio } = ctx;
  const ui = { sel: new Set(), selB: null, selN: null, overlay: 'off', place: null, ghost: null, mode: null, hudOpen: false, modal: false, hover: [-9, -9], hoverCells: null, ping: null, plantI: 0, idleI: 0, give: 'wood', get: 'food', rot: 0, more: false };
  const g = () => getGame();
  const pop = createPopover(), sheet = createSheet();

  // While moving a building its own tiles count as free.
  ui.canPlace = (x, y) => {
    const G = g();
    if (!ui.moving) return cmd.canPlace(G, ui.place, x, y, ui.rot);
    const b = ui.moving, saved = [];
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) { const t = idx(b.x + i, b.y + j); saved.push([t, G.w.occ[t]]); G.w.occ[t] = 0; }
    const ok = cmd.canPlace(G, b.k, x, y, ui.rot);
    for (const [t, o] of saved) G.w.occ[t] = o;
    return ok;
  };

  // ---------- where things are on screen ----------
  const toScreen = (wx, wy) => [(wx - view.cam.x) * view.cam.z + view.W / 2, (wy - view.cam.y) * view.cam.z + view.H / 2];
  const isoW = (x, y) => [(x - y) * 32, (x + y) * 16];
  function anchorVillagers() {
    const vs = [...ui.sel]; if (!vs.length) return null;
    const v = vs[0], [wx, wy] = isoW(v.x, v.y), [sx, sy] = toScreen(wx, wy), z = view.cam.z;
    return { x: sx, top: sy - 52 * z, bottom: sy + 10 * z };
  }
  function anchorBuilding(b, rx = b.x, ry = b.y, w = b.w, h = b.h) {
    const [wx, wy] = isoW(rx + (w - 1) / 2, ry + (h - 1) / 2), [sx, sy] = toScreen(wx, wy), z = view.cam.z, top = b ? (ctx.heightOf ? ctx.heightOf(b, g().age) : 30) : 20;
    return { x: sx, top: sy - (top + 22) * z, bottom: sy + 16 * z };
  }
  function anchorTile(x, y) { const [wx, wy] = isoW(x, y), [sx, sy] = toScreen(wx, wy), z = view.cam.z; return { x: sx, top: sy - 36 * z, bottom: sy + 14 * z }; }

  // ---------- short notes at the spot that was tapped ----------
  const sayEl = el('div', { id: 'say', role: 'status' }); document.body.append(sayEl);
  let sayT = 0;
  function say(text, at) {
    if (!text) return;
    const p = at || ui.lastTap || [innerWidth / 2, innerHeight / 2];
    sayEl.textContent = text; sayEl.classList.remove('show'); void sayEl.offsetWidth;
    const w = Math.min(280, innerWidth - 24); sayEl.style.maxWidth = w + 'px';
    const r = sayEl.getBoundingClientRect();
    let top = p[1] - r.height - 64; if (top < 60) top = p[1] + 40;
    const left = Math.max(12, Math.min(innerWidth - r.width - 12, p[0] - r.width / 2));
    if (!pop.root.hidden) {   // never on top of the open bubble: slide above or below it
      const q = pop.root.getBoundingClientRect();
      if (left < q.right && left + r.width > q.left && top < q.bottom && top + r.height > q.top) top = q.bottom + 10 + r.height < innerHeight - 70 ? q.bottom + 10 : Math.max(60, q.top - r.height - 10);
    }
    if (sheet.key) { const q = sheet.root.getBoundingClientRect(); if (top + r.height > q.top - 8 && left < q.right && left + r.width > q.left) top = Math.max(70, q.top - r.height - 10); }   // never over an open sheet
    sayEl.style.left = left + 'px'; sayEl.style.top = top + 'px';
    sayEl.classList.add('show'); clearTimeout(sayT); sayT = setTimeout(() => sayEl.classList.remove('show'), 2600);
  }

  // ---------- village news: the top message, with an optional action (Undo) ----------
  let toastT = 0;
  function toast(text, action) {
    const t = $('toast'); t.replaceChildren(el('span', { textContent: text }));
    if (action) { const b = el('button', { className: 'tbtn', textContent: action.label }); b.onclick = () => { action.run(); t.classList.remove('show', 'act'); }; t.append(b); }
    t.classList.toggle('act', !!action); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show', 'act'), action ? 5000 : 4200);
  }

  // ---------- the actions and their buttons ----------
  const api = { ui, g, settings, audio, toast, say, pop, sheet, save: ctx.save, newGame: ctx.newGame };
  const ACT = createActions(api);
  const coach = api.coach = createCoach({ ui, g, view, settings, toScreen, pop, sheet });
  // Short captions under bubble buttons: icons are easier to learn with a word beside them.
  const LABEL = { glossary: 'Glossary', tree: 'Trees', storage: 'Storage', nextfest: 'Next fest', build: 'Build', unload: 'Unload', work: 'To work', plant: 'Plant', add: 'Group', rename: 'Name', clearjob: 'Clear job', remove: 'Remove', train: 'Villager', age: 'Age', festival: 'Festival', upgrades: 'Upgrades', rally: 'Rally', all: 'Everyone', idle: 'Idle', focus: 'Focus', improve: 'Improve', inside: 'Inside', move: 'Move', rotate: 'Turn', trade: 'Trade', info: 'Details', more: 'More', free: 'Free will', speed: 'Speed', pause: 'Pause', sound: 'Sound', overlay: 'Maps', album: 'Library', save: 'Save', sandbox: 'Sandbox', newgame: 'New game', hints: 'Hints' };
  const rows = [];
  function button(k) {
    const a = ACT[k], b = el('button', { className: 'ic' + (a.danger ? ' danger' : '') + (k === 'more' ? ' more' : '') }); b.dataset.tip = k;
    b.setAttribute('aria-label', val(a.tip)[0]);
    b.onclick = () => { buzz(6); a.run(); syncButtons(); };
    const w = el('div', { className: 'bw' }, [b, el('small', { textContent: LABEL[k] || val(a.tip)[0] })]);
    rows.push([b, k, w]); return w;
  }
  // Greyed out, but still answering: hover (or press and hold) shows what it needs, a tap says it.
  // (A truly disabled button gets no pointer events at all, so its tooltip could never explain itself.)
  function off(b, why) {
    const on = !!why; b.classList.toggle('dis', on); b.setAttribute('aria-disabled', on ? 'true' : 'false');
    if (on) b.dataset.why = typeof why === 'string' ? why : ''; else delete b.dataset.why;
  }
  function syncButtons() {
    for (let i = rows.length - 1; i >= 0; i--) {
      const [b, k, w] = rows[i]; if (!b.isConnected) { rows.splice(i, 1); continue; }
      const a = ACT[k]; b.textContent = val(a.icon); const d = a.dis ? !!a.dis() : false; off(b, d && ((a.why && val(a.why)) || (a.cost && shortOf(g(), val(a.cost))) || 'Not available right now.'));
      w.hidden = a.hide ? !!a.hide() : false;
      b.classList.toggle('on', a.on ? !!a.on() : false); b.classList.toggle('ready', a.ready ? !!a.ready() : false);
    }
  }
  // A bubble's buttons: the first few shown, the rest under ••• More (a second row).
  function actionRows(keys, extra = []) {
    const shown = keys.filter(k => !(ACT[k].hide && ACT[k].hide()));
    const first = shown.slice(0, PRIMARY), rest = shown.slice(PRIMARY);
    const row1 = el('div', { className: 'prow' }, [...first.map(button), ...extra.map(button), ...(rest.length ? [button('more')] : [])]);
    const row2 = rest.length && ui.more ? el('div', { className: 'prow more-row' }, rest.map(button)) : null;
    return [row1, row2];
  }
  api.toggleMore = () => { ui.more = !ui.more; pop.close(); };   // reopened next frame with or without the second row

  // ---------- the bubble for what is selected ----------
  function head(title, sub, sub2, wants) {
    return el('div', { className: 'pop-head' }, [el('b', { className: 'pt', textContent: title }), el('small', { className: 'ps', textContent: sub || '' }), sub2 != null ? el('small', { className: 'ps2', textContent: sub2 }) : null, wants !== undefined ? el('small', { className: 'pw', textContent: wants || '', hidden: !wants }) : null]);
  }
  const setWants = (body, t) => { const e = body.querySelector('.pw'); if (!e) return; e.hidden = !t; if (t && e.textContent !== t) e.textContent = t; };
  const setText = (body, cls, t) => { const e = body.querySelector('.' + cls); if (e && e.textContent !== t) e.textContent = t; };
  function bubbleSpec() {
    const G = g();
    if (ui.place === 'path' && !ui.moving) {   // paths are drawn as a line, then built together
      const kind = ui.pathKind || 'dirt', plan = linePlan(G, ui.line, ui.canPlace, kind);
      // Before a line is drawn: just the choice of kind, by the Build tab.
      const kinds = () => el('div', { className: 'seg kinds' }, PATH_KINDS.map(([k, lvl, c]) => {
        const T = TIERS.path[lvl], b = el('button', { className: k === kind ? 'on' : '' }, [el('i', { className: 'swatch sw-' + k }), el('span', { textContent: KIND_NAME[k] })]);
        b.dataset.tip = 'pathkind-' + k; CARD_TIPS['pathkind-' + k] = { tip: [T.name, T.age > G.age ? `Arrives in the ${AGES[T.age].name} Age.` : `Walk ${Math.round((T.speed - 1) * 100)}% faster.`], cost: c };
        if (T.age > G.age) off(b, `Arrives in the ${AGES[T.age].name} Age.`);
        b.onclick = () => { if (T.age > G.age) return; ui.pathKind = k; pop.close(); }; return b; }));
      if (!plan) return { key: `pathkind:${kind}:${G.age}`, at: () => $('tabbar').querySelector('[data-tab="build"]'),
        build: body => body.append(head('Draw a path', 'Drag across the ground, in any direction.'), kinds()) };
      const a = ui.line.a, b = ui.line.b || a;
      return { key: `line:${a}:${b}:${plan.n}:${plan.r}:${kind}`, at: () => anchorTile(b[0], b[1]),
        build: body => {
          const yes = el('button', { className: 'pbtn primary', textContent: '✓ Lay it' }), no = el('button', { className: 'pbtn', textContent: '✕' });
          no.setAttribute('aria-label', 'Cancel'); no.onclick = () => { ui.line = null; };
          const short = shortOf(G, plan.cost); yes.disabled = !(plan.n + plan.r) || !!short; yes.onclick = confirmLine;
          const skip = plan.tiles.filter(t => !t.ok && !t.relay && !t.same).length;
          const what = [plan.n ? `${plan.n} new` : '', plan.r ? `${plan.r} re-laid` : ''].filter(Boolean).join(', ');
          body.append(head(plan.name, what ? `${what}${skip ? ` (${skip} in the way)` : ''}. Drag again to redraw.` : 'Nothing to lay there. Drag across open ground.'),
            kinds(), el('div', { className: 'pstep' }, [costEl(G, plan.cost), short ? el('small', { className: 'pneed', textContent: short }) : null]), el('div', { className: 'pop-yn' }, [no, yes]));
        } };
    }
    if (ui.place) {
      const k = ui.place, x = ui.ghost;
      if (!x) return null;
      return { key: `place:${k}:${x[0]},${x[1]}:${ui.rot}:${ui.canPlace(x[0], x[1])}`,
        at: () => anchorBuilding({ k, lvl: 0, w: 1, h: 1 }, x[0], x[1], ...cmdDims()),
        build: b => {
          const ok = ui.canPlace(x[0], x[1]), turn = BUILD[k].turns || BUILD[k].faces;
          const yes = el('button', { className: 'pbtn primary', textContent: ui.moving ? '✓ Move here' : '✓ Place' }); yes.disabled = !ok; yes.onclick = confirmPlace;
          const rot = el('button', { className: 'pbtn', textContent: '🔄' }); rot.setAttribute('aria-label', 'Turn'); rot.onclick = () => { ui.rot = ui.rot ? 0 : 1; };
          const no = el('button', { className: 'pbtn', textContent: '✕' }); no.setAttribute('aria-label', 'Cancel'); no.onclick = cancelPlace;
          const need = !ui.moving && buildNeeds(G, k), price = !ui.moving ? el('div', { className: 'pstep' }, [costEl(G, BUILD[k].cost), need ? el('small', { className: 'pneed', textContent: need }) : null]) : null;
          b.append(...[head(ui.moving ? 'Move the ' + buildingTitle(ui.moving).toLowerCase() : BUILD[k].name, placeHint(G, k, x[0], x[1], ui.rot, ok)), price, el('div', { className: 'pop-yn' }, [no, ...(turn ? [rot] : []), yes])].filter(Boolean));
        } };
    }
    if (ui.sel.size) {
      const vs = [...ui.sel], key = 'v:' + vs.map(v => v.id).join() + ':' + ui.more;
      return { key, at: anchorVillagers,
        build: b => { const [r1, r2] = actionRows(vs.length > 1 ? OWNS.villagers : OWNS.villager); b.append(...[head(villagerTitle(vs), villagerSummary(G, vs), vs.length === 1 ? villagerJob(G, vs[0]) : null, vs.length === 1 ? villagerWants(G, vs[0]) : undefined), r1, r2].filter(Boolean)); },
        refresh: b => { setText(b, 'pt', villagerTitle(vs)); setText(b, 'ps', villagerSummary(g(), vs)); if (vs.length === 1) { setText(b, 'ps2', villagerJob(g(), vs[0])); setWants(b, villagerWants(g(), vs[0])); } } };
    }
    if (ui.selB) {
      const b0 = ui.selB, keys = !b0.done ? OWNS.site : b0.k === 'campfire' ? (G.buildings.some(o => o.k === 'tc' && o.done) ? OWNS.campfireLater : OWNS.campfire) : OWNS[b0.k] || OWNS.building;
      return { key: 'b:' + b0.id + ':' + b0.done + ':' + ui.more, at: () => anchorBuilding(b0),
        build: b => { const [r1, r2] = actionRows(keys, ['info']); b.append(...[head(buildingTitle(b0), buildingSummary(G, b0), null, buildingWants(G, b0)), stepEl(G, b0), r1, r2].filter(Boolean)); },
        refresh: b => { setText(b, 'pt', buildingTitle(b0)); setText(b, 'ps', buildingSummary(g(), b0)); setWants(b, buildingWants(g(), b0)); refreshStep(g(), b, b0); } };
    }
    if (ui.selN) {
      const n = ui.selN, x = n.i % N, y = (n.i / N) | 0;
      return { key: 'n:' + n.type + n.i, at: () => anchorTile(x, y),
        build: b => { b.append(head(n.type === 'sapling' ? 'Sapling' : NODE_NAME[G.w.R[n.i]] || 'Nothing', nodeSummary(G, n)), el('div', { className: 'prow' }, [button('remove')])); },
        refresh: b => setText(b, 'ps', nodeSummary(g(), n)) };
    }
    return null;
  }
  const cmdDims = () => { const k = ui.place, d = BUILD[k], w = d.w || d.size, h = d.h || d.size; return ui.rot ? [h, w] : [w, h]; };

  // ---------- the menus around the map (top bar, tab bar, Village / Book / Game sheets) live in menus.js ----------
  api.refreshGame = () => sheet.rebuild();
  api.goHome = () => { const tc = hub(g()); selectBuilding(tc); center(tc.x + 0.5, tc.y + 0.5); };

  // ---------- asking before anything that can't be undone, and asking for names (ask.js) ----------
  Object.assign(api, createAsk({ sheet, pop, ui }));
  api.closeAll = () => { sheet.close(); pop.close(); clearSel(); };

  // ---------- sheets: build menu, upgrades, library, storage, the Book, market, details (sheets.js) ----------
  const { CARD_TIPS } = createSheets({ ui, g, sheet, pop, api, say, toast, off, menus: () => menus });

  // ---------- placing and moving: preview, then ✓ ----------
  api.startMove = b => { ui.moving = b; ui.place = b.k; ui.rot = b.rot || 0; ui.ghost = [b.x, b.y]; ui.selB = null; say('Tap where it should go, then ✓.'); };
  function confirmPlace() {
    const G = g(), x = ui.ghost; if (!x || !ui.place) return;
    if (ui.moving) {
      const b = ui.moving, from = [b.x, b.y, b.rot || 0], r = cmd.moveBuilding(G, b, x[0], x[1], ui.rot);
      if (!r.ok) { say(r.reason || 'That spot is not free.'); return; }
      ping(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2, '#f2c14e'); buzz();
      const name = buildingTitle(b).toLowerCase();
      toast(`The ${name} has a new spot.`, { label: 'Undo', run: () => { if (G.bmap.has(b.id)) cmd.moveBuilding(G, b, from[0], from[1], from[2]); } });
      clearSel(); return;
    }
    // Built by the villagers chosen, or else by whoever is nearest and awake.
    let vs = [...ui.sel];
    if (!vs.length) { const v = G.villagers.filter(v => !v.inside && !(v.act && (v.act.type === 'sleep' || v.act.type === 'leave'))).sort((a, b) => Math.hypot(a.x - x[0], a.y - x[1]) - Math.hypot(b.x - x[0], b.y - x[1]))[0] || G.villagers[0]; if (v) vs = [v]; }
    const placed = ui.place, r = cmd.place(G, ui.place, x[0], x[1], vs, ui.rot);
    if (!r.ok) { say(r.reason); return; }
    if (placed === 'flagpole') setTimeout(() => api.openFlag(true), 50);   // a new flag: choose its colours and emblem right away
    ping(x[0] + (r.b.w - 1) / 2, x[1] + (r.b.h - 1) / 2, '#f2c14e'); buzz(); ui.coachPlaced = true;
    say(orderNote(G, 'place', vs, r.b), ui.lastTap);
    clearSel();
  }
  // Drawing a path line: the press starts it, the drag stretches it, a tap on another tile finishes a tapped line.
  ui.drawsLine = () => ui.place === 'path' && !ui.moving && !ui.modal;
  ui.lineDown = (x, y) => { if (ui.line && ui.line.tapped) { ui.line = { a: ui.line.a, b: [x, y] }; return; } ui.line = { a: [x, y], b: [x, y] }; };
  ui.lineMove = (x, y) => { if (ui.line) ui.line.b = [x, y]; };
  ui.lineUp = moved => { if (ui.line && !moved && ui.line.a[0] === ui.line.b[0] && ui.line.a[1] === ui.line.b[1]) ui.line.tapped = true; };
  function confirmLine() {
    const kind = ui.pathKind || 'dirt', G = g(), plan = linePlan(G, ui.line, ui.canPlace, kind); if (!plan || !(plan.n + plan.r)) return;
    let vs = [...ui.sel];
    if (!vs.length) { const t = plan.tiles[0], v = G.villagers.filter(v => !v.inside && !(v.act && (v.act.type === 'sleep' || v.act.type === 'leave'))).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0] || G.villagers[0]; if (v) vs = [v]; }
    let n = 0, r = 0;
    for (const t of plan.tiles) {
      if (t.relay) { if (cmd.relayPath(G, t.relay, kind).ok) r++; continue; }
      if (t.ok && ui.canPlace(t.x, t.y)) { const p = cmd.place(G, 'path', t.x, t.y, vs, 0, kind); if (p.ok) n++; else break; }
    }
    buzz(); say(n || r ? [n ? `${n} tile${n > 1 ? 's' : ''} of ${KIND_NAME[kind].toLowerCase()} path laid out; the villagers will lay it.` : '', r ? `${r} re-laid.` : ''].filter(Boolean).join(' ') : 'Nothing could be placed.', ui.lastTap);
    ui.line = null; clearSel();
  }
  function cancelPlace() { const was = ui.moving; ui.place = null; ui.ghost = null; ui.line = null; ui.moving = null; if (was) selectBuilding(was); }

  // ---------- rename dialog ----------
  api.openRename = v => {
    if (ui.modal || !v) return;
    ui.modal = true; pop.close();
    const input = el('input', { maxLength: 16, value: v.name });
    const done = okk => { if (okk) cmd.rename(g(), v, input.value); o.remove(); ui.modal = false; };
    const ok = el('button', { className: 'pbtn primary', textContent: 'OK' }), no = el('button', { className: 'pbtn', textContent: 'Cancel' });
    ok.onclick = () => done(true); no.onclick = () => done(false);
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
    const o = el('div', { id: 'nm' }, [el('div', { className: 'dlg' }, [el('b', { textContent: 'Name this villager' }), input, el('div', { className: 'pop-yn' }, [no, ok])])]);
    document.body.append(o); setTimeout(() => { input.focus(); input.select(); }, 50);
  };

  // ---------- selection ----------
  function syncHeld() { for (const v of g().villagers) v.held = ui.sel.has(v); }
  function clearSel() { ui.sel = new Set(); ui.selB = null; ui.selN = null; ui.place = null; ui.ghost = null; ui.line = null; ui.moving = null; ui.buildOpen = false; ui.mode = null; ui.more = false; ui.menuOpen = false; syncHeld(); }
  const idleList = () => g().villagers.filter(v => !v.act && !v.inside);
  function center(x, y) { const p = isoW(x, y); view.cam.x = p[0]; view.cam.y = p[1]; }
  function nextIdle() { const l = idleList(); if (!l.length) return; const v = l[ui.idleI++ % l.length]; clearSel(); ui.sel.add(v); syncHeld(); center(v.x, v.y); ping(v.x, v.y, '#fff3c4'); }
  function selectBuilding(b) { clearSel(); ui.selB = b; ping(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2, '#fff3c4'); }
  const ping = (x, y, c) => { ui.ping = { x, y, c, t: performance.now() }; };
  Object.assign(api, { clearSel, syncHeld, idleList, nextIdle });

  // ---------- hit testing ----------
  function critterAt(wx, wy) {
    let best = null, bd = 1e9;
    for (const c of g().critters || []) { const sx = (c.x - c.y) * 32, sy = (c.x + c.y) * 16 - (c.type === 'owl' ? 40 : c.type === 'frog' ? 0 : c.type === 'bear' ? 14 : c.type === 'fox' || c.type === 'raccoon' || c.type === 'wolf' ? 9 : 18), d = Math.hypot(wx - sx, wy - sy), r = Math.max(22, 26 / view.cam.z); if (d < r && d < bd) { bd = d; best = c; } }
    return best;
  }
  function villagerAt(wx, wy) {
    let best = null, bd = 1e9;
    for (const v of g().villagers) {
      if (v.inside) continue;
      const sx = (v.x - v.y) * 32, sy = (v.x + v.y) * 16, d = Math.hypot(wx - sx, (wy - (sy - 12)) * 0.8), r = Math.max(22, 26 / view.cam.z);   // a finger-sized target
      if (d < r && d < bd) { bd = d; best = v; }
    }
    return best;
  }
  function buildingAt(rx, ry) {
    for (const k of [1, 0]) {
      const a = rx + k, c = ry + k;
      if (!inMap(a, c)) continue;
      const id = g().w.occ[idx(a, c)];
      if (id > 0) { const b = g().bmap.get(id); if (b && (k === 0 || !BUILD[b.k].flat)) return b; }
    }
    return null;
  }
  function nodeAt(rx, ry) { for (const k of [1, 0]) { const a = rx + k, c = ry + k; if (inMap(a, c) && nodeKind(g().w, idx(a, c))) return idx(a, c); } return -1; }

  // ---------- taps on the map ----------
  function tap(rx, ry, wx, wy) {
    if (ui.modal) return;
    ui.lastTap = toScreen(wx, wy);
    if (sheet.key && !ui.place) { sheet.close(); return; }   // a tap outside a sheet just closes it
    const G = g(), vs = [...ui.sel];
    if (ui.place) {   // placing or moving: the first tap shows it there, ✓ (or the same spot again) places it
      if (ui.ghost && ui.ghost[0] === rx && ui.ghost[1] === ry) { confirmPlace(); return; }
      ui.ghost = [rx, ry]; return;
    }
    if (ui.mode === 'rally') {
      const fb = buildingAt(rx, ry), n = nodeAt(rx, ry);
      if (fb && fb.k === 'farm' && fb.done) cmd.setRally(G, { type: 'farm', id: fb.id });
      else if (n >= 0) cmd.setRally(G, { type: 'node', i: n });
      else if (walkable(G.w, rx, ry)) cmd.setRally(G, { type: 'tile', x: rx, y: ry });
      else { say('Pick a tree, field or open ground.'); return; }
      ui.mode = null; ping(rx, ry, '#e86a5a'); say('New villagers will head here first. 🚩'); return;
    }
    const hitV = villagerAt(wx, wy);
    if (ui.mode === 'plant' && !hitV) {
      if (!vs.length) { ui.mode = null; return; }
      const v = vs[ui.plantI++ % vs.length];
      if (cmd.orderPlant(G, v, rx, ry)) { ping(rx, ry, '#8fd16a'); say(`${v.name} will plant a sapling here. 🌱`); } else say('Saplings need open grass, a little away from buildings.');
      return;
    }
    const vis = (G.festival && G.festival.visitors || []).find(p => { const sx = (p.x - p.y) * 32, sy = (p.x + p.y) * 16; return Math.hypot(wx - sx, (wy - (sy - 12)) * 0.8) < Math.max(22, 26 / view.cam.z); });
    if (vis) { say('A visitor from up the road, here for the festival. 🎉'); return; }
    const hitC = critterAt(wx, wy);
    if (hitC) { const r = cmd.catchCritter(G, hitC.id); if (r.ok) { ping(hitC.x, hitC.y, '#fff3a0'); audio && audio.sfx && audio.sfx('tap'); } return; }
    if (hitV) {
      if (ui.mode === 'add') { if (ui.sel.has(hitV)) ui.sel.delete(hitV); else ui.sel.add(hitV); }
      else if (ui.sel.size === 1 && ui.sel.has(hitV)) { clearSel(); return; }
      else { clearSel(); ui.sel = new Set([hitV]); }
      ui.selB = null; ui.selN = null;
      syncHeld(); ping(hitV.x, hitV.y, '#fff3c4'); return;
    }
    const b = buildingAt(rx, ry), n = nodeAt(rx, ry);
    if (vs.length) {   // villagers selected: give them work where they tapped
      let note = null;
      if (b && !b.done) { cmd.orderBuild(G, vs, b); ping(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2, '#f2c14e'); note = orderNote(G, 'build', vs, b); }
      else if (b && BUILD[b.k].crop && b.done) { cmd.orderFarm(G, vs, b); ping(b.x + 0.5, b.y + 0.5, '#8fd16a'); note = orderNote(G, 'farm', vs, b); }
      else if (b && BUILD[b.k].craft && b.done) { cmd.orderCraft(G, vs, b); ping(b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2, '#8fd16a'); note = orderNote(G, 'craft', vs, b); }
      else if (n >= 0) { cmd.orderGather(G, vs, n); ping(n % N, (n / N) | 0, '#8fd16a'); note = orderNote(G, 'gather', vs, null, nodeKind(G.w, n)); }
      else if (b) { selectBuilding(b); say(orderNote(G, 'nowork', vs, b)); return; }
      else if (inMap(rx, ry) && G.w.T[idx(rx, ry)] !== WATER) { if (cmd.orderMove(G, vs, rx, ry)) { ping(rx, ry, '#ffffff'); note = orderNote(G, 'move', vs); } }
      else note = 'They can\'t walk on water. Tap the shore to fish or fetch water.';
      say(note); clearSel(); return;
    }
    // Hands-on: a ripe field or a bundle set aside is collected with a tap (the next tap selects as usual).
    if (b && b.ready) { const r = hands.collectReady(G, b); if (r.ok) { gotIt(r, b.x + (b.w - 1) / 2, b.y + (b.h - 1) / 2); return; } say(r.reason); }
    if (b && hands.ripe(G, b) && ui.selB !== b) { const r = hands.tapHarvest(G, b); if (r.ok) { gotIt(r, b.x + 0.5, b.y + 0.5); return; } }
    if (n >= 0 && nodeKind(G.w, n) === NODE.FISH) { clearSel(); openFishing({ g: G, ui, i: n, say, buzz }); return; }
    if (b) { selectBuilding(b); return; }
    if (n >= 0) { clearSel(); ui.selN = { type: 'node', i: n }; ping(n % N, (n / N) | 0, '#fff3c4'); return; }
    if (inMap(rx, ry) && G.w.G[idx(rx, ry)] > 0) { clearSel(); ui.selN = { type: 'sapling', i: idx(rx, ry) }; ping(rx, ry, '#fff3c4'); return; }
    clearSel();
  }
  function gotIt(r, x, y) {
    const [sx, sy] = toScreen(...isoW(x, y)), ic = r.res === 'food' ? (PANTRY_ICON[r.kind] || ICON.food) : ICON[r.res];
    floatText(`+${r.n} ${ic}`, sx, sy - 30 * view.cam.z); buzz(10); audio && audio.sfx && audio.sfx('tap'); ping(x, y, '#fff3a0');
  }
  api.openQuilt = () => { pop.close(); openQuilt({ g: g(), ui, say, buzz }); };
  api.openSorting = () => { sheet.close(); openSorting({ g: g(), ui, say, buzz }); };
  function hoverAt(rx, ry) {
    ui.hover = [rx, ry];
    if (!ui.sel.size || ui.place) { ui.hoverCells = null; return; }
    const n = nodeAt(rx, ry), b = buildingAt(rx, ry);
    ui.hoverCells = n >= 0 ? [[n % N, (n / N) | 0]] : b && b.k !== 'tc' ? Array.from({ length: b.w * b.h }, (_, i) => [b.x + i % b.w, b.y + ((i / b.w) | 0)]) : null;
  }

  // ---------- tips (tooltips.js) ----------
  const tips = createTooltips({ g, ACT, CARD_TIPS, say });

  // ---------- resource bar ----------
  { const h = $('hud'), item = (r, adv) => { const e = el('span', { id: 's-' + r, className: adv ? 'adv' : '' }, [ICON[r] + ' ', el('b', { id: 'r-' + r })]); e.dataset.tip = 'res-' + r; addFill(e); return e; }, grp = (id, label) => el('span', { id: 'g-' + id, className: 'grp adv' }, [label]);
    h.replaceChildren(...BASICS.map(r => item(r)), el('span', { id: 'pantry', className: 'grp sub adv' }), grp('farm', 'Farm'), ...FARM.map(r => item(r, true)), grp('goods', 'Goods'), ...GOODS.map(r => item(r, true)), el('span', { className: 'grp adv' }, ['']), (() => { const e = el('span', {}, ['🏠 ', el('b', { id: 'r-pop' })]); e.dataset.tip = 'res-pop'; return e; })(), (() => { const e = el('span', { id: 'r-age', className: 'adv' }); e.dataset.tip = 'res-age'; return e; })());
    h.append(el('div', { id: 'hfull', className: 'hfull adv', hidden: true }));
    h.addEventListener('click', e => { const t = e.target.closest('[data-tip]'); if (t && ui.hudMode === 2) tips.show(t); }); }   // compact bar: a tap opens it out; open: a tap explains

  // ---------- Director overlay (for the curious): directorview.js ----------
  const drawDirectors = () => directorView(g(), $('dir'));

  // One thing at a time: a menu sheet (Village, Book, Game, Build) tucks the bubble away. Sheets opened from a bubble
  // (Details, Upgrades, Market) keep it, so you can see what they belong to — except on a phone, where there is no room.
  const MENU_SHEETS = new Set(['build', 'village', 'storage', 'library', 'glossary', 'tree', 'game', 'flag']);
  const sheetHidesBubble = () => !!sheet.key && (MENU_SHEETS.has(sheet.key) || innerWidth < 700);

  // The compact bar: just the number, shortened from a thousand (1.4k); the line under it shows how full the store is.
  const short = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'm' : n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);

  // ---------- every frame ----------
  function sync() {
    const G = g();
    for (const v of ui.sel) if (!G.villagers.includes(v) || v.inside || (v.act && v.act.type === 'sleep' && v.act.phase === 'sleep')) ui.sel.delete(v);
    if (ui.selB && !G.bmap.has(ui.selB.id)) ui.selB = null;
    if (ui.moving && !G.bmap.has(ui.moving.id)) { ui.moving = null; ui.place = null; ui.ghost = null; }
    if (ui.selN && !(ui.selN.type === 'sapling' ? G.w.G[ui.selN.i] > 0 : G.w.A[ui.selN.i] > 0)) ui.selN = null;
    // The bubble: open what is selected, keep it pointing at its target.
    if (!ui.modal && !sheetHidesBubble()) { const s = bubbleSpec(); if (!s) pop.close(); else pop.open(s); pop.tick(); }
    else pop.close();
    sheet.tick();
    menus.tick();
    for (const r of RES) {
      const c = Math.floor(cap(G, r)), n = Math.floor(G.res[r]);
      { const t = ui.hudMode === 2 ? `${n}/${c}` : short(n); const e = $('r-' + r); if (e.textContent !== t) e.textContent = t; } syncFill(G, r, $('s-' + r));
      $('s-' + r).hidden = (GOODS.includes(r) || FARM.includes(r)) && !c && !n;
    }
    { const t = fullLine(G), e = $('hfull'); e.hidden = !t; if (e.textContent !== t) e.textContent = t; }
    for (const [id, list] of [['farm', FARM], ['goods', GOODS]]) $('g-' + id).hidden = list.every(r => $('s-' + r).hidden);
    { const p = G.pantry || {}, kinds = PANTRY.filter(k => (p[k] || 0) >= 1); $('pantry').hidden = !kinds.length; const key = kinds.map(k => k + Math.floor(p[k])).join(); if ($('pantry').dataset.k !== key) { $('pantry').dataset.k = key; $('pantry').replaceChildren(...kinds.map(k => { const e = el('span', { textContent: `${PANTRY_ICON[k]} ${Math.floor(p[k])}  ` }); e.dataset.tip = 'pan-' + k; return e; })); } }
    $('dir').hidden = ui.overlay !== 'directors';
    if (ui.overlay === 'directors' && (ui.dirT = (ui.dirT || 0) + 1) % 30 === 1) drawDirectors();
    { const t = `${G.villagers.length}/${popCap(G)}`; if ($('r-pop').textContent !== t) $('r-pop').textContent = t; }
    $('r-age').textContent = `${AGES[G.age].name} Age · 🎭 ${Math.floor(G.culture || 0)}${AGES[G.age + 1] ? '/' + AGES[G.age + 1].culture : ''} · ${SEASONS[seasonIndex(G)]}${darkness(G) > 0.6 ? ' 🌙' : ''}`;
    coach.tick();
    syncButtons();
  }

  // One thing at a time: opening a sheet clears the short notes and tips; menu sheets put the bubble away (sync).
  sheet.onOpen(() => { tips.hide(); sayEl.classList.remove('show'); });
  const menus = createMenus({ ui, g, sheet, pop, ACT, api, ctx, settings, audio, say, toast, cancelPlace, willLevel: () => cmd.willLevel(g()) });

  // ---------- keyboard ----------
  addEventListener('keydown', e => {
    if (ui.modal || (e.target && e.target.tagName === 'INPUT') || e.metaKey || e.ctrlKey || e.altKey) return;   // browser shortcuts stay the browser's
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'p') { ACT.pause.run(); return; }
    if (k === 'r' && (ui.place || ui.selB)) { ACT.rotate.run(); return; }
    if (k === 'enter' && ui.place) { confirmPlace(); return; }
    if (k === 'b') api.openBuild();
    else if (k === 'm') menus.tap('game');
    else if (k === 'h') api.goHome();
    else if (k === '.') nextIdle();
    else if (k === 'escape') { if (pop.confirming) pop.close(); else if (sheet.key) sheet.close(); else if (ui.place) cancelPlace(); else clearSel(); }
  });

  g().events.on('notice', t => toast(t));
  return Object.assign(ui, { tap, hoverAt, sync, toast, say, clearSel, rebind() { g().events.on('notice', t => toast(t)); clearSel(); sheet.close(); } });
}
