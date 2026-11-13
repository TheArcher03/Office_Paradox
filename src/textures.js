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
  drawCalendarPage(g);
  const t = tex(c);
  for (let d = 1; d <= CALENDAR.crossedAtStart; d++) crossDay(t, d);   // someone was keeping up, then stopped
  return t;
}
// Overnight, someone puts the calendar back the way it was.
export function resetCalendar(t) {
  drawCalendarPage(t.image.getContext('2d'));
  for (let d = 1; d <= CALENDAR.crossedAtStart; d++) crossDay(t, d);
  t.needsUpdate = true;
}
function drawCalendarPage(g) {
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
}
// The calendar's month: whoever sat here crossed off the first days, then stopped.
export const CALENDAR = { days: 31, crossedAtStart: 11 };
// Cross one day off the calendar (a hand-drawn X in red pencil).
export function crossDay(t, day) {
  const g = t.image.getContext('2d');
  const i = day + 2, r = Math.floor(i / 7), k = i % 7;
  const x = 12 + k * 33.1, y = 214 + r * 27;
  const j = () => (Math.sin(day * 12.9898 + j.n++ * 78.233) * 43758.5453 % 1) * 3;
  j.n = 0;
  g.strokeStyle = 'rgba(178, 40, 34, 0.85)'; g.lineWidth = 2.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x + 6 + j(), y + 5 + j()); g.lineTo(x + 27 + j(), y + 22 + j()); g.stroke();
  g.beginPath(); g.moveTo(x + 27 + j(), y + 5 + j()); g.lineTo(x + 6 + j(), y + 22 + j()); g.stroke();
  t.needsUpdate = true;
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

// ---- The cat picture (Stage 3). Our own drawing: an orange cat sitting very politely.
// Draws into any canvas at (x, y, w, h), so the same cat shows on the computer and on the printed page.
export function drawCat(g, x, y, w, h) {
  g.save();
  g.translate(x, y); g.scale(w / 100, h / 100);
  g.lineJoin = 'round'; g.lineCap = 'round';
  // wall and floor
  g.fillStyle = '#bfe0dc'; g.fillRect(0, 0, 100, 100);
  g.fillStyle = '#e9d9b8'; g.fillRect(0, 76, 100, 24);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(50, 86, 30, 5, 0, 0, Math.PI * 2); g.fill();
  const fur = '#e58a35', dark = '#b8601c', cream = '#fbe9cf', ink = '#3a2416';
  g.strokeStyle = ink; g.lineWidth = 1.6;
  // tail, curling around to the right
  g.strokeStyle = ink; g.lineWidth = 8.2; g.beginPath(); g.moveTo(66, 82); g.quadraticCurveTo(90, 84, 84, 62); g.stroke();
  g.strokeStyle = fur; g.lineWidth = 5.6; g.beginPath(); g.moveTo(66, 82); g.quadraticCurveTo(90, 84, 84, 62); g.stroke();
  g.strokeStyle = cream; g.lineWidth = 5.6; g.beginPath(); g.moveTo(84.6, 65); g.lineTo(84, 62); g.stroke();
  g.strokeStyle = ink; g.lineWidth = 1.6;
  // body
  g.fillStyle = fur; g.beginPath(); g.moveTo(50, 44); g.bezierCurveTo(26, 46, 22, 86, 34, 86); g.lineTo(66, 86); g.bezierCurveTo(78, 86, 74, 46, 50, 44); g.fill(); g.stroke();
  g.fillStyle = cream; g.beginPath(); g.ellipse(50, 70, 10, 14, 0, 0, Math.PI * 2); g.fill();
  // front paws
  g.fillStyle = cream;
  for (const px of [42, 58]) { g.beginPath(); g.ellipse(px, 85, 6, 4, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
  // ears
  g.fillStyle = fur;
  g.beginPath(); g.moveTo(31, 30); g.lineTo(30, 10); g.lineTo(45, 20); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(69, 30); g.lineTo(70, 10); g.lineTo(55, 20); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#f2b8a8';
  g.beginPath(); g.moveTo(34, 25); g.lineTo(33.5, 16); g.lineTo(40, 21); g.fill();
  g.beginPath(); g.moveTo(66, 25); g.lineTo(66.5, 16); g.lineTo(60, 21); g.fill();
  // head
  g.fillStyle = fur; g.beginPath(); g.ellipse(50, 36, 22, 18, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = cream; g.beginPath(); g.ellipse(50, 43, 11, 8, 0, 0, Math.PI * 2); g.fill();
  // stripes
  g.strokeStyle = dark; g.lineWidth = 2;
  for (const sx of [44, 50, 56]) { g.beginPath(); g.moveTo(sx, 19.5); g.lineTo(sx, 25); g.stroke(); }
  g.beginPath(); g.moveTo(29, 36); g.lineTo(34, 37); g.moveTo(71, 36); g.lineTo(66, 37); g.stroke();
  g.beginPath(); g.moveTo(28, 62); g.lineTo(34, 63); g.moveTo(27.5, 70); g.lineTo(33, 70.5); g.moveTo(72, 62); g.lineTo(66, 63); g.moveTo(72.5, 70); g.lineTo(67, 70.5); g.stroke();
  // eyes: big, green, a little too interested in you
  for (const ex of [40.5, 59.5]) {
    g.fillStyle = '#9fd36a'; g.beginPath(); g.ellipse(ex, 34, 5, 5.6, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = ink; g.lineWidth = 1.3; g.stroke();
    g.fillStyle = ink; g.beginPath(); g.ellipse(ex, 34.3, 2.1, 4.4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 1.6, 32, 1.2, 0, Math.PI * 2); g.fill();
  }
  // nose, mouth, whiskers
  g.fillStyle = '#e07a7a'; g.beginPath(); g.moveTo(47.6, 40.5); g.lineTo(52.4, 40.5); g.lineTo(50, 43.2); g.closePath(); g.fill();
  g.strokeStyle = ink; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(50, 43.2); g.lineTo(50, 45); g.moveTo(50, 45); g.quadraticCurveTo(47, 48, 44.5, 45.6); g.moveTo(50, 45); g.quadraticCurveTo(53, 48, 55.5, 45.6); g.stroke();
  g.lineWidth = 0.8;
  for (const [sx, d] of [[41, -1], [59, 1]]) for (const dy of [-2, 1, 4]) { g.beginPath(); g.moveTo(sx, 44); g.lineTo(sx + d * 15, 43 + dy); g.stroke(); }
  g.restore();
}
// the printed page: the cat, with a white margin like a real printout
export function catPrint() {
  const [c, g] = canvas(256, 334);
  g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, 256, 334);
  drawCat(g, 28, 44, 200, 200);
  g.strokeStyle = '#444'; g.lineWidth = 1; g.strokeRect(28, 44, 200, 200);
  g.fillStyle = '#666'; g.font = '11px "Courier New", monospace'; g.textAlign = 'left';
  g.fillText('cat.bmp', 28, 268); g.textAlign = 'right'; g.fillText('page 1 of 1', 228, 268);
  return tex(c);
}

// ====================================================================================================
// The detail pass: surface relief (normal maps) and the small printed things that make a desk look used.
// ====================================================================================================

// Build a normal map from a grayscale "height" drawing. White is high, black is low. Tiles seamlessly.
export function normalMap(size, draw, strength = 2, repX = 1, repY = 1) {
  const [c, g] = canvas(size, size);
  g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
  draw(g, size);
  const src = g.getImageData(0, 0, size, size).data;
  const out = g.createImageData(size, size);
  const h = (x, y) => src[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * strength, dy = (h(x, y + 1) - h(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return tex(c, repX, repY, false);
}
const speckle = (g, s, n, lo, hi, a = 1) => { for (let i = 0; i < n; i++) { const v = Math.floor(lo + rnd() * (hi - lo)); g.fillStyle = `rgba(${v},${v},${v},${a})`; const r = 1 + rnd() * 2; g.fillRect(rnd() * s, rnd() * s, r, r); } };

// woven panel fabric: over-under threads
export function fabricNormal() {
  return normalMap(256, (g, s) => {
    for (let y = 0; y < s; y += 4) for (let x = 0; x < s; x += 4) {
      const over = ((x + y) / 4) % 2 === 0, v = over ? 190 + rnd() * 50 : 70 + rnd() * 40;
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, over ? 4 : 3, over ? 3 : 4);
    }
    speckle(g, s, 1800, 40, 220, 0.35);
  }, 2.4, 9, 9);
}
// loop-pile carpet tiles
export function carpetNormal() {
  return normalMap(256, (g, s) => {
    for (let i = 0; i < 16000; i++) { const v = Math.floor(60 + rnd() * 160); g.fillStyle = `rgba(${v},${v},${v},0.8)`; g.beginPath(); g.arc(rnd() * s, rnd() * s, 0.8 + rnd() * 1.6, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(0, 0, s, 2); g.fillRect(0, 0, 2, s);     // the seam between carpet tiles
  }, 3, 1, 1);
}
// acoustic ceiling tile: pin-holes and fissures, and the tile sits a little above the T-bar
export function ceilingNormal() {
  return normalMap(256, (g, s) => {
    g.fillStyle = '#b0b0b0'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${0.5 + rnd() * 0.5})`; g.beginPath(); g.arc(rnd() * s, rnd() * s, 0.6 + rnd() * 1.5, 0, 7); g.fill(); }
    for (let i = 0; i < 90; i++) { g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 1; const x = rnd() * s, y = rnd() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 8); g.stroke(); }
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, 7); g.fillRect(0, 0, 7, s);
    g.fillStyle = '#404040'; g.fillRect(7, 7, s, 2); g.fillRect(7, 7, 2, s);
  }, 2.2, 1, 1);
}
// the fine pebble grain on molded plastic
export function plasticNormal(rep = 6) {
  return normalMap(128, (g, s) => speckle(g, s, 5200, 70, 190, 0.9), 0.55, rep, rep);
}
// brushed metal: long fine scratches
export function brushedNormal(rep = 2) {
  return normalMap(128, (g, s) => { for (let i = 0; i < 500; i++) { const v = Math.floor(80 + rnd() * 100); g.fillStyle = `rgba(${v},${v},${v},0.7)`; g.fillRect(rnd() * s, rnd() * s, 20 + rnd() * 60, 1); } }, 0.8, rep, rep);
}
// a roughness map with smudges, so shiny things aren't evenly shiny
export function smudges(base = 150, rep = 1) {
  const [c, g] = canvas(256, 256);
  g.fillStyle = `rgb(${base},${base},${base})`; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 10 + rnd() * 40, v = Math.floor(base + (rnd() - 0.4) * 110);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${v},${v},${v},0.5)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return tex(c, rep, rep, false);
}

// nicer base colors for the big surfaces
export function fabricPanel() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#7d8580'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14000; i++) { const v = rnd(); g.fillStyle = v > 0.5 ? `rgba(165,172,165,${0.12 * rnd()})` : `rgba(40,46,48,${0.16 * rnd()})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1); }
  return tex(c, 3, 3);
}
export function carpetTile() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#414c5c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 22000; i++) { const v = rnd(); g.fillStyle = v > 0.55 ? `rgba(118,132,152,${0.3 * rnd()})` : `rgba(14,18,26,${0.42 * rnd()})`; g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2); }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 256, 1.5); g.fillRect(0, 0, 1.5, 256);
  return tex(c, 1, 1);
}
export function deskLaminate() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#a39b8a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26000; i++) { const v = rnd(); g.fillStyle = v > 0.5 ? `rgba(240,236,224,${0.25 * rnd()})` : `rgba(96,88,74,${0.2 * rnd()})`; g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd(), 1 + rnd()); }
  // years of use: faint scuffs and a pale patch where the keyboard always sits
  for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(90,82,70,${0.05 + 0.07 * rnd()})`; g.lineWidth = 0.6 + rnd(); const x = rnd() * 512, y = rnd() * 512; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 90, y + (rnd() - 0.5) * 30); g.stroke(); }
  return tex(c, 1, 1);
}
// the lens of a fluorescent ceiling light: prismatic squares, brighter where the tubes are
export function lightLens() {
  const [c, g] = canvas(128, 256);
  const gr = g.createLinearGradient(0, 0, 128, 0);
  [[0, '#b9c0c6'], [0.22, '#ffffff'], [0.5, '#d6dce2'], [0.78, '#ffffff'], [1, '#b9c0c6']].forEach(([s, col]) => gr.addColorStop(s, col));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = 'rgba(70,80,90,0.16)'; g.lineWidth = 1;
  for (let i = 0; i <= 128; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); }
  for (let i = 0; i <= 256; i += 8) { g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  const e = g.createLinearGradient(0, 0, 0, 256); e.addColorStop(0, 'rgba(60,70,80,0.3)'); e.addColorStop(0.08, 'rgba(0,0,0,0)'); e.addColorStop(0.92, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(60,70,80,0.3)');
  g.fillStyle = e; g.fillRect(0, 0, 128, 256);
  return tex(c);
}
// a small printed label. lines: [text, sizePx, weight]. Used for brand badges, tags and plates.
export function label(lines, { w = 256, h = 96, bg = '#f4f2ea', ink = '#1c1c1c', font = 'Arial, Helvetica, sans-serif', border = false, align = 'center' } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = ink; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10); }
  g.fillStyle = ink; g.textAlign = align; g.textBaseline = 'middle';
  const total = lines.reduce((s, l) => s + l[1] * 1.25, 0); let y = (h - total) / 2;
  for (const [text, size, weight = 'bold'] of lines) { g.font = `${weight} ${size}px ${font}`; g.fillText(text, align === 'center' ? w / 2 : 14, y + size * 0.62); y += size * 1.25; }
  return tex(c);
}
// inventory sticker: every single thing in this cubicle has one
export function assetTag(n) {
  const [c, g] = canvas(256, 112);
  g.fillStyle = '#f6f5f0'; g.fillRect(0, 0, 256, 112);
  g.fillStyle = '#16181c'; g.font = 'bold 15px Arial, Helvetica, sans-serif'; g.textAlign = 'left';
  g.fillText('PROPERTY OF FLOOR 7', 14, 24);
  let x = 14; let s = n * 7919 + 13;
  while (x < 240) { s = (s * 16807) % 2147483647; const wd = 1 + (s % 4); g.fillRect(x, 34, wd, 44); x += wd + 1 + ((s >> 3) % 3); }
  g.font = 'bold 19px "Courier New", monospace'; g.fillText('ITEM ' + String(n).padStart(4, '0'), 14, 100);
  g.font = '12px Arial, Helvetica, sans-serif'; g.textAlign = 'right'; g.fillText('DO NOT REMOVE', 242, 100);
  return tex(c);
}
// the photo in the frame: it came with the frame
export function framedPhoto() {
  const [c, g] = canvas(256, 192);
  const sky = g.createLinearGradient(0, 0, 0, 192); sky.addColorStop(0, '#7fb6e6'); sky.addColorStop(0.62, '#dff0fa'); sky.addColorStop(0.63, '#6fae5a'); sky.addColorStop(1, '#3f7f3a');
  g.fillStyle = sky; g.fillRect(0, 0, 256, 192);
  g.fillStyle = '#fff6c8'; g.beginPath(); g.arc(206, 40, 18, 0, 7); g.fill();
  g.fillStyle = '#e9e2d2'; g.fillRect(24, 70, 86, 52); g.fillStyle = '#a9483a'; g.beginPath(); g.moveTo(16, 72); g.lineTo(67, 38); g.lineTo(118, 72); g.fill();
  g.fillStyle = '#5a4634'; g.fillRect(58, 94, 18, 28);
  // four people, arms around each other, and not one of them has a face
  [[128, 30, '#c0563f'], [156, 34, '#3f6fb0'], [182, 22, '#d9a830'], [202, 18, '#7a4f9a']].forEach(([x, hh, col]) => {
    g.fillStyle = col; g.fillRect(x - 9, 150 - hh - 20, 18, hh + 26);
    g.fillStyle = '#e8c7a6'; g.beginPath(); g.arc(x, 150 - hh - 29, 9, 0, 7); g.fill();
  });
  g.save(); g.translate(128, 96); g.rotate(-0.42); g.fillStyle = 'rgba(255,255,255,0.42)'; g.font = 'bold 44px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.fillText('SAMPLE', 0, 14); g.restore();
  return tex(c);
}
export function calculatorFace() {
  const [c, g] = canvas(128, 192);
  g.fillStyle = '#3a3c40'; g.fillRect(0, 0, 128, 192);
  g.fillStyle = '#a9b7a3'; g.fillRect(12, 12, 104, 34);
  g.fillStyle = '#20241f'; g.font = 'bold 26px "Courier New", monospace'; g.textAlign = 'right'; g.fillText('0.', 108, 39);
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
  keys.forEach((k, i) => {
    const x = 12 + (i % 4) * 27, y = 60 + Math.floor(i / 4) * 31;
    g.fillStyle = i % 4 === 3 ? '#b0553f' : '#d7d3c8'; g.fillRect(x, y, 22, 24);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + 21, 22, 3);
    g.fillStyle = i % 4 === 3 ? '#fff' : '#222'; g.font = 'bold 15px Arial, sans-serif'; g.textAlign = 'center'; g.fillText(k, x + 11, y + 17);
  });
  return tex(c);
}
export function wallOutlet() {
  const [c, g] = canvas(64, 96);
  g.fillStyle = '#e6e3da'; g.fillRect(0, 0, 64, 96);
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; g.strokeRect(2, 2, 60, 92);
  for (const y of [28, 68]) { g.fillStyle = '#d2cec3'; g.beginPath(); g.ellipse(32, y, 17, 15, 0, 0, 7); g.fill(); g.fillStyle = '#1a1a1a'; g.fillRect(24, y - 8, 3, 10); g.fillRect(37, y - 8, 3, 10); g.beginPath(); g.arc(32, y + 8, 2.6, 0, 7); g.fill(); }
  g.fillStyle = '#9a968c'; g.beginPath(); g.arc(32, 48, 2.5, 0, 7); g.fill();
  return tex(c);
}
export function cardboard(text = '') {
  const [c, g] = canvas(256, 192);
  g.fillStyle = '#b08d5e'; g.fillRect(0, 0, 256, 192);
  for (let y = 0; y < 192; y += 3) { g.fillStyle = `rgba(70,48,22,${0.05 + 0.06 * rnd()})`; g.fillRect(0, y, 256, 1); }
  speckle(g, 256, 2200, 60, 200, 0.08);
  g.fillStyle = 'rgba(40,26,10,0.85)'; g.fillRect(96, 44, 64, 20);                      // hand hole
  if (text) { g.fillStyle = '#efe9da'; g.fillRect(70, 96, 116, 58); g.fillStyle = '#23201a'; g.font = 'bold 20px "Courier New", monospace'; g.textAlign = 'center'; g.fillText(text, 128, 122); g.font = '13px "Courier New", monospace'; g.fillText('RETAIN INDEFINITELY', 128, 144); }
  return tex(c);
}
// a dried coffee ring (alpha): put it on the desk
export function coffeeRing() {
  const [c, g] = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(74,48,24,${0.16 + 0.1 * rnd()})`; g.lineWidth = 2 + rnd() * 3; g.beginPath(); g.arc(64 + (rnd() - 0.5) * 3, 64 + (rnd() - 0.5) * 3, 44 + rnd() * 3, rnd() * 2, 4.6 + rnd() * 2.6); g.stroke(); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
// soft dark blob (alpha) for grounding things that don't get a real shadow
export function softShadow() {
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
// front of the computer tower: drive bays, vents, buttons
export function towerFront() {
  const [c, g] = canvas(192, 400);
  g.fillStyle = '#d3cbb5'; g.fillRect(0, 0, 192, 400);
  const bay = (y, h) => { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(18, y, 156, h); g.fillStyle = '#d8d0ba'; g.fillRect(20, y + 2, 152, h - 4); };
  bay(22, 44); g.fillStyle = '#b9b19b'; g.fillRect(30, 46, 132, 8); g.fillStyle = '#8f8873'; g.fillRect(140, 58, 18, 5);       // CD drive
  bay(72, 44);
  bay(124, 34); g.fillStyle = '#2a2a28'; g.fillRect(44, 138, 104, 5); g.fillStyle = '#8f8873'; g.fillRect(132, 148, 16, 5);   // floppy
  for (let y = 250; y < 372; y += 9) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(26, y, 140, 3); }
  g.fillStyle = '#bdb59f'; g.beginPath(); g.arc(46, 206, 12, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(46, 206, 12, 0, 7); g.lineWidth = 2; g.stroke();
  g.fillStyle = '#bdb59f'; g.fillRect(76, 200, 14, 12);
  g.fillStyle = '#39c05a'; g.fillRect(112, 203, 9, 5); g.fillStyle = '#c98a2a'; g.fillRect(128, 203, 9, 5);
  g.fillStyle = '#6d6754'; g.font = 'bold 13px Arial, sans-serif'; g.textAlign = 'left'; g.fillText('TWOFOLD  486', 22, 232);
  return tex(c);
}
export function tissueBox() {
  const [c, g] = canvas(128, 64);
  g.fillStyle = '#9fb9c9'; g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(255,255,255,${0.25 + rnd() * 0.3})`; g.lineWidth = 2; g.beginPath(); g.arc(rnd() * 128, rnd() * 64, 6 + rnd() * 10, 0, 7); g.stroke(); }
  return tex(c);
}
