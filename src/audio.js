// Placeholder sound, generated in code: fluorescent hum, air vent, clock tick, impact thunks.
let ctx = null, master = null;

export function startAudio() {
  if (ctx) { ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);

  // fluorescent light hum (120 Hz + harmonics, very quiet)
  const humGain = ctx.createGain(); humGain.gain.value = 0.018; humGain.connect(master);
  [120, 240, 360].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = i === 0 ? 'sawtooth' : 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); g.gain.value = [0.5, 0.25, 0.12][i];
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    o.connect(lp); lp.connect(g); g.connect(humGain); o.start();
  });
  // slow flicker on the hum
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.006; lfo.connect(lfoGain); lfoGain.connect(humGain.gain); lfo.start();

  // air vent: filtered brown noise
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; data[i] = last * 3.2; }
  const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const nlp = ctx.createBiquadFilter(); nlp.type = 'lowpass'; nlp.frequency.value = 420;
  const ng = ctx.createGain(); ng.gain.value = 0.11;
  noise.connect(nlp); nlp.connect(ng); ng.connect(master); noise.start();
}

export function stopAudio() { if (ctx) ctx.suspend(); }

function burst(duration, freq, q, gain, pan = 0) {
  if (!ctx || ctx.state !== 'running') return;
  const n = Math.floor(ctx.sampleRate * duration);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const s = ctx.createBufferSource(); s.buffer = b;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = ctx.createGain(); g.gain.value = gain;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  s.connect(bp); bp.connect(g);
  if (p) { p.pan.value = pan; g.connect(p); p.connect(master); } else g.connect(master);
  s.start();
}

function ring(freq, gain, decay) {
  if (!ctx || ctx.state !== 'running') return;
  const o = ctx.createOscillator(); o.frequency.value = freq; o.type = 'sine';
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + decay);
  o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + decay + 0.05);
}

export function tick(pan = 0) { burst(0.025, 3200, 4, 0.09, pan); }

export function impact(kind, speed) {
  const v = Math.min(1, speed / 5);
  switch (kind) {
    case 'paper': burst(0.06, 1800 + Math.random() * 600, 0.8, 0.12 * v + 0.03); break;
    case 'pencil': burst(0.03, 4200, 3, 0.25 * v + 0.04); ring(2400 + Math.random() * 400, 0.015 * v, 0.08); break;
    case 'heavy': burst(0.09, 700, 1.4, 0.5 * v + 0.06); break;
    case 'ceramic': burst(0.05, 1600, 2, 0.4 * v + 0.05); ring(1900, 0.04 * v, 0.25); ring(2870, 0.02 * v, 0.18); break;
    case 'plastic': burst(0.04, 2200, 1.6, 0.3 * v + 0.04); burst(0.05, 600, 1.2, 0.15 * v); break;
    case 'metal': burst(0.05, 1300, 3, 0.3 * v + 0.05); ring(880 + Math.random() * 60, 0.03 * v, 0.35); ring(1410, 0.015 * v, 0.25); break;
    default: burst(0.06, 900, 1, 0.3 * v);
  }
}

export function bump() { burst(0.12, 300, 0.8, 0.5); burst(0.05, 1200, 2, 0.15); }
export function peel() { burst(0.09, 3200, 0.7, 0.07); }
export function whoosh(strength) { burst(0.22, 900 + strength * 700, 0.6, 0.06 + strength * 0.08); }
export function chairRoll(speed) { if (speed > 0.15 && Math.random() < 0.25) burst(0.08, 260, 0.9, Math.min(0.08, speed * 0.05)); }

// ---- Stage 2 sounds
export function scratch() { burst(0.07, 2600 + Math.random() * 500, 1.2, 0.1); }
export function pageTurn() { burst(0.18, 1500, 0.5, 0.09); }
// the paper shredder's motor chewing through a sheet
export function shredder(duration) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07, t + 0.08);
  g.gain.setValueAtTime(0.07, t + duration - 0.15); g.gain.linearRampToValueAtTime(0.0001, t + duration);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
  [92, 184, 187, 370].forEach((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(t); o.stop(t + duration + 0.05); });
  lp.connect(g); g.connect(master);
  for (let k = 0; k < duration / 0.07; k++) setTimeout(() => burst(0.06, 3000 + Math.random() * 1500, 0.7, 0.05), k * 70);
}
// a small, warm two-note chime when the world notices something you did
export function chime() { ring(660, 0.05, 0.9); setTimeout(() => ring(990, 0.04, 1.2), 140); }

// ---- Stage 3 sounds: the computer and the printer
function tone(freq, dur, gain = 0.04, type = 'square', slideTo = null) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
export function computer(name) {
  switch (name) {
    case 'click': burst(0.02, 2400, 3, 0.12); break;
    case 'boot': tone(880, 0.22, 0.035); burst(1.2, 500, 0.6, 0.03); break;            // POST beep + the drive spinning up
    case 'chime': tone(523, 0.5, 0.03, 'triangle'); setTimeout(() => tone(784, 0.7, 0.03, 'triangle'), 160); break;
    case 'error': tone(196, 0.18, 0.04); break;
    case 'start': tone(440, 0.08, 0.03); setTimeout(() => tone(660, 0.12, 0.03), 80); break;
    case 'jump': tone(420, 0.14, 0.025, 'square', 760); break;
    case 'crash': tone(300, 0.35, 0.04, 'sawtooth', 60); burst(0.2, 400, 0.7, 0.15); break;
    case 'warp': tone(300, 0.7, 0.025, 'triangle', 1400); break;
    default: break;
  }
}
// the printer hauling a page through
export function printer(duration) {
  if (!ctx || ctx.state !== 'running') return;
  for (let k = 0; k < duration / 0.11; k++) setTimeout(() => { burst(0.09, 900 + (k % 4) * 260, 2.5, 0.07); if (k % 5 === 0) tone(1500 + (k % 3) * 200, 0.06, 0.008); }, k * 110);
}
export function pin() { burst(0.03, 1800, 2, 0.2); burst(0.05, 500, 1.2, 0.12); }

// ---- Stage 4 sounds
// a slow, warm chord that swells while you dream
export function dream(duration) {
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  [220, 277.18, 329.63, 493.88, 659.26].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = i < 3 ? 'sine' : 'triangle'; o.frequency.value = f * (1 + (i - 2) * 0.0015);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(i < 3 ? 0.03 : 0.012, t + 3 + i * 0.5);
    g.gain.setValueAtTime(i < 3 ? 0.03 : 0.012, t + duration - 2.5); g.gain.linearRampToValueAtTime(0.0001, t + duration);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + duration + 0.1);
  });
}
export function drum(lane, good) {
  if (lane === 0) { burst(0.05, 1700, 2, 0.32); ring(1900, 0.045, 0.3); ring(2870, 0.02, 0.2); }      // pencil on the coffee mug
  else { burst(0.07, 520, 1.6, 0.5); burst(0.03, 3000, 2, 0.1); }                                      // pencil on the desk
  if (good) ring(lane === 0 ? 1318 : 880, 0.012, 0.12);
}
export function lever() { burst(0.05, 900, 2, 0.3); burst(0.3, 300, 0.8, 0.12); }

// ---- Stage 5 sounds
// something on the other side of the wall knocks your rhythm back
export function knock() {
  const pattern = [0, 0.54, 0.81, 1.08, 1.62, 1.89];
  pattern.forEach((t) => setTimeout(() => { burst(0.09, 150, 1.2, 0.5, -0.8); burst(0.05, 420, 1.5, 0.12, -0.8); }, t * 1000));
}
export function glitch() { burst(0.5, 2400, 0.4, 0.22); tone(58, 0.7, 0.07, 'sawtooth', 40); }
