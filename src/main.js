// Office Paradox — Stage 2 "The Brain": you sit in the chair and spin to look around. The only things you can
// pick up are pieces of paper. The game quietly notices what you do with them (and with the chair, the shredder
// and the calendar), writes it in your journal, and lets a little color back in.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildRoom } from './room.js';
import { GrayFilterShader } from './grayFilter.js';
import * as Audio from './audio.js';
import { createBrain } from './brain.js';
import { createJournal } from './journal.js';
import { createComputer } from './computer.js';
import { crossDay, CALENDAR } from './textures.js';

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
  fov: 72, fovCalendar: 44,
  useReach: 2.3,            // how far away you can use the shredder / calendar
  // Spinning the chair: A / D push off, and it glides.
  spinAccel: 7, spinMax: 7.5, spinFriction: 0.55,   // rad/s², rad/s, how fast it coasts down
  spinsNeeded: 10,          // full turns in one direction, in one go
  dizzyFrom: 3,             // turns before the room starts to swim
  crossEvery: 0.17,         // seconds between calendar X's while you hold the button
  shredTime: 1.5,           // seconds for the shredder to eat a sheet
  deskTime: 0.65,           // seconds to lean in to / back from the monitor
  screenFill: 0.84,         // how much of the view the screen fills when you lean in
  cursorSpeed: 1.0,         // mouse pointer speed on the computer
  printTime: 1.6,           // seconds for the printer to push a page out
  maxPinned: 8,             // sheets on the corkboard before the oldest comes down
  startColor: 0.06,         // 0 = fully gray, 1 = full color
  colorFromCognition: 0.34, // how much color a full cognition meter adds (the prototype never fills it)
  colorEase: 0.12,          // how slowly color creeps in (lower = slower)
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

// ---------- The Brain: hidden tasks, cognition, journal, save file ----------
const popup = document.getElementById('popup');
let popupTimer = 0;
const brain = createBrain({
  onComplete(id, task) {
    popup.querySelector('.name').textContent = task.title;
    popup.classList.add('show');
    clearTimeout(popupTimer);
    popupTimer = setTimeout(() => popup.classList.remove('show'), 4500);
    Audio.chime();
  },
});
const loadedSave = brain.load();
const journal = createJournal(brain, { onTurn: () => Audio.pageTurn() });
let colorBase = TUNE.startColor;     // the debug slider moves this; cognition adds on top
const colorTarget = () => Math.min(1, colorBase + brain.cognition() * TUNE.colorFromCognition);
grayPass.uniforms.saturation.value = colorTarget();
// the computer on the desk: its picture is drawn in src/computer.js and shown on the monitor
const pc = createComputer({
  brain,
  sfx: (name) => Audio.computer(name),
  onPrint: () => startPrint(),
  onScore: () => brain.complete('ufoGame'),
});
room.screen.material.map = pc.texture; room.screen.material.needsUpdate = true;
const desk = { at: false, entering: false, k: 0, fromPos: new THREE.Vector3(), fromQuat: new THREE.Quaternion() };
const deskHint = document.getElementById('deskHint');
let printJob = null;
// whatever you pinned to the corkboard is still there
for (const r of brain.state.pinned) room.pinSheet(r.kind, r.z, r.y, r.tilt);
// the calendar remembers how far you got
const calTex = room.calendar.material.map;
if (brain.state.calendarDay == null) brain.state.calendarDay = CALENDAR.crossedAtStart;
for (let d = CALENDAR.crossedAtStart + 1; d <= brain.state.calendarDay; d++) crossDay(calTex, d);

// ---------- Player: locked in the chair, free to spin all the way around ----------
const player = { yaw: 0, pitch: -0.18, yawRate: 0, spin: 0, turned: 0, against: 0, still: 0, dizzy: 0 };
chair.position.set(TUNE.seat.x, 0, TUNE.seat.z);
chairBody.position.set(TUNE.seat.x, 0, TUNE.seat.z);

const keys = new Set();
let started = false, paused = true, fallbackLook = false;

// ---------- Interaction state ----------
let held = null;            // { prop, kind: 'sheet' | 'ball', t, fromPos, fromQuat }
let crumple = null;         // a sheet being scrunched: { mesh, set, t, fromPos, fromQuat }
let hovered = null;         // { kind: 'prop', prop } | { kind: 'dispenser' | 'shredder' | 'calendar', obj }
let shred = null;           // a sheet on its way into the shredder
let mouseHeld = false, crossTimer = 0, calendarFocus = 0;
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
  colorBase = parseFloat(ui.sat.value) - brain.cognition() * TUNE.colorFromCognition;
  grayPass.uniforms.saturation.value = colorTarget();
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
ui.reset.addEventListener('click', () => { saveNow(); location.reload(); });
document.getElementById('erase').addEventListener('click', () => { erased = true; brain.erase(); location.reload(); });
let erased = false;

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
  if (desk.at) {
    // at the computer the keyboard belongs to the computer
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) pc.key(e.code, true);
    return;
  }
  if (e.code === 'KeyJ') { journal.toggle(); return; }
  if (journal.open) {
    if (e.code === 'ArrowRight' || e.code === 'KeyD') journal.turn(1);
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') journal.turn(-1);
    return;
  }
  if (e.code === 'KeyF') putDown();
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys.delete(e.code); pc.key(e.code, false); });
window.addEventListener('blur', () => keys.clear());

window.addEventListener('mousemove', (e) => {
  if (paused) return;
  const locked = document.pointerLockElement === canvas;
  if (!locked && !fallbackLook) return;
  if (journal.open) return;
  if (desk.at) { pc.move((e.movementX || 0) * TUNE.cursorSpeed, (e.movementY || 0) * TUNE.cursorSpeed); return; }
  // ignore the occasional huge jump some browsers report under pointer lock
  const dx = THREE.MathUtils.clamp(e.movementX || 0, -300, 300), dy = THREE.MathUtils.clamp(e.movementY || 0, -300, 300);
  player.yaw -= dx * TUNE.lookSensitivity;
  player.pitch = THREE.MathUtils.clamp(player.pitch - dy * TUNE.lookSensitivity, -1.5, 1.45);
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('contextmenu', (e) => { if (started) e.preventDefault(); });
window.addEventListener('mousedown', (e) => {
  if (paused) return;
  if (journal.open) { journal.turn(e.button === 2 ? -1 : 1); return; }
  if (e.target !== canvas) return;
  if (desk.at) { if (e.button === 0) pc.click(); else if (e.button === 2) leaveDesk(); return; }
  if (e.button === 0) { mouseHeld = true; click(); }
  else if (e.button === 2) putDown();
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) mouseHeld = false; });

// One button does everything: empty hand → pick up paper. Flat sheet in hand → crumple it. Ball in hand → toss it.
// (A flat sheet goes into the shredder instead, if that's what you're looking at.)
function click() {
  if (crumple) return;
  if (!held) { if (hovered) useHovered(); return; }
  if (held.t < 1) return;
  if (held.kind === 'sheet') {
    if (hovered && hovered.kind === 'shredder') startShred();
    else if (hovered && hovered.kind === 'corkboard') pinHeld();
    else startCrumple();
  }
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
  else if (hovered.kind === 'calendar') crossNextDay();
  else if (hovered.kind === 'computer') enterDesk();
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

// ---------- The computer: lean in to the monitor, lean back out ----------
function enterDesk() {
  if (held || crumple || desk.at) return;
  desk.at = true; desk.entering = true;
  desk.fromPos.copy(camera.position); desk.fromQuat.copy(camera.quaternion);
  // the chair ends up facing the desk
  player.spin = 0;
  player.yaw = Math.round(player.yaw / (Math.PI * 2)) * Math.PI * 2; lastYaw = player.yaw;
  player.pitch = -0.12;
  keys.clear();
  pc.wake();
}
function leaveDesk() { desk.at = false; desk.entering = false; pc.key('KeyS', false); }
const NO_TURN = new THREE.Quaternion();
const deskPos = new THREE.Vector3();
function updateDeskCamera(dt) {
  desk.k = THREE.MathUtils.clamp(desk.k + (desk.at ? 1 : -1) * dt / TUNE.deskTime, 0, 1);
  if (desk.k <= 0) return;
  const v = room.monitorView, tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // far enough back that the whole screen fits, in a wide window or a tall one
  const dist = Math.max(v.h / TUNE.screenFill / 2 / tan, (v.h * 1.283) / 0.94 / 2 / (tan * camera.aspect));
  deskPos.set(v.x, v.y, v.z + dist);
  const e = easeInOut(desk.k);
  if (desk.entering) { camera.position.lerpVectors(desk.fromPos, deskPos, e); camera.quaternion.copy(desk.fromQuat).slerp(NO_TURN, e); }
  else { camera.position.lerp(deskPos, e); camera.quaternion.slerp(NO_TURN, e); }
  camera.updateMatrixWorld();
}

// ---------- The printer ----------
function startPrint() {
  if (printJob) return;
  const o = room.printerOut;
  const sheet = room.makeSheet('cat', o.from.x, o.from.y, o.from.z);
  sheet.body.type = CANNON.Body.KINEMATIC; sheet.body.collisionFilterMask = 0;
  printJob = { prop: sheet, t: 0 };
  Audio.printer(TUNE.printTime);
}
function updatePrint(dt) {
  const j = printJob, o = room.printerOut, b = j.prop.body;
  j.t = Math.min(1, j.t + dt / TUNE.printTime);
  j.prop.mesh.position.lerpVectors(o.from, o.to, j.t);
  b.position.copy(j.prop.mesh.position); b.velocity.set(0, 0, 0);
  if (j.t >= 1) {
    // the page is out: now it's a loose sheet you can pick up
    b.type = CANNON.Body.DYNAMIC; b.mass = j.prop.mass; b.updateMassProperties();
    b.collisionFilterMask = GROUP.WORLD | GROUP.PROP;
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    b.wakeUp();
    trackPaper(j.prop);
    printJob = null;
    brain.complete('printCat');
  }
}

// ---------- The corkboard ----------
function pinHeld() {
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = TUNE.useReach;
  const hit = raycaster.intersectObject(room.corkboard, false)[0];
  if (!hit) return;
  const sheet = held.prop, kind = sheet.kind;
  held = null;
  const i = paper.indexOf(sheet); if (i >= 0) paper.splice(i, 1);
  room.removeProp(sheet);
  if (room.pinned.length >= TUNE.maxPinned) { room.unpinOldest(); brain.state.pinned.shift(); }
  const rec = room.pinSheet(kind, hit.point.z, hit.point.y, (Math.random() - 0.5) * 0.16);
  brain.state.pinned.push({ kind, z: rec.z, y: rec.y, tilt: rec.tilt });
  Audio.pin();
  if (kind === 'cat') brain.complete('hangCat');
  brain.save();
}

// ---------- The shredder ----------
const shredQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));   // sheet standing on its short edge
function startShred() {
  if (shred) return;
  const sheet = held.prop;
  const c = room.makeCrumple(sheet.kind);     // at set(0) this is just the flat sheet
  c.mesh.position.copy(sheet.mesh.position); c.mesh.quaternion.copy(sheet.mesh.quaternion);
  scene.add(c.mesh);
  shred = { mesh: c.mesh, kind: sheet.kind, t: 0, fromPos: sheet.mesh.position.clone(), fromQuat: sheet.mesh.quaternion.clone(), buzzing: false };
  held = null;
  const i = paper.indexOf(sheet); if (i >= 0) paper.splice(i, 1);
  room.removeProp(sheet);
}
function updateShred(dt) {
  const s = shred, slot = room.shredder.userData.slot, travel = 0.4;
  s.t += dt;
  if (s.t < travel) {
    // from your hand to just above the slot
    const e = easeInOut(s.t / travel);
    tmpV.set(slot.x, slot.y + 0.15, slot.z);
    s.mesh.position.lerpVectors(s.fromPos, tmpV, e);
    s.mesh.quaternion.copy(s.fromQuat).slerp(shredQuat, e);
  } else {
    if (!s.buzzing) { s.buzzing = true; Audio.shredder(TUNE.shredTime); }
    const k = Math.min(1, (s.t - travel) / TUNE.shredTime);
    s.mesh.position.set(slot.x + Math.sin(s.t * 60) * 0.0015, slot.y + 0.15 - k * 0.3, slot.z);   // pulled down, shaking a little
    s.mesh.quaternion.copy(shredQuat);
    if (k >= 1) {
      scene.remove(s.mesh);
      if (s.kind === 'spreadsheet') brain.complete('shredder');
      shred = null;
    }
  }
}

// ---------- The calendar ----------
function crossNextDay() {
  const st = brain.state;
  if (st.calendarDay >= CALENDAR.days) return;
  st.calendarDay++;
  crossDay(calTex, st.calendarDay);
  Audio.scratch();
  crossTimer = TUNE.crossEvery;
  calendarFocus = 2.5;
  if (st.calendarDay >= CALENDAR.days) brain.complete('calendar');
}

// ---------- Paper in the trash can ----------
function inCan(p) {
  const c = room.trashCan, b = p.body.position;
  return Math.hypot(b.x - c.x, b.z - c.z) < c.r && b.y < c.h;
}
function checkBaskets() {
  for (const p of paper) {
    if (p.scored || p.name !== 'paperBall' || (held && held.prop === p)) continue;
    if (inCan(p) && p.body.velocity.length() < 0.6) {
      p.scored = true;
      brain.bonus('baskets', 1, 5);
      brain.complete('paperToss');
    }
  }
}

// ---------- Each frame: look, chair, camera ----------
function updatePlayer(dt) {
  const look = 1.9 * dt;   // arrow-key look (fallback)
  if (keys.has('ArrowLeft')) player.yaw += look;
  if (keys.has('ArrowRight')) player.yaw -= look;
  if (keys.has('ArrowUp')) player.pitch = Math.min(1.45, player.pitch + look * 0.8);
  if (keys.has('ArrowDown')) player.pitch = Math.max(-1.5, player.pitch - look * 0.8);

  // A / D push the chair around; it glides to a stop
  if (!journal.open && desk.k === 0) {
    const push = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
    if (push) player.spin = THREE.MathUtils.clamp(player.spin + push * TUNE.spinAccel * dt, -TUNE.spinMax, TUNE.spinMax);
    else player.spin *= Math.exp(-TUNE.spinFriction * dt);
    if (Math.abs(player.spin) < 0.02) player.spin = 0;
    player.yaw += player.spin * dt;
  }
  trackSpin(dt);

  // the chair swivels with you
  const turn = angleTo(chair.rotation.y, player.yaw) * Math.min(1, dt * 14);
  chair.rotation.y += turn;
  player.yawRate = dt > 0 ? Math.abs(turn) / dt : 0;
  Audio.chairRoll(player.yawRate * 0.25);
  chairBody.quaternion.setFromEuler(0, chair.rotation.y, 0);

  const off = 0.07;
  camera.position.set(TUNE.seat.x - Math.sin(player.yaw) * off, TUNE.eyeSeated, TUNE.seat.z - Math.cos(player.yaw) * off);
  // dizzy: the room keeps swimming for a while after a long spin
  const d = player.dizzy, t = performance.now() / 1000;
  camera.rotation.set(player.pitch + Math.sin(t * 1.3) * 0.035 * d, player.yaw + Math.sin(t * 0.83) * 0.07 * d, Math.sin(t * 1.7) * 0.075 * d);
  camera.updateMatrixWorld();
  updateDeskCamera(dt);
}
// Counts full turns in one direction, in one go, however you make them (keys or mouse).
let lastYaw = 0;
function trackSpin(dt) {
  const dy = player.yaw - lastYaw; lastYaw = player.yaw;
  if (dt <= 0) return;
  if (Math.abs(dy) / dt < 0.4) {
    player.still += dt;
    if (player.still > 1.5) { player.turned = 0; player.against = 0; }
  } else {
    player.still = 0;
    if (player.turned === 0 || Math.sign(dy) === Math.sign(player.turned)) { player.turned += dy; player.against = 0; }
    else { player.against += Math.abs(dy); if (player.against > 0.7) { player.turned = dy; player.against = 0; } }
  }
  const turns = Math.abs(player.turned) / (Math.PI * 2);
  const want = THREE.MathUtils.clamp((turns - TUNE.dizzyFrom) / (TUNE.spinsNeeded - TUNE.dizzyFrom), 0, 1);
  if (want > player.dizzy) player.dizzy += (want - player.dizzy) * Math.min(1, dt * 3);
  else player.dizzy = Math.max(0, player.dizzy - dt * 0.14);      // wears off over several seconds
  if (turns >= TUNE.spinsNeeded) brain.complete('chairSpin');
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
    if (o.userData.use) return { kind: o.userData.use, obj: o };
    if (o.userData.prop) { const p = paper.find((q) => q.mesh === o); return p ? { kind: 'prop', prop: p } : null; }
    if (o.userData.dispenser) return { kind: 'dispenser', obj: o };
    o = o.parent;
  }
  return null;
}
const lookables = [];
function updateHover() {
  hovered = null;
  if (crumple || shred || journal.open || desk.k > 0) return;
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  if (held) {
    // with a flat sheet in your hand, the shredder is something you can use it on
    if (held.kind !== 'sheet' || held.t < 1) return;
    raycaster.far = TUNE.useReach;
    if (raycaster.intersectObject(room.shredder, true)[0]) hovered = { kind: 'shredder', obj: room.shredder };
    else if (raycaster.intersectObject(room.corkboard, false)[0]) hovered = { kind: 'corkboard', obj: room.corkboard };
    return;
  }
  lookables.length = 0;
  for (const p of paper) lookables.push(p.mesh);
  for (const d of room.dispensers) lookables.push(d);
  raycaster.far = TUNE.reach;
  const hit = raycaster.intersectObjects(lookables, true)[0];
  if (hit) hovered = ownerOf(hit.object);
  if (hovered) return;
  if (brain.state.calendarDay < CALENDAR.days) {
    raycaster.far = TUNE.useReach;
    if (raycaster.intersectObject(room.calendar, false)[0]) { hovered = { kind: 'calendar', obj: room.calendar }; return; }
  }
  raycaster.far = TUNE.useReach;
  if (raycaster.intersectObject(room.computer, true)[0]) hovered = { kind: 'computer', obj: room.computer };
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
let lastWholeSec = -1;
function updateClock(dt) {
  brain.state.clockSec += dt;
  const s = Math.floor(brain.state.clockSec);
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
  if (shred) updateShred(dt);
  if (printJob) updatePrint(dt);
  pc.update(dt);
  checkBaskets();
  updateHover();
  updateGlow();
  updateClock(dt);
  // hold the button on the calendar to keep crossing days off
  crossTimer -= dt;
  if (mouseHeld && crossTimer <= 0 && hovered && hovered.kind === 'calendar') crossNextDay();
  calendarFocus = hovered && hovered.kind === 'calendar' && calendarFocus > 0 ? 2.5 : Math.max(0, calendarFocus - dt);
  // color creeps in, very slowly, as cognition rises
  const sat = grayPass.uniforms.saturation;
  sat.value += (colorTarget() - sat.value) * Math.min(1, dt * TUNE.colorEase);
  saveTimer += dt;
  if (saveTimer > 10) saveNow();
}
let saveTimer = 0;
function saveNow() { saveTimer = 0; if (!erased) brain.save(); }
window.addEventListener('beforeunload', saveNow);
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) step(dt);

  const fovTarget = calendarFocus > 0 ? TUNE.fovCalendar : TUNE.fov;
  if (Math.abs(camera.fov - fovTarget) > 0.01) { camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); }
  grayPass.uniforms.time.value = (now / 1000) % 100;
  room.detectorLed.emissiveIntensity = (now % 4000) < 140 ? 3 : 0;
  ui.cross.classList.toggle('hot', !!hovered);
  ui.cross.style.opacity = desk.k > 0 ? 0 : 1;
  deskHint.style.opacity = desk.at ? 1 : 0;
  popup.classList.toggle('high', desk.k > 0);   // at the computer, notes appear above the screen instead of over it
  composer.render();

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) {
    fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
    if (ui.debug.style.display === 'block') {
      const sv = grayPass.uniforms.saturation.value;
      if (document.activeElement !== ui.sat) { ui.sat.value = sv; ui.satVal.textContent = Math.round(sv * 100) + '%'; }
      ui.dbgInfo.textContent = `${fps} fps · ${paper.length} paper · cognition ${Math.round(brain.cognition() * 100)}% (${brain.state.order.length} found) · ${(Math.abs(player.turned) / (Math.PI * 2)).toFixed(1)} turns${fallbackLook ? ' · arrow-look' : ''}`;
    }
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
  setColor(v) { colorBase = v - brain.cognition() * TUNE.colorFromCognition; grayPass.uniforms.saturation.value = v; ui.sat.value = v; },
  fps: () => fps,
  brain, journal, loadedSave, pc, desk,
  sit: () => enterDesk(), leave: () => leaveDesk(),
  done: () => brain.state.order.slice(),
  color: () => grayPass.uniforms.saturation.value,
  hold(on) { mouseHeld = on; },
  key(code, on) { on ? keys.add(code) : keys.delete(code); },
};
