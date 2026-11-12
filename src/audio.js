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
    default: burst(0.06, 900, 1, 0.3 * v);
  }
}

export function whoosh(strength) { burst(0.22, 900 + strength * 700, 0.6, 0.06 + strength * 0.08); }
export function chairRoll(speed) { if (speed > 0.15 && Math.random() < 0.25) burst(0.08, 260, 0.9, Math.min(0.08, speed * 0.05)); }
