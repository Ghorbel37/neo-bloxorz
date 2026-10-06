// Tiny synthesized sound effects (no audio files needed).
(function (root) {
  let ctx = null;
  let enabled = true;

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, duration, opts) {
    const c = ensure();
    if (!c) return;
    const o = opts || {};
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(o.volume || 0.12, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  const SHAPE_NOTES = [523.25, 440, 392, 329.63];
  const Sound = {
    setEnabled(v) { enabled = !!v; },
    unlock() { ensure(); },
    move(shape) { tone(SHAPE_NOTES[shape] || 440, 0, 0.09, { type: 'triangle', volume: 0.09 }); },
    toggle() { tone(880, 0, 0.05, { type: 'square', volume: 0.05 }); tone(1320, 0.05, 0.06, { type: 'square', volume: 0.05 }); },
    fall() { tone(420, 0, 0.45, { type: 'sawtooth', to: 60, volume: 0.07 }); },
    shatter() { for (let i = 0; i < 5; i++) tone(2000 + Math.random() * 2000, i * 0.03, 0.05, { type: 'square', volume: 0.03 }); },
    win() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.08, 0.22, { type: 'triangle', volume: 0.1 })); },
    lose() { tone(220, 0, 0.25, { type: 'square', volume: 0.06 }); tone(165, 0.22, 0.4, { type: 'square', volume: 0.06 }); },
    perk() { [659.25, 987.77].forEach((f, i) => tone(f, i * 0.07, 0.18, { type: 'sine', volume: 0.1 })); },
    tick() { tone(1200, 0, 0.03, { type: 'square', volume: 0.03 }); },
    tap() { tone(660, 0, 0.04, { type: 'sine', volume: 0.05 }); },
  };

  root.Sound = Sound;
})(window);
