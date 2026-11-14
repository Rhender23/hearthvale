// Soft sound: a wind bed, occasional gentle notes, and small effects tied to game events.
export function createAudio() {
  let AC = null, on = true, last = 0, pluckT = 0, master = null, volume = 0.7;
  function start() {
    if (AC || !on) return;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = volume * 1.4; master.connect(AC.destination);   // the volume slider sets this
      const b = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const n = AC.createBufferSource(); n.buffer = b; n.loop = true;
      const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      const gn = AC.createGain(); gn.gain.value = 0.035;
      n.connect(f); f.connect(gn); gn.connect(master); n.start();
      pluckT = setInterval(pluck, 2600);
    } catch (e) { AC = null; }
  }
  const live = () => AC && on && AC.state === 'running';
  function tone(type, f0, f1, vol, dur) {
    const t = AC.currentTime, o = AC.createOscillator(), gn = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.75);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + 0.015); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function pluck() { if (!live() || Math.random() < 0.35) return; const sc = [0, 2, 4, 7, 9], n = sc[(Math.random() * 5) | 0] + (Math.random() < 0.5 ? 0 : 12); tone('sine', 261.63 * Math.pow(2, n / 12), 0, 0.05, 2.2); }
  function sfx(kind) {
    if (!live() || performance.now() - last < 110) return;
    last = performance.now();
    if (kind === 'chop') tone('triangle', 180, 70, 0.07, 0.12);
    else if (kind === 'done') tone('sine', 523, 0, 0.08, 1.2);
    else if (kind === 'age') { tone('sine', 523, 0, 0.07, 1.4); setTimeout(() => tone('sine', 659, 0, 0.07, 1.4), 160); setTimeout(() => tone('sine', 784, 0, 0.07, 1.6), 320); }
    else if (kind === 'tap') tone('sine', 880, 0, 0.02, 0.15);
  }
  return {
    start, sfx,
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (master) master.gain.value = volume * 1.4; },
    setOn(v) { on = v; if (!AC) return; if (on) AC.resume(); else AC.suspend(); }, // sound only starts after the first tap
    bind(g) {
      g.events.on('gathered', ({ k }) => { if (k === 1) sfx('chop'); });
      g.events.on('built', () => sfx('done'));
      g.events.on('age', () => sfx('age'));
      // A cheerful little tune loops while the festival is on.
      let tune = null;
      g.events.on('festival', () => { clearInterval(tune); let k = 0; const mel = [0, 4, 7, 12, 7, 4, 5, 9, 12, 9, 7, 4, 2, 7, 11, 14]; tune = setInterval(() => { if (!g.festival) { clearInterval(tune); return; } if (live()) tone('triangle', 392 * Math.pow(2, mel[k++ % mel.length] / 12), 0, 0.04, 0.35); }, 260); });
    },
  };
}
