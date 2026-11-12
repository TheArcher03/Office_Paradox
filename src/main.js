// Office Paradox — Stage 1 "The Box" (v4, seated pass): you sit in the chair and spin to look around.
// The only things you can pick up are pieces of paper: take a sheet, crumple it, toss it.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildRoom } from './room.js';
import { GrayFilterShader } from './grayFilter.js';
import * as Audio from './audio.js';

// ---------- Tuning knobs (change these to adjust the feel) ----------
const TUNE = {
  lookSensitivity: 0.0022,
  seat: { x: -0.25, z: -0.1 },   // the chair is locked here
  eyeSeated: 1.17,
  reach: 1.8,               // how far away you can pick paper up
  aimAssist: 0.075,         // radians: how close to the dot something has to be to count as "looked at"
  // Where your hand sits in the view (forward / right / up from your eyes): low and to the right.
  hand: { fwd: 0.44, right: 0.5, up: -0.17 },   // `right` is a share of the half-screen width, so it fits any window shape
  grabTime: 0.22,           // seconds for paper to travel into your hand
  crumpleTime: 0.55,        // seconds to scrunch a sheet into a ball
  // Toss: click and the ball leaves your hand toward where you're looking, with a little lift. No power meter.
  throwSpeed: 2.8,          // m/s: a soft lob
  throwLift: 0.8,           // extra upward arc. Tuned so the dot on the rim of the can drops it in from the chair
  throwConverge: 1.5,       // m: the ball's path crosses your line of sight this far out
  maxPaper: 30,             // loose sheets + balls in the room before the oldest one is cleared away
  fov: 72,
  startColor: 0.06,         // 0 = fully gray, 1 = full color
};

// ---------- Renderer, scene, camera ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a2b29');
const camera = new THREE.PerspectiveCamera(TUNE.fov, window.innerWidth / window.innerHeight, 0.03, 60);
camera.rotation.order = 'YXZ';

// Lights: flat overhead office light from the fluorescent panels.
scene.add(new THREE.HemisphereLight('#eef2f6', '#4a4a4a', 1.0));
const sun = new THREE.DirectionalLight('#f4f6ff', 1.7);
sun.position.set(0.3, 6, 0.25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1.8, right: 1.8, top: 1.8, bottom: -1.8, near: 1, far: 9 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun);
const fill = new THREE.PointLight('#fff8ee', 0.6, 4, 2); fill.position.set(0, 1.9, 0.6); scene.add(fill);
const ceilingGlow = new THREE.PointLight('#f2f5ff', 0.9, 5, 2); ceilingGlow.position.set(0.3, 2.85, 0); scene.add(ceilingGlow);

// ---------- Physics ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.allowSleep = true;
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.45;
world.defaultContactMaterial.restitution = 0.22;

const room = buildRoom(scene, world);
const { props, chair, chairBody, clock, GROUP } = room;

// impact sounds
const lastSound = new Map();
room.impact.fn = (p, e) => {
  const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
  if (v < 0.45 || (held && p === held.prop)) return;
  const now = performance.now();
  if (now - (lastSound.get(p) || 0) < 70) return;
  lastSound.set(p, now);
  Audio.impact(p.sound, v);
};

// ---------- Post-processing (the gray filter) ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());
const grayPass = new ShaderPass(GrayFilterShader);
grayPass.uniforms.saturation.value = TUNE.startColor;
composer.addPass(grayPass);

// ---------- Player: locked in the chair, free to spin all the way around ----------
const player = { yaw: 0, pitch: -0.18, yawRate: 0 };
chair.position.set(TUNE.seat.x, 0, TUNE.seat.z);
chairBody.position.set(TUNE.seat.x, 0, TUNE.seat.z);

const keys = new Set();
let started = false, paused = true, fallbackLook = false;

// ---------- Interaction state ----------
let held = null;            // { prop, kind: 'sheet' | 'ball', t, fromPos, fromQuat }
let crumple = null;         // a sheet being scrunched: { mesh, set, t, fromPos, fromQuat }
let hovered = null;         // { kind: 'prop', prop } | { kind: 'dispenser', obj }
let highlighted = null;     // the object currently glowing
const paper = props.filter((p) => p.grab);   // every loose sheet + ball, oldest first
const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
const handPos = new THREE.Vector3(), handQuat = new THREE.Quaternion();
const sheetTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(1.0, 0.3, 0.12));

const ui = {
  overlay: document.getElementById('overlay'),
  cross: document.getElementById('crosshair'),
  debug: document.getElementById('debug'),
  sat: document.getElementById('sat'),
  satVal: document.getElementById('satVal'),
  power: document.getElementById('power'),
  powerVal: document.getElementById('powerVal'),
  reset: document.getElementById('reset'),
  dbgInfo: document.getElementById('dbgInfo'),
};
ui.sat.value = TUNE.startColor;
ui.satVal.textContent = Math.round(TUNE.startColor * 100) + '%';
ui.sat.addEventListener('input', () => {
  grayPass.uniforms.saturation.value = parseFloat(ui.sat.value);
  ui.satVal.textContent = Math.round(ui.sat.value * 100) + '%';
});
const baseThrow = TUNE.throwSpeed;
ui.power.value = 1;
ui.powerVal.textContent = '1.00×';
ui.power.addEventListener('input', () => {
  const k = parseFloat(ui.power.value);
  TUNE.throwSpeed = baseThrow * k;
  ui.powerVal.textContent = k.toFixed(2) + '×';
});
ui.reset.addEventListener('click', () => location.reload());

// ---------- Input ----------
const canvas = renderer.domElement;
ui.overlay.addEventListener('click', () => {
  Audio.startAudio();
  started = true;
  if (canvas.requestPointerLock && !fallbackLook) {
    try {
      const r = canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => enterFallback());
    } catch { enterFallback(); }
  } else enterFallback();
  setTimeout(() => { if (!document.pointerLockElement) enterFallback(); }, 400);
});
function enterFallback() { fallbackLook = true; resume(); }
function resume() { paused = false; ui.overlay.style.display = 'none'; }
function pause() { paused = true; ui.overlay.style.display = 'flex'; }

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) { fallbackLook = false; resume(); }
  else if (started && !fallbackLook) pause();
});
document.addEventListener('pointerlockerror', enterFallback);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Backquote') { ui.debug.style.display = ui.debug.style.display === 'block' ? 'none' : 'block'; return; }
  if (e.code === 'Escape' && fallbackLook && started) { paused ? resume() : pause(); return; }
  if (paused) return;
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyF') putDown();
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

window.addEventListener('mousemove', (e) => {
  if (paused) return;
  const locked = document.pointerLockElement === canvas;
  if (!locked && !fallbackLook) return;
  // ignore the occasional huge jump some browsers report under pointer lock
  const dx = THREE.MathUtils.clamp(e.movementX || 0, -300, 300), dy = THREE.MathUtils.clamp(e.movementY || 0, -300, 300);
  player.yaw -= dx * TUNE.lookSensitivity;
  player.pitch = THREE.MathUtils.clamp(player.pitch - dy * TUNE.lookSensitivity, -1.5, 1.45);
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('contextmenu', (e) => { if (started) e.preventDefault(); });
window.addEventListener('mousedown', (e) => {
  if (paused || e.target !== canvas) return;
  if (e.button === 0) click();
  else if (e.button === 2) putDown();
});

// One button does everything: empty hand → pick up paper. Flat sheet in hand → crumple it. Ball in hand → toss it.
function click() {
  if (crumple) return;
  if (!held) { if (hovered) useHovered(); return; }
  if (held.t < 1) return;
  if (held.kind === 'sheet') startCrumple();
  else toss();
}

// ---------- Your hand: where held paper sits in the view ----------
function updateHand(kind) {
  camera.getWorldDirection(fwd);
  up.copy(camera.up).applyQuaternion(camera.quaternion);
  right.crossVectors(fwd, up).normalize();
  handPos.copy(camera.position)
    .addScaledVector(fwd, TUNE.hand.fwd)
    .addScaledVector(right, Math.min(0.24, TUNE.hand.right * TUNE.hand.fwd * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect))
    .addScaledVector(up, TUNE.hand.up);
  handQuat.copy(camera.quaternion);
  if (kind === 'sheet') handQuat.multiply(sheetTilt);
}

// ---------- Picking paper up ----------
function useHovered() {
  if (!hovered) return;
  if (hovered.kind === 'prop') { Audio.impact('paper', 0.6); grab(hovered.prop); }
  else if (hovered.kind === 'dispenser') {
    // take a fresh sheet off the top of the stack
    const s = room.stackTop;
    const sheet = room.spawnSheet(s.x, s.y, s.z);
    trackPaper(sheet);
    Audio.peel();
    grab(sheet);
  }
}
function trackPaper(p) {
  paper.push(p);
  while (paper.length > TUNE.maxPaper) {
    const i = paper.findIndex((q) => !held || q !== held.prop);
    if (i < 0) break;
    const old = paper.splice(i, 1)[0];
    if (highlighted === old.mesh) highlighted = null;
    room.removeProp(old);
  }
}
function grab(p) {
  const b = p.body;
  b.type = CANNON.Body.KINEMATIC;      // in your hand it just follows you: no physics tug-of-war
  b.collisionFilterMask = 0;
  b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
  b.wakeUp();
  held = {
    prop: p, kind: p.name === 'paperBall' ? 'ball' : 'sheet', t: 0,
    fromPos: new THREE.Vector3().copy(b.position), fromQuat: new THREE.Quaternion().copy(b.quaternion),
  };
}
// let go of what you're holding, with a starting velocity (or none: it just drops)
function release(vel = null, spin = 0) {
  if (!held) return null;
  const p = held.prop, b = p.body;
  b.type = CANNON.Body.DYNAMIC;
  b.mass = p.mass; b.updateMassProperties();
  b.collisionFilterMask = GROUP.WORLD | GROUP.PROP;
  b.position.copy(p.mesh.position); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
  b.quaternion.copy(p.mesh.quaternion); b.previousQuaternion.copy(b.quaternion); b.interpolatedQuaternion.copy(b.quaternion);
  if (vel) b.velocity.set(vel.x, vel.y, vel.z); else b.velocity.set(0, 0, 0);
  b.angularVelocity.set((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin);
  b.wakeUp();
  held = null;
  return p;
}
function putDown() {
  if (crumple || !held || held.t < 1) return;
  camera.getWorldDirection(fwd);
  release(tmpV.copy(fwd).multiplyScalar(0.5), 1);    // a gentle set-down in front of you
}

// ---------- Crumpling a sheet ----------
function startCrumple() {
  const sheet = held.prop;
  const c = room.makeCrumple(sheet.kind);
  c.mesh.position.copy(sheet.mesh.position); c.mesh.quaternion.copy(sheet.mesh.quaternion);
  scene.add(c.mesh);
  crumple = { ...c, t: 0, fromQuat: sheet.mesh.quaternion.clone(), next: 0 };
  // the flat sheet is gone; the scrunched one takes its place
  held = null;
  const i = paper.indexOf(sheet); if (i >= 0) paper.splice(i, 1);
  if (highlighted === sheet.mesh) highlighted = null;
  room.removeProp(sheet);
}
function updateCrumple(dt) {
  const c = crumple;
  c.t = Math.min(1, c.t + dt / TUNE.crumpleTime);
  c.set(easeInOut(c.t));
  updateHand('ball');
  // it tumbles a little in your fingers as it scrunches
  const wobble = Math.sin(c.t * Math.PI);
  tmpQ.setFromEuler(tmpE.set(wobble * 0.9, wobble * 0.6, c.t * 2.2));
  c.mesh.quaternion.copy(c.fromQuat).slerp(handQuat, c.t).multiply(tmpQ);
  c.mesh.position.copy(handPos);
  c.mesh.position.y += wobble * 0.02;
  if (c.t >= c.next) { Audio.impact('paper', 0.5 + Math.random() * 0.5); c.next += 0.22; }   // crinkle
  if (c.t >= 1) {
    scene.remove(c.mesh);
    const ball = room.addBall(c.mesh, handPos.x, handPos.y, handPos.z);
    ball.body.quaternion.copy(c.mesh.quaternion);
    trackPaper(ball);
    crumple = null;
    grab(ball);
    held.t = 1;
  }
}
const tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();
const easeInOut = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const angleTo = (from, to) => { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

// ---------- Tossing ----------
// The ball leaves your hand (low right) and crosses your line of sight a couple of meters out, so it's always in view.
function toss() {
  if (!held || held.kind !== 'ball') return null;
  updateHand('ball');
  const aim = tmpV.copy(camera.position).addScaledVector(fwd, TUNE.throwConverge);
  const dir = aim.sub(handPos).normalize();
  dir.y += TUNE.throwLift; dir.normalize();
  held.prop.mesh.position.copy(handPos);
  Audio.whoosh(0.45);
  return release(dir.multiplyScalar(TUNE.throwSpeed), 8);
}

// ---------- Each frame: look, chair, camera ----------
function updatePlayer(dt) {
  const look = 1.9 * dt;   // arrow-key look (fallback)
  if (keys.has('ArrowLeft')) player.yaw += look;
  if (keys.has('ArrowRight')) player.yaw -= look;
  if (keys.has('ArrowUp')) player.pitch = Math.min(1.45, player.pitch + look * 0.8);
  if (keys.has('ArrowDown')) player.pitch = Math.max(-1.5, player.pitch - look * 0.8);

  // the chair swivels with you
  const turn = angleTo(chair.rotation.y, player.yaw) * Math.min(1, dt * 14);
  chair.rotation.y += turn;
  player.yawRate = dt > 0 ? Math.abs(turn) / dt : 0;
  Audio.chairRoll(player.yawRate * 0.25);
  chairBody.quaternion.setFromEuler(0, chair.rotation.y, 0);

  const off = 0.07;
  camera.position.set(TUNE.seat.x - Math.sin(player.yaw) * off, TUNE.eyeSeated, TUNE.seat.z - Math.cos(player.yaw) * off);
  camera.rotation.set(player.pitch, player.yaw, 0);
  camera.updateMatrixWorld();
}

function updateHeld(dt) {
  if (!held) return;
  held.t = Math.min(1, held.t + dt / TUNE.grabTime);
  updateHand(held.kind);
  const m = held.prop.mesh, e = easeOut(held.t);
  m.position.lerpVectors(held.fromPos, handPos, e);
  if (held.kind === 'sheet') m.quaternion.copy(held.fromQuat).slerp(handQuat, e);
  else m.quaternion.copy(held.fromQuat).slerp(handQuat, held.t < 1 ? e : 1);
  if (held.t >= 1 && held.kind === 'ball') held.fromQuat.copy(handQuat);
  const b = held.prop.body;
  b.position.copy(m.position); b.quaternion.copy(m.quaternion);
  b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0);
}

// ---------- What you're looking at (+ a soft glow on it) ----------
function ownerOf(o) {
  while (o) {
    if (o.userData.prop) { const p = paper.find((q) => q.mesh === o); return p ? { kind: 'prop', prop: p } : null; }
    if (o.userData.dispenser) return { kind: 'dispenser', obj: o };
    o = o.parent;
  }
  return null;
}
const lookables = [];
function updateHover() {
  hovered = null;
  if (held || crumple) return;
  lookables.length = 0;
  for (const p of paper) lookables.push(p.mesh);
  for (const d of room.dispensers) lookables.push(d);
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = TUNE.reach;
  const hit = raycaster.intersectObjects(lookables, true)[0];
  if (hit) hovered = ownerOf(hit.object);
  if (hovered) return;
  // aim assist: paper near the dot counts
  camera.getWorldDirection(fwd);
  let best = null, bestAngle = Infinity;
  for (const p of paper) {
    tmpV.copy(p.mesh.position).sub(camera.position);
    const d = tmpV.length();
    if (d > TUNE.reach || d < 0.05) continue;
    const a = tmpV.normalize().angleTo(fwd);
    if (a < TUNE.aimAssist && a < bestAngle) { best = p; bestAngle = a; }
  }
  if (best) hovered = { kind: 'prop', prop: best };
}
function setGlow(obj, on) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.emissive && !m.userData.keepEmissive) m.emissive.setHex(on ? 0x2e2e2e : 0x000000); });
  });
}
function updateGlow() {
  const target = hovered ? (hovered.kind === 'prop' ? hovered.prop.mesh : hovered.obj) : null;
  if (target === highlighted) return;
  if (highlighted) setGlow(highlighted, false);
  if (target) setGlow(target, true);
  highlighted = target;
}

// ---------- Clock (starts at 9:00, ticks in real seconds for now) ----------
let clockSec = 9 * 3600, lastWholeSec = -1;
function updateClock(dt) {
  clockSec += dt;
  const s = Math.floor(clockSec);
  if (s !== lastWholeSec) {
    lastWholeSec = s;
    const sec = s % 60, min = (s / 60) % 60, hr = (s / 3600) % 12;
    clock.secHand.rotation.z = -(sec / 60) * Math.PI * 2;
    clock.minHand.rotation.z = -(min / 60) * Math.PI * 2;
    clock.hourHand.rotation.z = -(hr / 12) * Math.PI * 2;
    if (!paused) {
      const toClock = new THREE.Vector3(clock.group.position.x - camera.position.x, 0, clock.group.position.z - camera.position.z).normalize();
      camera.getWorldDirection(fwd); right.set(-fwd.z, 0, fwd.x).normalize();
      Audio.tick(THREE.MathUtils.clamp(toClock.dot(right), -1, 1) * 0.7);
    }
  }
}

// ---------- Main loop ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 0;
function step(dt) {
  updatePlayer(dt);
  world.step(1 / 120, dt, 6);
  // Draw every loose thing where the physics says it is *right now* (blended between physics ticks, so motion is
  // smooth on any screen refresh rate), then put whatever is in your hand exactly in your hand.
  for (const p of props) {
    if (p.body.type !== CANNON.Body.DYNAMIC) continue;
    p.mesh.position.copy(p.body.interpolatedPosition); p.mesh.quaternion.copy(p.body.interpolatedQuaternion);
  }
  updateHeld(dt);
  if (crumple) updateCrumple(dt);
  updateHover();
  updateGlow();
  updateClock(dt);
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) step(dt);

  grayPass.uniforms.time.value = (now / 1000) % 100;
  room.detectorLed.emissiveIntensity = (now % 4000) < 140 ? 3 : 0;
  ui.cross.classList.toggle('hot', !!hovered);
  composer.render();

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) {
    fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
    if (ui.debug.style.display === 'block') ui.dbgInfo.textContent = `${fps} fps · ${paper.length} paper${fallbackLook ? ' · arrow-look' : ''}`;
  }
  requestAnimationFrame(frame);
}
updatePlayer(0);
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Test hooks (used by automated checks, harmless in play) ----------
const inCan = (p) => {
  const c = room.trashCan, b = p.body.position;
  return Math.hypot(b.x - c.x, b.z - c.z) < c.r && b.y < c.h;
};
window.__op = {
  TUNE, player, props, paper, world, camera, chair,
  start() { started = true; fallbackLook = true; resume(); },
  look(yaw, pitch) { player.yaw = yaw; player.pitch = pitch; updatePlayer(0); scene.updateMatrixWorld(); updateHover(); },
  // yaw / pitch that put the dot on a point in the room
  aimAt(x, y, z) {
    const dx = x - TUNE.seat.x, dz = z - TUNE.seat.z;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(y - TUNE.eyeSeated, Math.hypot(dx, dz));
    this.look(yaw, pitch); return { yaw, pitch };
  },
  hovered: () => (hovered ? (hovered.kind === 'prop' ? hovered.prop.name : hovered.kind) : null),
  held: () => (crumple ? 'crumpling' : held ? held.prop.name : null),
  click() { click(); return this.held(); },
  putDown() { putDown(); },
  // run the game forward without waiting for real time (seconds)
  advance(sec) { for (let t = 0; t < sec; t += 1 / 60) step(1 / 60); },
  trashCan: room.trashCan,
  isInCan: (p) => inCan(p),
  clearPaper() { for (const p of paper.splice(0)) { if (held && p === held.prop) paper.push(p); else room.removeProp(p); } highlighted = null; },
  inCan: () => paper.filter(inCan).length,
  ballPos: (p) => ({ x: p.body.position.x, y: p.body.position.y, z: p.body.position.z }),
  setColor(v) { grayPass.uniforms.saturation.value = v; ui.sat.value = v; },
  fps: () => fps,
};
