// The sheets opened from buttons: the Build menu (tabs of building cards), upgrades, the animal library, storage,
// the Book (glossary, what unlocks what), the marketplace, a building's details, and looking inside.
// Also the tip texts (CARD_TIPS) for cards, resources and upgrades, which the tips in ui.js show.
//   const S = createSheets({ ui, g, sheet, pop, api, say, toast, off, menus: () => menus })   fills api.open*, returns { CARD_TIPS, BUILD_FARM }
import { BUILD_GROUPS, RES_DESC, PANTRY, PANTRY_ICON, BUILD, BUILD_ORDER, ICON, RES, RES_NAME, UPGRADES, SEASONS, TRADE } from '../core/config.js';
import { cap } from '../core/state.js';
import { researchCost } from '../core/research.js';
import { waresFor, warePrice } from '../core/merchant.js';
import * as cmd from '../core/commands.js';
import * as hands from '../core/handson.js';
import { shortOf, buildNeeds, upgradeNeeds } from '../core/requires.js';
import { CRITTERS, HOME_DECOR, LANTERN_UNLOCK } from '../core/critters.js';
import { openInterior } from './interior/index.js';
import { el, fmt } from './dom.js';
import { buildingTitle, buildingDetails } from './panels.js';
import { oneLine } from './tips.js';
import { storageSheet } from './storage.js';
import { glossarySheet } from './glossary.js';
import { treeSheet } from './trees.js';

export function createSheets(c) {
  const { ui, g, sheet, pop, api, say, toast, off } = c;
// ---------- sheets: build menu, upgrades, market, details ----------
const CARD_TIPS = {};
const BUILD_FARM = k => ({ farm: 1, wheatfield: 1, fiberfield: 1, coop: 1, sheepfold: 1, pasture: 1, apiary: 1 })[k] ? ({ farm: 1, wheatfield: 1, fiberfield: 1 })[k] ? 'Joins a farmhouse: touching it, or a field joined to it' : 'Goes within 4 tiles of a farmhouse' : '';
for (const k of BUILD_ORDER) CARD_TIPS['card-' + k] = { tip: [BUILD[k].name, oneLine(BUILD[k].desc) + (BUILD_FARM(k) ? ' ' + BUILD_FARM(k) + '.' : '')], cost: BUILD[k].cost };
for (const r of RES) CARD_TIPS['res-' + r] = { tip: [`${ICON[r]} ${RES_NAME[r]}`, oneLine(RES_DESC[r] || '')] };
const PANTRY_NAME = { pumpkins: 'Pumpkins', pies: 'Pumpkin pies', provisions: 'Provisions (mixed stores)', berries: 'Berries', fish: 'Fish', vegetables: 'Vegetables', bread: 'Bread', eggs: 'Eggs', cheese: 'Cheese', honey: 'Honey' };
for (const k of PANTRY) CARD_TIPS['pan-' + k] = { tip: [`${PANTRY_ICON[k]} ${PANTRY_NAME[k] || k}`, 'Part of the food in the pantry.'] };
CARD_TIPS['res-pop'] = { tip: ['🏠 Villagers', 'How many live here, and how many the village has room for.'] };
CARD_TIPS['res-age'] = { tip: ['Age, culture and season', 'The village age; 🎭 culture now and needed for the next age; the season.'] };
for (const u of UPGRADES) CARD_TIPS['up-' + u.id] = { tip: [u.name, oneLine(u.desc)], cost: u.cost };
CARD_TIPS.hud = { tip: ['Resources', 'Tap once for the basics, again for everything, a third time to close.'] };

api.openBuild = () => {
  const vs = [...ui.sel]; pop.close();
  sheet.open({ key: 'build', title: 'Build', build: buildSheet, refresh: syncCards, onClose: () => { if (!ui.place) ui.buildOpen = false; } });
  ui.buildOpen = true; ui.sel = new Set(vs);
};
function buildSheet(body) {
  const G = g();
  const ks = BUILD_ORDER.filter(k => BUILD[k].age <= G.age && !(BUILD[k].unlock && !G.unlocked[k]) && !(k === 'tc' && G.buildings.some(b => b.k === 'tc')) && !(BUILD[k].onlyOne && G.buildings.some(b => b.k === k)));
  const avail = new Set(ks), groups = BUILD_GROUPS.map(([label, list, icon]) => ({ label, icon, here: list.filter(k => avail.has(k)) }));
  if (!groups.some(gp => gp.label === ui.buildCat && gp.here.length)) ui.buildCat = (groups.find(gp => gp.here.length) || {}).label;
  const tabs = el('div', { className: 'tabs' });
  for (const gp of groups) {
    const b = el('button', { className: 'tab' + (ui.buildCat === gp.label ? ' on' : '') }, [el('span', { textContent: gp.icon }), el('small', { textContent: gp.label })]);
    b.disabled = !gp.here.length; b.onclick = () => { ui.buildCat = gp.label; sheet.rebuild(); };
    tabs.append(b);
  }
  const gp = groups.find(x => x.label === ui.buildCat), grid = el('div', { className: 'cards' });
  if (gp) for (const k of gp.here) grid.append(card(k));
  body.append(tabs, grid);
  syncCards(body);
}
function card(k) {
  const d = BUILD[k], b = el('button', { className: 'card' }, [el('span', { className: 'cn', textContent: (d.icon ? d.icon + ' ' : '') + d.name }), el('small', { textContent: fmt(d.cost) || 'Free' })]);
  b.dataset.k = k; b.dataset.tip = 'card-' + k;
  b.onclick = () => { ui.place = k; ui.rot = 0; ui.ghost = null; ui.line = null; sheet.close(); toast(k === 'path' ? 'Drag across the ground to draw the path.' : 'Tap the ground where it should go.'); };
  return b;
}
// A greyed card says in a few words what it is waiting for; a tap or a long press gives the whole reason.
const shortWhy = why => { const t = why.split(/[:.;(]/)[0].trim(); return t.length > 44 ? t.slice(0, 42).replace(/\s+\S*$/, '') + '…' : t; };
function syncCards(body) { for (const b of body.querySelectorAll('button.card')) { const why = buildNeeds(g(), b.dataset.k); off(b, why); let e = b.querySelector('.cwhy'); if (why && !e) b.append(e = el('small', { className: 'cwhy' })); if (e) { e.hidden = !why; const t = why ? '🔒 ' + shortWhy(why) : ''; if (e.textContent !== t) e.textContent = t; } } }

api.openUpgrades = () => {
  const b0 = ui.selB, at = b0 && (b0.k === 'campfire' ? 'tc' : b0.k);
  sheet.open({ key: 'up' + b0.id, title: 'Upgrades: ' + buildingTitle(b0), build: body => {
    const G = g(), list = UPGRADES.filter(u => u.at === at && (!u.req || G.owned[u.req]));
    for (const u of list) {
      const owned = G.owned[u.id], need = upgradeNeeds(G, u), b = el('button', { className: 'wide' }, [el('span', { textContent: u.name + (owned ? ' ✓' : '  ' + fmt(researchCost(G, u))) }), el('small', { textContent: u.desc }), need ? el('small', { className: 'cneed', textContent: need }) : null]);
      b.dataset.tip = 'up-' + u.id; off(b, owned ? 'Already done.' : need);
      b.onclick = () => { cmd.research(G, u.id); say(`${u.name}: done. ✨`); sheet.rebuild(); };
      body.append(b);
    }
    if (!list.length) body.append(el('small', { textContent: 'Nothing more for now.' }));
  } });
};
// The Animal library: every animal ever collected stays here, unlocked, even after it has been spent on a treasure.
api.openLibrary = () => {
  pop.close();
  sheet.open({ key: 'library', title: 'Animal library', build: body => {
    body.append(back());
    const G = g(), caught = G.caught || {}, spent = G.spent || {};
    const unlocks = k => Object.values(HOME_DECOR).filter(d => d.critter === k).map(d => `${d.name} (${d.n})`).concat(k === 'firefly' ? [`firefly lantern posts (${LANTERN_UNLOCK} caught)`] : []);
    const when = C => C.night ? `Wanders in on ${C.night >= 0.4 ? 'some' : C.night >= 0.2 ? 'a few' : C.night >= 0.1 ? 'rare' : 'very rare'} nights.` : 'Out at night in ' + C.seasons.map(i => SEASONS[i].toLowerCase()).join(', ') + '.';
    body.append(el('small', { textContent: 'Tap animals at night to collect them. Spend them on treasures inside homes (Look inside → Furnish → Treasures).' }));
    for (const [k, C] of Object.entries(CRITTERS)) {
      const n = caught[k] || 0, left = n - (spent[k] || 0), seen = n > 0;
      const row = el('div', { className: 'wide libro' + (seen ? '' : ' unseen') }, [
        el('span', { textContent: `${seen ? C.icon : '❔'} ${seen ? C.name.charAt(0).toUpperCase() + C.name.slice(1) : 'Not found yet'}${seen ? `  ·  collected ${n} · ${left} to spend` : ''}` }),
        el('small', { textContent: (seen ? 'Unlocked: ' : 'Unlocks: ') + unlocks(k).join(', ') + '. ' + when(C) })]);
      body.append(row);
    }
  } });
};
// A way back to the Village list, and the Book's two pages side by side.
const back = () => { const b = el('button', { className: 'shback', textContent: '‹ Village' }); b.onclick = () => c.menus().openVillage(); return b; };
const bookTabs = cur => el('div', { className: 'seg' }, [['glossary', 'Glossary', () => api.openGlossary()], ['tree', 'What unlocks what', () => api.openTree()]].map(([k, t, f]) => { const b = el('button', { className: k === cur ? 'on' : '', textContent: t }); b.onclick = f; return b; }));
api.openStorage = () => { pop.close(); sheet.open({ key: 'storage', title: 'Storage', build: body => { body.append(back()); storageSheet(g())(body); } }); };
api.openGlossary = () => { pop.close(); const gl = glossarySheet(); sheet.open({ key: 'glossary', title: 'Book', full: true, build: body => { body.append(bookTabs('glossary')); gl(body); } }); };
api.openTree = () => { pop.close(); sheet.open({ key: 'tree', title: 'Book', full: true, build: body => { body.append(bookTabs('tree')); treeSheet(g(), t => say(t), ui)(body); } }); };
api.openMarket = () => {
  sheet.open({ key: 'market', title: 'Marketplace', build: body => {
    const G = g();
    const pick = (label, cur, set) => el('div', { className: 'row' }, [el('span', { textContent: label, className: 'lbl' }), ...RES.filter(r => cap(G, r) > 0).map(r => { const b = el('button', { className: 'ic sm' + (cur === r ? ' on' : ''), textContent: ICON[r] }); b.onclick = () => { set(r); sheet.rebuild(); }; return b; })]);
    const go = el('button', { className: 'pbtn primary', textContent: `Trade ${TRADE.give}${ICON[ui.give]} for ${TRADE.get}${ICON[ui.get]}` });
    off(go, ui.give === ui.get ? 'Pick two different resources.' : shortOf(G, { [ui.give]: TRADE.give }));
    go.onclick = () => { cmd.trade(G, ui.give, ui.get); sheet.rebuild(); };
    body.append(pick('Give', ui.give, r => { ui.give = r; }), pick('Get', ui.get, r => { ui.get = r; }), go);
    const vis = G.merchant.visit;
    if (vis && vis.phase === 'trade') {
      if (!vis.sorted) { const h = el('button', { className: 'wide' }, [el('span', { textContent: "🧺 Help sort the merchant's cart" }), el('small', { textContent: `Put each piece in its crate. The merchant pays ${hands.HANDS.sortPay} 🪙 for the help.` })]); h.onclick = () => api.openSorting(); body.append(h); }
      body.append(el('b', { textContent: 'The merchant sells' }));
      for (const w of waresFor(G)) {
        const price = warePrice(G, w), b = el('button', { className: 'wide' }, [el('span', { textContent: `${w.name}  ${price}${ICON.gold}` }), el('small', { textContent: w.desc })]);
        off(b, shortOf(G, { gold: price }));
        b.onclick = () => { const r = cmd.buyWare(G, w.id); if (!r.ok) say(r.reason); sheet.rebuild(); };
        body.append(b);
      }
    } else body.append(el('small', { textContent: 'When the merchant is here, their wares show up here.' }));
  } });
};
api.openDetails = () => {
  const b0 = ui.selB; if (!b0) return;
  sheet.open({ key: 'info' + b0.id, title: buildingTitle(b0), build: body => { body.append(el('ul', { className: 'details' }, buildingDetails(g(), b0).map(t => el('li', { textContent: t })))); },
    refresh: body => { const ul = body.querySelector('ul'), lines = buildingDetails(g(), b0); if (ul && ul.dataset.k !== lines.join('|')) { ul.dataset.k = lines.join('|'); ul.replaceChildren(...lines.map(t => el('li', { textContent: t }))); } } });
};
api.openInside = b => { if (ui.modal || !b) return; ui.modal = true; pop.close(); openInterior(g(), b, () => { ui.modal = false; }); };

  return { CARD_TIPS, BUILD_FARM };
}
