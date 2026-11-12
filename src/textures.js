// Procedural placeholder textures drawn on canvases (no image files needed).
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeatX = 1, repeatY = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Seeded random so the room looks the same every time.
let seed = 1337;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }

export function carpet() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#4b596b'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = rnd();
    g.fillStyle = v > 0.5 ? `rgba(120,135,155,${0.25 * rnd()})` : `rgba(20,25,35,${0.35 * rnd()})`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  return tex(c, 6, 6);
}

export function fabric() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#80867c'; g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 2) {
    g.fillStyle = `rgba(0,0,0,${0.04 + 0.04 * rnd()})`; g.fillRect(x, 0, 1, 256);
  }
  for (let y = 0; y < 256; y += 2) {
    g.fillStyle = `rgba(255,255,255,${0.02 + 0.03 * rnd()})`; g.fillRect(0, y, 256, 1);
  }
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(30,35,40,${0.15 * rnd()})`; g.fillRect(rnd() * 256, rnd() * 256, 1, 1);
  }
  return tex(c, 3, 3);
}

export function laminate() {
  const [c, g] = canvas(512, 128);
  g.fillStyle = '#c4b596'; g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 70; i++) {
    const y = rnd() * 128;
    g.strokeStyle = `rgba(110,90,60,${0.08 + 0.1 * rnd()})`;
    g.lineWidth = 0.5 + rnd() * 1.5;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 3 + (rnd() - 0.5) * 2);
    g.stroke();
  }
  return tex(c, 1, 1);
}

export function keyboard() {
  const [c, g] = canvas(256, 96);
  g.fillStyle = '#cfc6ae'; g.fillRect(0, 0, 256, 96);
  const rows = [14, 14, 13, 12, 7];
  rows.forEach((n, r) => {
    const kw = (r === 4 ? 30 : 16);
    for (let i = 0; i < n; i++) {
      const x = 6 + i * (r === 4 ? 34 : 17.6) + (r === 4 ? 6 : r * 3);
      g.fillStyle = '#e8e1cd'; g.fillRect(x, 6 + r * 17.5, r === 4 && i === 3 ? 90 : kw - 2, 14);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, 6 + r * 17.5 + 12, r === 4 && i === 3 ? 90 : kw - 2, 2);
    }
  });
  return tex(c);
}

export function crtScreen() {
  const [c, g] = canvas(256, 192);
  const grd = g.createRadialGradient(128, 96, 10, 128, 96, 150);
  grd.addColorStop(0, '#2b3330'); grd.addColorStop(1, '#0d100f');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 192);
  for (let y = 0; y < 192; y += 3) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, 256, 1); }
  // faint reflection streak
  g.fillStyle = 'rgba(255,255,255,0.05)';
  g.beginPath(); g.moveTo(20, 10); g.lineTo(110, 10); g.lineTo(60, 90); g.lineTo(12, 90); g.fill();
  return tex(c);
}

export function paper(lines = true) {
  const [c, g] = canvas(128, 166);
  g.fillStyle = '#f2efe6'; g.fillRect(0, 0, 128, 166);
  if (lines) {
    for (let y = 22; y < 160; y += 7) { g.fillStyle = 'rgba(70,70,70,0.35)'; g.fillRect(14, y, 70 + rnd() * 30, 2); }
    g.fillStyle = 'rgba(40,40,40,0.6)'; g.fillRect(14, 10, 60, 4);
  }
  return tex(c);
}

export function spreadsheet() {
  const [c, g] = canvas(128, 166);
  g.fillStyle = '#f4f2ea'; g.fillRect(0, 0, 128, 166);
  g.strokeStyle = 'rgba(60,80,60,0.45)'; g.lineWidth = 1;
  for (let y = 16; y < 160; y += 8) { g.beginPath(); g.moveTo(8, y); g.lineTo(120, y); g.stroke(); }
  for (let x = 8; x <= 120; x += 22) { g.beginPath(); g.moveTo(x, 16); g.lineTo(x, 160); g.stroke(); }
  g.fillStyle = 'rgba(40,40,40,0.55)'; g.fillRect(8, 6, 50, 5);
  for (let y = 18; y < 156; y += 8) for (let x = 10; x < 118; x += 22) g.fillRect(x + 2, y + 2, 6 + rnd() * 10, 3);
  return tex(c);
}

export function calendar() {
  const [c, g] = canvas(256, 360);
  g.fillStyle = '#f3f0e6'; g.fillRect(0, 0, 256, 360);
  // picture: a lake and mountains (the only "nature" in the room)
  const sky = g.createLinearGradient(0, 0, 0, 150);
  sky.addColorStop(0, '#7fb3d9'); sky.addColorStop(1, '#d8ecf5');
  g.fillStyle = sky; g.fillRect(10, 10, 236, 150);
  g.fillStyle = '#5c7a5a';
  g.beginPath(); g.moveTo(10, 120); g.lineTo(70, 50); g.lineTo(120, 105); g.lineTo(170, 40); g.lineTo(246, 115); g.lineTo(246, 160); g.lineTo(10, 160); g.fill();
  g.fillStyle = '#f7f7f2';
  g.beginPath(); g.moveTo(160, 52); g.lineTo(170, 40); g.lineTo(181, 54); g.fill();
  g.fillStyle = '#3f78a6'; g.fillRect(10, 128, 236, 32);
  // month header
  g.fillStyle = '#2e2e33'; g.font = 'bold 22px Georgia, serif'; g.textAlign = 'center';
  g.fillText('MARCH', 128, 190);
  g.font = '10px Arial'; g.fillStyle = '#555';
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach((d, i) => g.fillText(d, 28 + i * 33.3, 208));
  g.strokeStyle = '#999'; g.lineWidth = 1;
  for (let r = 0; r <= 5; r++) { g.beginPath(); g.moveTo(12, 214 + r * 27); g.lineTo(244, 214 + r * 27); g.stroke(); }
  for (let k = 0; k <= 7; k++) { g.beginPath(); g.moveTo(12 + k * 33.1, 214); g.lineTo(12 + k * 33.1, 349); g.stroke(); }
  g.font = '11px Arial'; g.fillStyle = '#333'; g.textAlign = 'left';
  let day = 1;
  for (let r = 0; r < 5; r++) for (let k = 0; k < 7; k++) {
    if (r === 0 && k < 3) continue;
    if (day > 31) break;
    g.fillText(String(day++), 15 + k * 33.1, 226 + r * 27);
  }
  return tex(c);
}

export function clockFace() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#f4f2ec'; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#222'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    g.fillText(String(i), 128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96);
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r0 = i % 5 === 0 ? 108 : 114;
    g.strokeStyle = '#333'; g.lineWidth = i % 5 === 0 ? 3 : 1.2;
    g.beginPath(); g.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); g.lineTo(128 + Math.cos(a) * 120, 128 + Math.sin(a) * 120); g.stroke();
  }
  return tex(c);
}

export function wireMesh() {
  const [c, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = '#fff'; g.lineWidth = 2.2;
  for (let i = -128; i < 256; i += 12) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke();
    g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke();
  }
  const t = tex(c, 4, 2, false);
  return t;
}

// ---------- Added for the reference-matched cubicle ----------

export function ceilingTiles() {
  // 60 cm acoustic tiles in a metal T-bar grid. One texture repeat = one tile.
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#e4e2dc'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(90,88,80,${0.12 + 0.25 * rnd()})`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }
  g.fillStyle = '#c9c8c3'; g.fillRect(0, 0, 256, 6); g.fillRect(0, 0, 6, 256);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(6, 6, 250, 2); g.fillRect(6, 6, 2, 250);
  return tex(c, 1, 1);
}

export function corkboard() {
  const [c, g] = canvas(512, 336);
  g.fillStyle = '#b98b55'; g.fillRect(0, 0, 512, 336);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = rnd() > 0.5 ? `rgba(120,80,40,${0.35 * rnd()})` : `rgba(230,190,140,${0.3 * rnd()})`;
    g.fillRect(rnd() * 512, rnd() * 336, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  const pin = (x, y, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x - 1.5, y - 1.5, 1.6, 0, Math.PI * 2); g.fill(); };
  const memo = (x, y, w, h, rot, lines = true) => {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
    g.fillStyle = '#f3f1ea'; g.fillRect(-w / 2, -h / 2, w, h);
    if (lines) { g.fillStyle = 'rgba(60,60,60,0.45)'; g.fillRect(-w / 2 + 10, -h / 2 + 10, w * 0.5, 4); for (let yy = -h / 2 + 24; yy < h / 2 - 8; yy += 7) g.fillRect(-w / 2 + 10, yy, (w - 20) * (0.6 + 0.4 * rnd()), 2); }
    g.restore(); pin(x + Math.sin(rot) * h * 0.45, y - h / 2 + 8, '#c0392b');
  };
  const sticky = (x, y, rot, col = '#efd85a') => {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(-27, -25, 56, 56);
    g.fillStyle = col; g.fillRect(-29, -29, 56, 56);
    g.strokeStyle = 'rgba(40,40,60,0.7)'; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-20, -14 + k * 11); for (let xx = -20; xx < 16; xx += 6) g.lineTo(xx, -14 + k * 11 + (rnd() - 0.5) * 4); g.stroke(); }
    g.restore();
  };
  memo(110, 110, 130, 165, -0.06);
  memo(270, 95, 120, 150, 0.05);
  memo(405, 150, 110, 140, -0.03);
  sticky(190, 245, 0.08);
  sticky(330, 255, -0.1, '#f2c14e');
  sticky(450, 60, 0.12, '#e9e07a');
  // an old photo of a beach, curling at the corner
  g.save(); g.translate(70, 265); g.rotate(-0.1);
  g.fillStyle = '#fafafa'; g.fillRect(-42, -34, 84, 68);
  const sky = g.createLinearGradient(0, -28, 0, 28); sky.addColorStop(0, '#8cc2e6'); sky.addColorStop(0.55, '#d9eef7'); sky.addColorStop(0.56, '#3f86b8'); sky.addColorStop(1, '#e5d3a0');
  g.fillStyle = sky; g.fillRect(-36, -28, 72, 50);
  g.restore(); pin(70, 236, '#2a6db0');
  // frame
  g.strokeStyle = '#6e5232'; g.lineWidth = 14; g.strokeRect(7, 7, 498, 322);
  return tex(c);
}

export function poster() {
  const [c, g] = canvas(256, 360);
  g.fillStyle = '#121212'; g.fillRect(0, 0, 256, 360);
  const sky = g.createLinearGradient(0, 18, 0, 250);
  sky.addColorStop(0, '#24365e'); sky.addColorStop(0.55, '#d86f4b'); sky.addColorStop(1, '#f2c27a');
  g.fillStyle = sky; g.fillRect(18, 18, 220, 232);
  g.fillStyle = '#f6dd9d'; g.beginPath(); g.arc(128, 214, 26, Math.PI, 0); g.fill();
  g.fillStyle = '#1f2a3a'; g.fillRect(18, 214, 220, 36);
  // a single small figure on a dock, facing the sun
  g.fillStyle = '#0f1218'; g.fillRect(96, 208, 70, 4); g.fillRect(126, 192, 6, 16); g.beginPath(); g.arc(129, 188, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e9e4d8'; g.textAlign = 'center';
  g.font = 'bold 21px Georgia, serif'; g.fillText('PATIENCE', 128, 284);
  g.font = 'italic 11.5px Georgia, serif';
  g.fillText('You are exactly where', 128, 310); g.fillText('you need to be.', 128, 326);
  return tex(c);
}

export function stickyNote(seedShift = 0) {
  const [c, g] = canvas(64, 64);
  const cols = ['#efd85a', '#f2c14e', '#e9e07a'];
  g.fillStyle = cols[seedShift % 3]; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, 64, 9);
  g.strokeStyle = 'rgba(35,35,70,0.75)'; g.lineWidth = 2.2;
  for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(9, 20 + k * 12); for (let x = 9; x < 52; x += 6) g.lineTo(x, 20 + k * 12 + (rnd() - 0.5) * 5); g.stroke(); }
  return tex(c);
}

export function phoneKeypad() {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#2b2c2e'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#9fb3a0'; g.fillRect(14, 10, 100, 22); // little LCD
  for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) {
    g.fillStyle = '#d9d6cc'; g.fillRect(22 + k * 30, 42 + r * 21, 22, 15);
  }
  g.fillStyle = '#c0392b'; g.fillRect(110, 42, 10, 10); // message light
  return tex(c);
}

export function binderSpine(color, label = true) {
  const [c, g] = canvas(64, 256);
  g.fillStyle = color; g.fillRect(0, 0, 64, 256);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(4, 0, 6, 256);
  if (label) {
    g.fillStyle = '#f1efe8'; g.fillRect(10, 30, 44, 110);
    g.fillStyle = 'rgba(40,40,40,0.55)'; for (let y = 44; y < 130; y += 12) g.fillRect(16, y, 32 * (0.5 + 0.5 * rnd()), 3);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.beginPath(); g.arc(32, 200, 11, 0, Math.PI * 2); g.stroke();
  }
  return tex(c);
}
