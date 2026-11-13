// The old boxy computer: a tiny made-up retro desktop drawn onto the monitor, a browser with no connection,
// a picture of a cat you can print, and the little UFO game hiding behind the error page.
// Everything here is drawn in code onto one canvas, which the monitor in the room shows.
import * as THREE from 'three';
import { drawCat } from './textures.js';
import { clockLabel } from './brain.js';

const W = 640, H = 480;
const C = {
  desk: '#2c7a80', bar: '#c9c5b6', barDark: '#8d897c', barLight: '#f4f1e6', title: '#1d2c6e', text: '#16161a',
  white: '#fbfaf4', page: '#ffffff',
};
const GAME = { x: 96, y: 148, w: 448, h: 240 };   // the game box: about half the screen, in the middle of the page

export function createComputer({ brain, sfx = () => {}, onPrint = () => {}, onScore = () => {} }) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const st = {
    power: brain.state.pcOn ? 'on' : 'off',   // off | boot | on | shutdown
    t: 0,                                     // time in the current power state
    win: null,                                // null | work | pictures | viewer | browser
    menu: false,
    printing: 0,                              // seconds left on the "sending to printer" message
    cur: { x: 330, y: 250 },
    minute: -1,
  };
  let dirty = true, hits = [];

  // ------------------------------------------------------------------ drawing helpers
  const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const text = (s, x, y, c = C.text, font = 'bold 13px "Courier New", monospace', align = 'left') => {
    g.fillStyle = c; g.font = font; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y);
  };
  function bevel(x, y, w, h, down = false) {
    rect(x, y, w, h, C.bar);
    rect(x, y, w, 2, down ? C.barDark : C.barLight); rect(x, y, 2, h, down ? C.barDark : C.barLight);
    rect(x, y + h - 2, w, 2, down ? C.barLight : C.barDark); rect(x + w - 2, y, 2, h, down ? C.barLight : C.barDark);
  }
  const hit = (x, y, w, h, fn) => hits.push({ x, y, w, h, fn });
  function button(label, x, y, w, h, fn) {
    bevel(x, y, w, h);
    text(label, x + w / 2, y + h / 2 + 4.5, C.text, 'bold 13px "Courier New", monospace', 'center');
    hit(x, y, w, h, fn);
  }
  function windowFrame(title, x, y, w, h) {
    hit(x, y, w, h, () => {});                           // clicks on the window don't fall through to the desktop
    rect(x + 4, y + 4, w, h, 'rgba(0,0,0,0.35)');
    bevel(x, y, w, h);
    rect(x + 3, y + 3, w - 6, 20, C.title);
    text(title, x + 9, y + 17, '#fff');
    bevel(x + w - 22, y + 5, 16, 16);
    text('x', x + w - 14, y + 17, C.text, 'bold 13px "Courier New", monospace', 'center');
    hit(x + w - 24, y + 3, 20, 20, () => { st.win = st.win === 'viewer' ? 'pictures' : null; if (st.win === null) stopGame(); sfx('click'); });
    return { x: x + 4, y: y + 24, w: w - 8, h: h - 28 };
  }
  function icon(kind, label, x, y, fn) {
    // little hand-drawn icons, 44 px wide
    if (kind === 'work') {
      rect(x + 8, y, 28, 34, C.white); g.strokeStyle = '#333'; g.lineWidth = 1.5; g.strokeRect(x + 8, y, 28, 34);
      for (let i = 0; i < 4; i++) rect(x + 12, y + 6 + i * 6, 20, 2, '#3a8a4a');
      g.beginPath(); g.moveTo(x + 22, y); g.lineTo(x + 22, y + 34); g.stroke();
    } else if (kind === 'pictures') {
      rect(x + 4, y + 6, 36, 28, '#d9b24a'); rect(x + 4, y + 2, 16, 6, '#d9b24a');
      g.strokeStyle = '#6b5416'; g.lineWidth = 1.5; g.strokeRect(x + 4, y + 6, 36, 28);
    } else if (kind === 'net') {
      g.fillStyle = '#5aa6d8'; g.beginPath(); g.arc(x + 22, y + 18, 16, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#123'; g.lineWidth = 1.5; g.stroke();
      g.beginPath(); g.ellipse(x + 22, y + 18, 7, 16, 0, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(x + 6, y + 18); g.lineTo(x + 38, y + 18); g.stroke();
    } else if (kind === 'cat') {
      rect(x + 4, y, 36, 36, C.white); g.strokeStyle = '#333'; g.lineWidth = 1.5; g.strokeRect(x + 4, y, 36, 36);
      drawCat(g, x + 6, y + 2, 32, 32);
    }
    text(label, x + 22, y + 50, kind === 'cat' ? C.text : '#fff', 'bold 12px "Courier New", monospace', 'center');
    hit(x - 8, y - 4, 60, 60, fn);
  }
  const open = (w) => () => { st.win = w; st.menu = false; sfx('click'); };

  // ------------------------------------------------------------------ screens
  function drawOff() {
    const grd = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 380);
    grd.addColorStop(0, '#222826'); grd.addColorStop(1, '#0a0c0b');
    g.fillStyle = grd; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    g.beginPath(); g.moveTo(50, 25); g.lineTo(275, 25); g.lineTo(150, 225); g.lineTo(30, 225); g.fill();
  }
  function drawBoot() {
    rect(0, 0, W, H, '#050606');
    const t = st.t, f = 'bold 15px "Courier New", monospace', green = '#9fe6a4';
    if (t < 0.35) return;
    if (t < 2.3) {
      text('TF-BIOS  v2.11', 24, 40, green, f);
      text('(C) a long time ago', 24, 60, green, f);
      if (t > 0.7) text(`Memory test:  ${Math.min(640, Math.floor((t - 0.7) * 900))} KB${t > 1.45 ? '  OK' : ''}`, 24, 100, green, f);
      if (t > 1.5) text('Drive C:  OK', 24, 120, green, f);
      if (t > 1.75) text('Printer:  READY', 24, 140, green, f);
      if (t > 2.0) text('Network adapter:  NO LINK', 24, 160, green, f);
      if (Math.floor(t * 3) % 2) rect(24, 176, 10, 16, green);
    } else {
      rect(0, 0, W, H, C.desk);
      text('desk', W / 2 - 6, 220, '#fff', 'bold 54px Georgia, serif', 'right');
      text('OS', W / 2 - 2, 220, '#f2d16b', 'bold 54px Georgia, serif', 'left');
      text('starting your workday', W / 2, 252, '#d6ecee', 'bold 13px "Courier New", monospace', 'center');
      rect(W / 2 - 100, 280, 200, 12, '#1b4f54');
      rect(W / 2 - 98, 282, 196 * Math.min(1, (t - 2.3) / 1.1), 8, '#f2d16b');
    }
  }
  function drawShutdown() {
    rect(0, 0, W, H, '#050606');
    text('It is now safe to stare at the wall.', W / 2, H / 2, '#e8a23a', 'bold 17px "Courier New", monospace', 'center');
  }
  function drawDesktop() {
    rect(0, 0, W, H, C.desk);
    g.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 6; i++) g.fillRect(0, 60 + i * 70, W, 22);
    hit(0, 0, W, H, () => { if (st.menu) { st.menu = false; } });
    icon('work', 'My Work', 26, 22, open('work'));
    icon('pictures', 'Pictures', 26, 102, open('pictures'));
    icon('net', 'Internet', 26, 182, open('browser'));

    if (st.win === 'work') drawWork();
    if (st.win === 'pictures') drawPictures();
    if (st.win === 'viewer') drawViewer();
    if (st.win === 'browser') drawBrowser();

    // taskbar
    bevel(0, H - 30, W, 30);
    hit(0, H - 30, W, 30, () => {});
    bevel(4, H - 26, 70, 22, st.menu);
    text('MENU', 39, H - 10, C.text, 'bold 13px "Courier New", monospace', 'center');
    hit(4, H - 26, 70, 22, () => { st.menu = !st.menu; sfx('click'); });
    bevel(W - 78, H - 26, 74, 22, true);
    text(clockLabel(brain.state.clockSec), W - 41, H - 10, C.text, 'bold 13px "Courier New", monospace', 'center');
    // no-network icon by the clock
    g.strokeStyle = '#a22'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(W - 100, H - 22); g.lineTo(W - 88, H - 8); g.moveTo(W - 88, H - 22); g.lineTo(W - 100, H - 8); g.stroke();
    if (st.menu) {
      bevel(4, H - 30 - 34, 150, 34);
      hit(4, H - 64, 150, 34, () => {});
      text('Shut Down...', 16, H - 42);
      hit(6, H - 62, 146, 30, () => { st.menu = false; st.win = null; stopGame(); setPower('shutdown'); sfx('click'); });
    }
  }
  function drawWork() {
    const b = windowFrame('Q3_FINAL_v7_REAL_final.xls', 96, 44, 452, 340);
    rect(b.x, b.y, b.w, b.h, C.white);
    g.strokeStyle = '#b9b9b0'; g.lineWidth = 1;
    for (let r = 0; r <= 15; r++) { g.beginPath(); g.moveTo(b.x, b.y + r * 20 + 0.5); g.lineTo(b.x + b.w, b.y + r * 20 + 0.5); g.stroke(); }
    for (let c = 0; c <= 6; c++) { g.beginPath(); g.moveTo(b.x + 28 + c * 70 + 0.5, b.y); g.lineTo(b.x + 28 + c * 70 + 0.5, b.y + b.h); g.stroke(); }
    rect(b.x, b.y, b.w, 20, '#dedbd0'); rect(b.x, b.y, 28, b.h, '#dedbd0');
    'ABCDEF'.split('').forEach((l, c) => text(l, b.x + 63 + c * 70, b.y + 15, '#444', 'bold 12px "Courier New", monospace', 'center'));
    for (let r = 1; r < 15; r++) {
      text(String(r), b.x + 14, b.y + r * 20 + 15, '#444', 'bold 12px "Courier New", monospace', 'center');
      for (let c = 0; c < 6; c++) {
        const v = Math.abs(Math.sin(r * 12.9898 + c * 78.233) * 43758.5453) % 1;
        if (v < 0.2) continue;
        text((v * 9000 + 100).toFixed(c % 3 ? 0 : 2), b.x + 94 + c * 70, b.y + r * 20 + 15, r === 14 ? '#a22' : '#222', '12px "Courier New", monospace', 'right');
      }
    }
  }
  function drawPictures() {
    const b = windowFrame('Pictures', 130, 80, 380, 250);
    rect(b.x, b.y, b.w, b.h, C.white);
    icon('cat', 'cat.bmp', b.x + 28, b.y + 22, open('viewer'));
    text('1 item', b.x + 8, b.y + b.h - 8, '#777', '12px "Courier New", monospace');
  }
  function drawViewer() {
    const b = windowFrame('cat.bmp - Picture Viewer', 120, 18, 400, 420);
    rect(b.x, b.y, b.w, b.h, '#8f8c80');
    rect(b.x + 46, b.y + 12, 300, 300, C.white);
    drawCat(g, b.x + 46, b.y + 12, 300, 300);
    if (st.printing > 0) {
      bevel(b.x + 76, b.y + 330, 240, 44, true);
      text('Sending to printer...', b.x + 196, b.y + 357, C.text, 'bold 13px "Courier New", monospace', 'center');
    } else {
      button('Print', b.x + 96, b.y + 334, 90, 30, () => { st.printing = 1.3; sfx('click'); });
      button('Close', b.x + 206, b.y + 334, 90, 30, open('pictures'));
    }
  }

  // ------------------------------------------------------------------ the browser (no connection) + the UFO game
  function drawBrowser() {
    const b = windowFrame('NetWindow', 16, 10, 608, 432);
    rect(b.x, b.y, b.w, 30, C.bar);
    text('Address', b.x + 8, b.y + 20);
    bevel(b.x + 72, b.y + 5, b.w - 150, 20, true); rect(b.x + 74, b.y + 7, b.w - 154, 16, C.white);
    text('http://intranet/home', b.x + 80, b.y + 20, '#222', '13px "Courier New", monospace');
    button('Go', b.x + b.w - 70, b.y + 4, 62, 22, () => sfx('error'));
    const py = b.y + 30;
    rect(b.x, py, b.w, b.h - 30, C.page);
    // the "no connection" page stays visible all around the game
    g.strokeStyle = '#888'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(b.x + 30, py + 38); g.lineTo(b.x + 52, py + 38); g.moveTo(b.x + 64, py + 38); g.lineTo(b.x + 86, py + 38); g.stroke();
    rect(b.x + 48, py + 30, 8, 16, '#888'); rect(b.x + 60, py + 30, 8, 16, '#888');
    text('No connection', b.x + 100, py + 36, '#222', 'bold 24px Georgia, serif');
    text('The network cannot be reached. Check the cable, then wait.', b.x + 100, py + 58, '#555', '12px "Courier New", monospace');
    text('Error 0x00: NO_CARRIER', b.x + 30, GAME.y + GAME.h + 24, '#888', '12px "Courier New", monospace');
    text('Retrying in: never', b.x + b.w - 30, GAME.y + GAME.h + 24, '#888', '12px "Courier New", monospace', 'right');
    drawGame();
  }

  // --- the UFO game. Plays like the classic jump-over-things runner, but it's ours: a small alien in a saucer,
  // hopping asteroids and ducking shooting stars, on its way past one planet after another.
  const PLANETS = [
    { sky: '#10142e', ground: '#7d86a8', groundDark: '#4d5578', rock: '#b9c0d8', glow: '#8fd0ff', name: 'moon' },
    { sky: '#2a1020', ground: '#c0613c', groundDark: '#7c3520', rock: '#e2a070', glow: '#ffd27a', name: 'desert' },
    { sky: '#04261f', ground: '#3f9a78', groundDark: '#1f5c46', rock: '#a8e6c8', glow: '#d0ff9a', name: 'jungle' },
  ];
  const game = {
    state: 'idle',            // idle | play | over
    t: 0, score: 0, best: brain.state.ufoBest || 0, speed: 190, scroll: 0,
    y: 0, vy: 0, duck: false, obstacles: [], nextIn: 1.2, planet: 0, warp: 0, overT: 0, noted: false,
  };
  const GROUND = GAME.y + GAME.h - 34;
  function stopGame() { if (game.state === 'play') game.state = 'idle'; }
  function startGame() {
    Object.assign(game, { state: 'play', t: 0, score: 0, speed: 190, y: 0, vy: 0, duck: false, obstacles: [], nextIn: 1.1, planet: 0, warp: 0 });
    sfx('start');
  }
  function jump() {
    if (game.state === 'play') { if (game.y === 0 && !game.duck) { game.vy = 335; sfx('jump'); } }
    else if (game.state === 'idle' || (game.state === 'over' && game.overT > 0.5)) startGame();
  }
  function ufoBox() {
    // hit box, a little forgiving
    const cx = GAME.x + 78;
    return game.duck && game.y === 0
      ? { x: cx - 20, y: GROUND - 15, w: 40, h: 13 }
      : { x: cx - 17, y: GROUND - 34 - game.y, w: 34, h: 24 };
  }
  function updateGame(dt) {
    if (game.state === 'over') { game.overT += dt; return; }
    if (game.state !== 'play') return;
    game.t += dt;
    game.speed = Math.min(430, 190 + game.t * 5.5);
    game.scroll += game.speed * dt;
    const before = Math.floor(game.score / 300);
    game.score += game.speed * dt / 12;
    if (Math.floor(game.score / 300) !== before) { game.warp = 1.3; game.planet = (game.planet + 1) % PLANETS.length; game.obstacles = game.obstacles.filter((o) => o.x < GAME.x + 200); sfx('warp'); }
    if (game.warp > 0) game.warp -= dt;
    // the hop
    if (game.y > 0 || game.vy > 0) {
      game.vy -= (game.duck ? 2200 : 930) * dt;      // holding duck in the air drops you fast
      game.y = Math.max(0, game.y + game.vy * dt);
      if (game.y === 0) game.vy = 0;
    }
    // obstacles
    game.nextIn -= dt;
    if (game.nextIn <= 0 && game.warp <= 0) {
      const star = game.score > 110 && Math.random() < 0.3;
      if (star) game.obstacles.push({ kind: 'star', x: GAME.x + GAME.w + 30, y: GROUND - 36, w: 26, h: 9, vx: 80 });
      else { const h = 16 + Math.random() * 18, w = 16 + Math.random() * 20; game.obstacles.push({ kind: 'rock', x: GAME.x + GAME.w + 20, y: GROUND - h + 2, w, h, vx: 0, seed: Math.random() * 10 }); }
      game.nextIn = (0.75 + Math.random() * 0.85) * Math.max(0.62, 260 / game.speed) + 0.25;
    }
    const u = ufoBox();
    for (const o of game.obstacles) {
      o.x -= (game.speed + o.vx) * dt;
      if (o.x < u.x + u.w && o.x + o.w > u.x && o.y < u.y + u.h && o.y + o.h > u.y) {
        game.state = 'over'; game.overT = 0;
        if (game.score > game.best) { game.best = Math.floor(game.score); brain.state.ufoBest = game.best; }
        sfx('crash');
      }
    }
    game.obstacles = game.obstacles.filter((o) => o.x > GAME.x - 60);
    if (!game.noted && game.score >= 50) { game.noted = true; onScore(game.score); }
  }
  function drawGame() {
    const { x, y, w, h } = GAME, p = PLANETS[game.planet];
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    rect(x, y, w, h, p.sky);
    // stars (two layers, drifting)
    for (let i = 0; i < 46; i++) {
      const layer = i % 2 ? 0.08 : 0.03;
      const sx = x + ((i * 97.3 - game.scroll * layer) % w + w) % w, sy = y + 8 + (i * 53.7) % (h - 70);
      rect(sx, sy, i % 5 ? 1.5 : 2.5, i % 5 ? 1.5 : 2.5, i % 7 ? '#cfd6ff' : '#fff');
    }
    // something big in the sky, different on each world
    const bx = x + ((330 - game.scroll * 0.02) % (w + 160) + w + 160) % (w + 160) - 80;
    if (p.name === 'moon') {
      g.fillStyle = '#d9a25a'; g.beginPath(); g.arc(bx, y + 62, 30, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#f0d9a8'; g.lineWidth = 4; g.beginPath(); g.ellipse(bx, y + 62, 50, 10, -0.3, 0, Math.PI * 2); g.stroke();
    } else if (p.name === 'desert') {
      g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(bx, y + 50, 20, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ff9a5a'; g.beginPath(); g.arc(bx + 46, y + 74, 11, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = '#9ad0c0'; g.beginPath(); g.arc(bx, y + 56, 24, 0, Math.PI * 2); g.fill();
      g.fillStyle = p.sky; g.beginPath(); g.arc(bx + 10, y + 50, 22, 0, Math.PI * 2); g.fill();
    }
    // far hills / spires
    g.fillStyle = p.groundDark;
    for (let i = 0; i < 9; i++) {
      const hx = x + ((i * 80 - game.scroll * 0.25) % (w + 80) + w + 80) % (w + 80) - 60;
      const hh = 16 + ((i * 37) % 26);
      g.beginPath();
      if (p.name === 'desert') { g.moveTo(hx, GROUND); g.lineTo(hx + 10, GROUND - hh - 14); g.lineTo(hx + 22, GROUND); }
      else { g.moveTo(hx - 10, GROUND); g.quadraticCurveTo(hx + 30, GROUND - hh * 1.5, hx + 70, GROUND); }
      g.fill();
    }
    // ground
    rect(x, GROUND, w, y + h - GROUND, p.ground);
    rect(x, GROUND, w, 3, p.glow);
    g.fillStyle = p.groundDark;
    for (let i = 0; i < 12; i++) {
      const cx = x + ((i * 61 - game.scroll) % (w + 40) + w + 40) % (w + 40) - 20;
      g.beginPath(); g.ellipse(cx, GROUND + 14 + (i % 3) * 6, 9 + (i % 4) * 2, 3, 0, 0, Math.PI * 2); g.fill();
    }
    // obstacles
    for (const o of game.obstacles) {
      if (o.kind === 'rock') {
        g.fillStyle = p.rock; g.beginPath();
        g.moveTo(o.x, o.y + o.h); g.lineTo(o.x + o.w * 0.12, o.y + o.h * 0.35); g.lineTo(o.x + o.w * 0.45, o.y);
        g.lineTo(o.x + o.w * 0.85, o.y + o.h * 0.25); g.lineTo(o.x + o.w, o.y + o.h); g.fill();
        g.fillStyle = p.groundDark; g.beginPath(); g.arc(o.x + o.w * 0.5, o.y + o.h * 0.55, o.w * 0.14, 0, Math.PI * 2); g.fill();
      } else {
        const grd = g.createLinearGradient(o.x, 0, o.x + 90, 0);
        grd.addColorStop(0, '#fff'); grd.addColorStop(0.25, p.glow); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.beginPath(); g.moveTo(o.x, o.y + o.h / 2); g.lineTo(o.x + 90, o.y); g.lineTo(o.x + 90, o.y + o.h); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(o.x + 5, o.y + o.h / 2, 6, 0, Math.PI * 2); g.fill();
      }
    }
    drawUfo(p);
    // warp streaks between worlds
    if (game.warp > 0) {
      g.strokeStyle = `rgba(255,255,255,${Math.min(0.8, game.warp)})`; g.lineWidth = 2;
      for (let i = 0; i < 14; i++) { const ly = y + 10 + i * 15, lx = x + ((i * 131 - game.scroll * 3) % w + w) % w; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + 70, ly); g.stroke(); }
    }
    // score
    const f = 'bold 15px "Courier New", monospace';
    if (game.state !== 'idle') text(String(Math.floor(game.score)).padStart(5, '0'), x + w - 12, y + 22, '#fff', f, 'right');
    if (game.best) text('BEST ' + String(game.best).padStart(5, '0'), x + 12, y + 22, 'rgba(255,255,255,0.6)', f);
    if (game.state === 'idle') {
      // the Play button, right in the middle
      rect(x, y, w, h, 'rgba(0,0,0,0.35)');
      bevel(x + w / 2 - 62, y + h / 2 - 22, 124, 44);
      g.fillStyle = C.text; g.beginPath(); g.moveTo(x + w / 2 - 38, y + h / 2 - 10); g.lineTo(x + w / 2 - 38, y + h / 2 + 10); g.lineTo(x + w / 2 - 22, y + h / 2); g.fill();
      text('PLAY', x + w / 2 + 12, y + h / 2 + 6, C.text, 'bold 17px "Courier New", monospace', 'center');
    } else if (game.state === 'over') {
      rect(x, y, w, h, 'rgba(0,0,0,0.45)');
      text('BONK', x + w / 2, y + h / 2 - 12, '#fff', 'bold 30px "Courier New", monospace', 'center');
      if (game.overT > 0.5) text('click to fly again', x + w / 2, y + h / 2 + 16, '#fff', f, 'center');
    } else if (game.t < 4) {
      text('CLICK / SPACE  hop      S  duck', x + w / 2, y + h - 8, 'rgba(255,255,255,0.75)', 'bold 12px "Courier New", monospace', 'center');
    }
    g.restore();
    g.strokeStyle = '#222'; g.lineWidth = 2; g.strokeRect(x - 1, y - 1, w + 2, h + 2);
    hit(x, y, w, h, jump);
  }
  function drawUfo(p) {
    const cx = GAME.x + 78, ducking = game.duck && game.y === 0;
    const hover = game.state === 'play' ? Math.sin(game.t * 9) * 1.5 : 0;
    const base = GROUND - 10 - game.y + hover + (ducking ? 6 : 0);
    const tilt = game.state === 'over' ? 0.5 : THREE.MathUtils.clamp(-game.vy / 1400, -0.25, 0.25);
    // the beam it floats on
    if (game.state !== 'over') { g.fillStyle = 'rgba(160,230,255,0.16)'; g.beginPath(); g.moveTo(cx - 7, base); g.lineTo(cx + 7, base); g.lineTo(cx + 14, GROUND); g.lineTo(cx - 14, GROUND); g.fill(); }
    g.save(); g.translate(cx, base); g.rotate(tilt); g.scale(ducking ? 1.15 : 1, ducking ? 0.6 : 1);
    // glass dome with the little traveler inside
    g.fillStyle = 'rgba(190,235,255,0.5)'; g.beginPath(); g.arc(0, -8, 12, Math.PI, 0); g.fill();
    g.fillStyle = '#9fe08a'; g.beginPath(); g.ellipse(0, -10, 5.5, 7, 0, 0, Math.PI * 2); g.fill();          // head
    g.strokeStyle = '#9fe08a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -16); g.lineTo(3, -21); g.stroke();   // one antenna
    g.fillStyle = '#9fe08a'; g.beginPath(); g.arc(3.5, -21.5, 1.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#10141a'; g.beginPath(); g.ellipse(-2.3, -10.5, 1.6, 2.6, 0.3, 0, Math.PI * 2); g.ellipse(2.6, -10.5, 1.6, 2.6, -0.3, 0, Math.PI * 2); g.fill();
    // saucer
    g.fillStyle = '#c9ced8'; g.beginPath(); g.ellipse(0, -5, 21, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#8c93a3'; g.beginPath(); g.ellipse(0, -3, 21, 5, 0, 0, Math.PI); g.fill();
    for (let i = -2; i <= 2; i++) { g.fillStyle = (Math.floor(game.t * 6) + i) % 3 === 0 ? p.glow : '#5a6170'; g.beginPath(); g.arc(i * 8, -3, 1.8, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }

  // ------------------------------------------------------------------ power, input, per-frame update
  function setPower(p) { st.power = p; st.t = 0; brain.state.pcOn = p === 'on' || p === 'boot'; dirty = true; }
  function redraw() {
    hits = [];
    if (st.power === 'off') drawOff();
    else if (st.power === 'boot') drawBoot();
    else if (st.power === 'shutdown') drawShutdown();
    else {
      drawDesktop();
      // mouse pointer (tucked away while you're flying)
      // (also not drawn when the player's own mouse cursor is doing the pointing)
      const { x, y } = st.real || (game.state === 'play' && st.win === 'browser') ? { x: -40, y: -40 } : st.cur;
      g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 17); g.lineTo(x + 4.5, y + 13); g.lineTo(x + 8, y + 20); g.lineTo(x + 10.5, y + 19); g.lineTo(x + 7, y + 12); g.lineTo(x + 12.5, y + 12); g.closePath(); g.fill(); g.stroke();
    }
    // faint scanlines, so it reads as a tube
    g.fillStyle = 'rgba(0,0,0,0.07)';
    for (let yy = 0; yy < H; yy += 3) g.fillRect(0, yy, W, 1);
    texture.needsUpdate = true;
    dirty = false;
  }

  const api = {
    texture, canvas, game,
    get power() { return st.power; },
    get window() { return st.win; },
    get playing() { return st.power === 'on' && st.win === 'browser' && game.state === 'play'; },
    // the player sat down at it: wake it up if it's off
    wake() { if (st.power === 'off') { setPower('boot'); sfx('boot'); } },
    move(dx, dy) {
      if (st.power !== 'on') return;
      st.cur.x = THREE.MathUtils.clamp(st.cur.x + dx, 0, W - 4); st.cur.y = THREE.MathUtils.clamp(st.cur.y + dy, 0, H - 4);
      dirty = true;
    },
    // the player's real mouse cursor does the pointing: x, y in screen pixels, or off the glass
    point(x, y, onScreen) {
      st.real = true; st.off = !onScreen;
      st.cur.x = THREE.MathUtils.clamp(x, 0, W - 1); st.cur.y = THREE.MathUtils.clamp(y, 0, H - 1);
      dirty = true;
    },
    // back to the drawn pointer (no real cursor to show)
    drawnPointer() { if (st.real) { st.real = false; st.off = false; dirty = true; } },
    click() {
      if (st.power === 'off') { api.wake(); return; }
      if (st.power !== 'on' || st.off) return;
      for (let i = hits.length - 1; i >= 0; i--) {
        const r = hits[i];
        if (st.cur.x >= r.x && st.cur.x <= r.x + r.w && st.cur.y >= r.y && st.cur.y <= r.y + r.h) { r.fn(); break; }
      }
      dirty = true;
    },
    key(code, down) {
      if (st.power !== 'on' || st.win !== 'browser') return;
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') { if (down) jump(); }
      if (code === 'ArrowDown' || code === 'KeyS') game.duck = down;
      dirty = true;
    },
    update(dt) {
      st.t += dt;
      if (st.power === 'boot') { dirty = true; if (st.t > 3.5) { setPower('on'); sfx('chime'); } }
      if (st.power === 'shutdown' && st.t > 1.8) setPower('off');
      if (st.power === 'on') {
        if (st.printing > 0) { st.printing -= dt; if (st.printing <= 0) onPrint(); dirty = true; }
        if (st.win === 'browser' && game.state !== 'idle') { updateGame(dt); dirty = true; }
        const m = Math.floor(brain.state.clockSec / 60);
        if (m !== st.minute) { st.minute = m; dirty = true; }
      }
      if (dirty) redraw();
    },
    // for automated checks: put the pointer somewhere and click
    clickAt(x, y) { st.off = false; st.cur.x = x; st.cur.y = y; redraw(); api.click(); redraw(); },
  };
  redraw();
  return api;
}
