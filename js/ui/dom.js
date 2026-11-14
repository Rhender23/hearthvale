// Small DOM helpers shared by the interface modules.
import { ICON } from '../core/config.js';

export const $ = id => document.getElementById(id);
export const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); for (const k of kids) if (k != null) e.append(k); return e; };
export const fmt = c => Object.entries(c || {}).filter(([, v]) => v).map(([k, v]) => v + (ICON[k] || ' ' + k)).join(' ');
export const val = f => typeof f === 'function' ? f() : f;
export const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
export const reduceMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
export const buzz = (ms = 10) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* not supported (iPhone) */ } };
