// Welcoming new villagers takes time, and good spirits speed it up. Each welcome waits in line at the town center:
// half a day with spirits at 100%, twice as long at 50%, three times as long at 0% (RECRUIT.base × (3 − 2 × spirits)).
// The time left is re-read every moment, so a festival that lifts spirits shortens the wait.
import { DAY } from './config.js';

export const RECRUIT = { base: DAY / 2 };
export const recruitFactor = g => 3 - 2 * Math.max(0, Math.min(1, g.social ?? 1));
export const recruitTime = g => RECRUIT.base * recruitFactor(g);
const line = g => (g.recruits = g.recruits || []);
export const waiting = g => line(g).length;

// Start a welcome (the cost is already paid). done(g) is called when it completes.
export function queueRecruit(g) { line(g).push({ p: 0 }); }
// Progress, 0..1, of the welcome at the front of the line.
export const progress = g => (line(g)[0] ? line(g)[0].p : 0);
// Seconds left for the one at the front, at today's spirits.
export const secondsLeft = g => (line(g)[0] ? (1 - line(g)[0].p) * recruitTime(g) : 0);

export function recruitTick(g, dt, arrive) {
  const q = line(g); if (!q.length) return;
  q[0].p += dt / recruitTime(g);
  if (q[0].p >= 1) { q.shift(); arrive(g); }
}
