// Office Paradox — Stage 2 "The Brain": you sit in the chair and spin to look around. The only things you can
// pick up are pieces of paper. The game quietly notices what you do with them (and with the chair, the shredder
// and the calendar), writes it in your journal, and lets a little color back in.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildRoom, ROOM } from './room.js';
import { GrayFilterShader } from './grayFilter.js';
import * as Audio from './audio.js';
import { createBrain, TASKS } from './brain.js';
import { HINT_ORDER } from './doodles.js';
import { createJournal } from './journal.js';
import { createComputer } from './computer.js';
import { createDream } from './dream.js';
import { crossDay, resetCalendar, CALENDAR } from './textures.js';

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
  // Stage 5
  dayRate: 60,              // game seconds per real second: 9:00 to 5:00 takes 8 real minutes
  hintAfter: 240,           // seconds without a new discovery before a hint doodle appears in the journal
  // Stage 4
  foldHold: 0.25,           // hold the button this long on a flat sheet and you start folding instead of crumpling
  foldTime: 1.15,           // seconds to fold a paper airplane (keep holding)
  planeSpeed: 1.45,          // m/s when it leaves your hand (slow and floaty: the cubicle is small)
  planeSteer: 0.0021,       // how much the mouse steers it
  planeMinFlight: 0.4,      // seconds in the air before it counts as a real flight
  drumStep: 0.27,           // seconds per step of the drum pattern
  drumLead: 1.5,            // seconds a note takes to fall to the ring
  drumWindow: 0.15,         // how close to the beat a hit has to be (seconds)
  drumStreak: 16,           // clean hits in a row that count as "you can drum"
  chairSlack: 0.95,         // radians you can look to either side before the chair swivels to follow
  napDelay: 2.2,            // seconds reclined before your eyes start to close
  dreamTime: 13,            // seconds the dream lasts
  replayTime: 2.2,          // seconds of footage in a replay
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
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
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
    if (task.replay !== false) replayQueue = { wait: 0.55, age: 0 };
    stall = 0;
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
const planeTilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0.3, 0));

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
  if (replay || dreaming || dayEnd) return;
  if (drums.on) {
    if (e.repeat) return;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') drumHit(0);
    if (e.code === 'KeyD' || e.code === 'ArrowRight') drumHit(1);
    if (e.code === 'KeyQ' || e.code === 'KeyE') leaveDrums();
    if (e.code.startsWith('Arrow')) e.preventDefault();
    return;
  }
  if (recline.on || flight) return;
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
  if (flight) {
    // in the air, the mouse steers the plane
    if (!flight.ending) {
      const sx = THREE.MathUtils.clamp(e.movementX || 0, -120, 120), sy = THREE.MathUtils.clamp(e.movementY || 0, -120, 120);
      flight.yaw -= sx * TUNE.planeSteer; flight.pitch -= sy * TUNE.planeSteer * 0.7; flight.turn -= sx * 0.012;
    }
    return;
  }
  if (busy()) return;
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
  if (dayEnd) { if (dayEnd.card) dayEnd.go = true; return; }
  if (replay || dreaming || flight) return;
  if (desk.at) { if (e.button === 0) pc.click(); else if (e.button === 2) leaveDesk(); return; }
  if (drums.on) { drumHit(e.button === 2 ? 1 : 0); return; }
  if (recline.on) { sitUp(); return; }
  if (e.button === 0) { mouseHeld = true; click(); }
  else if (e.button === 2) putDown();
});
window.addEventListener('mouseup', (e) => { if (e.button === 0) { mouseHeld = false; releasePress(); } });

// One button does everything: empty hand → pick up paper. Flat sheet in hand → crumple it. Ball in hand → toss it.
// (A flat sheet goes into the shredder instead, if that's what you're looking at.)
function click() {
  if (crumple || fold) return;
  if (!held) { if (hovered) useHovered(); return; }
  if (held.t < 1) return;
  if (held.kind === 'sheet') {
    if (hovered && hovered.kind === 'shredder') startShred();
    else if (hovered && hovered.kind === 'corkboard') pinHeld();
    else press = { t: 0 };          // a quick click crumples it (on release); holding folds it into a plane
  }
  else if (held.kind === 'plane') launchPlane();
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
  if (kind === 'plane') handQuat.multiply(planeTilt);
}

// ---------- Picking paper up ----------
function useHovered() {
  if (!hovered) return;
  if (hovered.kind === 'prop') { Audio.impact('paper', 0.6); grab(hovered.prop); }
  else if (hovered.kind === 'calendar') crossNextDay();
  else if (hovered.kind === 'computer') enterDesk();
  else if (hovered.kind === 'pencils') enterDrums();
  else if (hovered.kind === 'lever') startRecline();
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
    prop: p, kind: p.name === 'paperBall' ? 'ball' : p.name === 'plane' ? 'plane' : 'sheet', t: 0,
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
  if (crumple || fold || !held || held.t < 1) return;
  press = null;
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

// =====================================================================================================
// Stage 4 "Not Flat": the paper airplane, pencil drums, the nap, and the security-camera replay.
// =====================================================================================================
const moveToward = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
// true while something other than plain sitting-and-looking has the view
const busy = () => desk.k > 0 || recline.on || !!flight || drums.on || drums.k > 0 || !!replay || !!dreaming || !!dayEnd;
function forgetPaper(p) {
  const i = paper.indexOf(p); if (i >= 0) paper.splice(i, 1);
  if (highlighted === p.mesh) highlighted = null;
  room.removeProp(p);
}

// ---------- Folding a paper airplane: hold the button down on a flat sheet (a quick click still crumples) ----------
let press = null, fold = null;
function releasePress() {
  if (!press) return;
  press = null;
  if (fold) cancelFold();
  else if (held && held.kind === 'sheet' && held.t >= 1) startCrumple();
}
function startFold() {
  const sheet = held.prop;
  const c = room.makeCrumple(sheet.kind);
  c.mesh.position.copy(sheet.mesh.position); c.mesh.quaternion.copy(sheet.mesh.quaternion);
  scene.add(c.mesh);
  fold = { mesh: c.mesh, kind: sheet.kind, t: 0, next: 0 };
  held = null;
  forgetPaper(sheet);
}
function cancelFold() {
  // let go too soon: it's still just a sheet
  scene.remove(fold.mesh);
  updateHand('sheet');
  const sheet = room.makeSheet(fold.kind, handPos.x, handPos.y, handPos.z);
  fold = null;
  trackPaper(sheet); grab(sheet); held.t = 1;
}
function updateFold(dt) {
  const f = fold;
  f.t = Math.min(1, f.t + dt / TUNE.foldTime);
  updateHand('sheet');
  const e = easeInOut(f.t);
  f.mesh.position.copy(handPos); f.mesh.quaternion.copy(handQuat);
  // in half the long way, then the wings come down
  f.mesh.scale.set(1 - 0.62 * Math.min(1, e * 1.6), 1, 1 - 0.2 * Math.max(0, e * 2 - 1));
  if (f.t >= f.next) { Audio.impact('paper', 0.4 + Math.random() * 0.4); f.next += 0.27; }
  if (f.t >= 1) {
    scene.remove(f.mesh);
    updateHand('plane');
    const plane = room.addPlane(handPos.x, handPos.y, handPos.z);
    fold = null; press = null;
    trackPaper(plane); grab(plane); held.t = 1;
  }
}

// ---------- Flying it: the view rides along behind the plane, and the mouse steers gently ----------
let flight = null;
const flightDir = new THREE.Vector3(), chasePos = new THREE.Vector3(), chaseQuat = new THREE.Quaternion();
const flightEuler = new THREE.Euler(0, 0, 0, 'YXZ');
function isShown(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
function launchPlane() {
  updateHand('plane');
  const p = held.prop; held = null;
  flight = { prop: p, pos: handPos.clone(), yaw: player.yaw, pitch: THREE.MathUtils.clamp(player.pitch + 0.1, -0.5, 0.6), speed: TUNE.planeSpeed, t: 0, k: 0, ending: false, bank: 0, turn: 0 };
  Audio.whoosh(0.3);
}
function updateFlight(dt) {
  const f = flight, clamp = THREE.MathUtils.clamp;
  if (!f.ending) {
    f.t += dt;
    f.speed = clamp(f.speed + (-Math.sin(f.pitch) * 2.0 - 0.07) * dt, 0.5, 3.6);   // dive to speed up, climb and it slows
    if (f.speed < 0.85) f.pitch -= (0.85 - f.speed) * 2 * dt;                        // too slow: the nose drops
    f.pitch = clamp(f.pitch, -1.1, 0.75);
    flightDir.set(-Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), -Math.cos(f.yaw) * Math.cos(f.pitch));
    const stepLen = f.speed * dt;
    raycaster.set(f.pos, flightDir); raycaster.far = stepLen + 0.16;
    const hit = raycaster.intersectObjects(scene.children, true).find((h) => h.object !== f.prop.mesh && !h.object.isPoints && isShown(h.object));
    if (hit) { f.pos.addScaledVector(flightDir, Math.max(0, hit.distance - 0.15)); endFlight(false); }
    else {
      f.pos.addScaledVector(flightDir, stepLen); f.pos.y -= 0.08 * dt;
      if (Math.abs(f.pos.x) > ROOM.half + 0.06 || Math.abs(f.pos.z) > ROOM.half + 0.06) endFlight(true);   // over the wall, and gone
      else if (f.t > 14) endFlight(false);
    }
    f.bank += (clamp(f.turn, -0.7, 0.7) - f.bank) * Math.min(1, dt * 6);
    f.turn *= Math.exp(-6 * dt);
    flightEuler.set(f.pitch, f.yaw, f.bank);
    const m = f.prop.mesh;
    m.position.copy(f.pos); m.quaternion.setFromEuler(flightEuler);
    f.prop.body.position.copy(m.position); f.prop.body.quaternion.copy(m.quaternion);
    chasePos.copy(f.pos).addScaledVector(flightDir, -0.34); chasePos.y += 0.08;
    const lim = ROOM.half - 0.08;
    chasePos.set(clamp(chasePos.x, -lim, lim), clamp(chasePos.y, 0.12, ROOM.ceilingY - 0.1), clamp(chasePos.z, -lim, lim));
    flightEuler.set(f.pitch - 0.12, f.yaw, f.bank * 0.4);
    chaseQuat.setFromEuler(flightEuler);
  }
  f.k = clamp(f.k + (f.ending ? -dt / 0.7 : dt / 0.3), 0, 1);
  if (f.ending && f.k <= 0) flight = null;
}
function endFlight(overWall) {
  const f = flight, p = f.prop, b = p.body;
  f.ending = true;
  if (overWall) { forgetPaper(p); brain.state.planeOver = (brain.state.planeOver || 0) + 1; }
  else {
    b.type = CANNON.Body.DYNAMIC; b.mass = p.mass; b.updateMassProperties();
    b.collisionFilterMask = GROUP.WORLD | GROUP.PROP;
    b.position.copy(p.mesh.position); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
    b.quaternion.copy(p.mesh.quaternion); b.previousQuaternion.copy(b.quaternion); b.interpolatedQuaternion.copy(b.quaternion);
    b.velocity.set(flightDir.x * 0.3, 0, flightDir.z * 0.3); b.angularVelocity.set(0, 0, 0);
    b.wakeUp();
    Audio.impact('paper', 1.5);
  }
  if (f.t >= TUNE.planeMinFlight) brain.complete('paperPlane');
}
function applyFlightCamera() {
  if (!flight || flight.k <= 0) return;
  const e = easeInOut(flight.k);
  camera.position.lerp(chasePos, e); camera.quaternion.slerp(chaseQuat, e);
  camera.updateMatrixWorld();
}

// ---------- Pencil drums: click the pencil cup. Left stick is the coffee mug, right stick is the desk. ----------
const DRUM_PATTERN = 'R.R.L.R.R.RRL.R.R.R.L.RLRLR.LLR.';
const drums = { on: false, k: 0, t: 0, notes: [], streak: 0, best: 0, nextStep: 0, swing: [0, 0], flash: [0, 0] };
const drumSpot = new THREE.Vector3(-0.68, ROOM.deskTop, -0.74);
const drumCam = new THREE.PerspectiveCamera(); drumCam.position.set(-0.45, 1.13, -0.36); drumCam.lookAt(drumSpot);
const sticks = new THREE.Group(); sticks.visible = false; scene.add(sticks);
const stickMeshes = [-1, 1].map((side) => {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.17, 6), new THREE.MeshStandardMaterial({ color: '#e8b923', roughness: 0.6 }));
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0047, 0.0047, 0.016, 8), new THREE.MeshStandardMaterial({ color: '#d98c8c' }));
  shaft.position.y = 0.085; tip.position.y = 0.176;       // eraser end forward: that's the end you drum with
  g.add(shaft, tip);
  g.position.set(side * 0.1, -0.1, -0.2);
  g.userData.side = side;
  sticks.add(g);
  return g;
});
const drumHud = document.getElementById('drumHud'), drumG = drumHud.getContext('2d');
const cupPencils = props.filter((p) => p.name === 'pencil');
function enterDrums() {
  if (held || crumple || drums.on) return;
  Object.assign(drums, { on: true, t: 0, notes: [], streak: 0, best: 0, nextStep: 0 });
  player.spin = 0; keys.clear();
  cupPencils.forEach((p) => { p.mesh.visible = false; });
  sticks.visible = true;
  Audio.impact('pencil', 2);
}
function leaveDrums() {
  if (!drums.on) return;
  drums.on = false;
  cupPencils.forEach((p) => { p.mesh.visible = true; });
  if (brain.state.day >= 2 && drums.best >= 8) knockTimer = 1.7;      // from Day 2 on, something answers
  // you end up looking at the spot you were drumming on
  player.yaw = Math.atan2(-(drumSpot.x - TUNE.seat.x), -(drumSpot.z - TUNE.seat.z)); lastYaw = player.yaw;
  player.pitch = -0.5;
}
function drumHit(lane) {
  if (!drums.on) return;
  drums.swing[lane] = 1;
  let best = null;
  for (const n of drums.notes) {
    if (n.lane !== lane || n.hit || n.missed) continue;
    const d = Math.abs(n.time - drums.t);
    if (d < TUNE.drumWindow && (!best || d < Math.abs(best.time - drums.t))) best = n;
  }
  if (best) {
    best.hit = true; drums.streak++; drums.best = Math.max(drums.best, drums.streak); drums.flash[lane] = 1;
    if (drums.streak >= TUNE.drumStreak) brain.complete('drums');
  } else drums.streak = 0;
  Audio.drum(lane, !!best);
}
function updateDrums(dt) {
  const d = drums;
  d.k = THREE.MathUtils.clamp(d.k + (d.on ? 1 : -1) * dt / 0.6, 0, 1);
  if (d.k <= 0) { sticks.visible = false; drumHud.style.opacity = 0; return; }
  if (d.on) {
    d.t += dt;
    while (d.nextStep * TUNE.drumStep < d.t + TUNE.drumLead) {
      const ch = DRUM_PATTERN[d.nextStep % DRUM_PATTERN.length];
      if (ch !== '.') d.notes.push({ lane: ch === 'L' ? 0 : 1, time: 2 + d.nextStep * TUNE.drumStep });
      d.nextStep++;
    }
    for (const n of d.notes) if (!n.hit && !n.missed && n.time < d.t - TUNE.drumWindow) { n.missed = true; d.streak = 0; }
    d.notes = d.notes.filter((n) => n.time > d.t - 0.6);
  }
  // the two pencils, held in front of you; a hit flicks the tip down
  sticks.position.copy(camera.position); sticks.quaternion.copy(camera.quaternion);
  stickMeshes.forEach((g, i) => {
    d.swing[i] *= Math.exp(-13 * dt); d.flash[i] *= Math.exp(-7 * dt);
    g.rotation.set(-1.25 - d.swing[i] * 0.42, 0, -g.userData.side * 0.28);
  });
  // the notes: two columns falling to two rings
  drumHud.style.opacity = d.on ? 1 : 0;
  const W = drumHud.width, H = drumHud.height, lineY = H - 34;
  drumG.clearRect(0, 0, W, H);
  [W / 2 - 46, W / 2 + 46].forEach((x, lane) => {
    drumG.strokeStyle = `rgba(240,238,230,${0.55 + d.flash[lane] * 0.45})`; drumG.lineWidth = 2 + d.flash[lane] * 3;
    drumG.beginPath(); drumG.arc(x, lineY, 15 + d.flash[lane] * 5, 0, Math.PI * 2); drumG.stroke();
    for (const n of d.notes) {
      if (n.lane !== lane || n.hit) continue;
      const y = lineY - ((n.time - d.t) / TUNE.drumLead) * (lineY - 10);
      if (y < -12 || y > H + 12) continue;
      drumG.fillStyle = n.missed ? 'rgba(240,238,230,0.2)' : 'rgba(240,238,230,0.9)';
      drumG.beginPath(); drumG.arc(x, y, 10, 0, Math.PI * 2); drumG.fill();
    }
  });
}
function applyDrumCamera() {
  if (drums.k <= 0) return;
  const e = easeInOut(drums.k);
  camera.position.lerp(drumCam.position, e); camera.quaternion.slerp(drumCam.quaternion, e);
  camera.updateMatrixWorld();
}

// ---------- The nap: pull the lever on the chair, feet up on the desk, lean back... and drift off ----------
const recline = { on: false, out: false, t: 0, leg: 0, lean: 0, lid: 0, idle: 0, asleep: false, waking: false };
const legs = new THREE.Group(); legs.visible = false; scene.add(legs);
const trouser = new THREE.MeshStandardMaterial({ color: '#3b3f4a', roughness: 0.95 });
const shoeMat = new THREE.MeshStandardMaterial({ color: '#1c1a18', roughness: 0.5 });
const soleMat = new THREE.MeshStandardMaterial({ color: '#6b5a48', roughness: 0.9 });
const legParts = [-1, 1].map((side) => {
  const legGeo = new THREE.BoxGeometry(0.12, 0.11, 1); legGeo.translate(0, 0, 0.5);          // runs along +Z, so lookAt() aims it
  const leg = new THREE.Mesh(legGeo, trouser); leg.castShadow = true;
  const shoe = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.1), shoeMat); upper.position.y = 0.09; upper.castShadow = true;
  const sole = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.26, 0.016), soleMat); sole.position.set(0, 0.08, 0.057);
  const toe = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.05, 0.09), shoeMat); toe.position.set(0, 0.225, -0.004);
  const sock = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.09, 0.1), new THREE.MeshStandardMaterial({ color: '#8a8f9c', roughness: 1 })); sock.position.set(0, -0.01, -0.06);
  shoe.add(upper, sole, toe, sock);
  legs.add(leg, shoe);
  return { side, leg, shoe };
});
const hipV = new THREE.Vector3(), footV = new THREE.Vector3();
const lidTop = document.getElementById('lidTop'), lidBot = document.getElementById('lidBot');
function startRecline() {
  if (held || crumple || recline.on) return;
  Object.assign(recline, { on: true, out: false, t: 0, idle: 0, asleep: false, waking: false });
  player.spin = 0; keys.clear();
  player.yaw = Math.round(player.yaw / (Math.PI * 2)) * Math.PI * 2; lastYaw = player.yaw;     // facing the desk
  Audio.lever();
}
function sitUp() { if (recline.on && !recline.asleep) { recline.out = true; Audio.lever(); } }
// eyelids: they sink, you fight it twice, then they close
function lidCurve(s) {
  const seg = (a, b, from, to) => from + (to - from) * easeInOut(THREE.MathUtils.clamp((s - a) / (b - a), 0, 1));
  if (s < 1.2) return seg(0, 1.2, 0, 0.62);
  if (s < 1.7) return seg(1.2, 1.7, 0.62, 0.25);
  if (s < 3.1) return seg(1.7, 3.1, 0.25, 0.86);
  if (s < 3.6) return seg(3.1, 3.6, 0.86, 0.5);
  return seg(3.6, 5.2, 0.5, 1);
}
function updateRecline(dt) {
  const r = recline;
  if (!r.on && r.leg <= 0 && r.lean <= 0) { legs.visible = false; r.lid = moveToward(r.lid, 0, dt * 3); return; }
  r.t += dt;
  const up_ = r.on && !r.out;
  r.leg = moveToward(r.leg, up_ ? 1 : 0, dt / (up_ ? 0.8 : 0.6));
  r.lean = moveToward(r.lean, up_ && r.t > 0.7 ? 1 : 0, dt / (up_ ? 1.2 : 0.7));
  if (r.out && r.leg <= 0 && r.lean <= 0) { r.on = false; r.out = false; player.pitch = -0.12; }
  // stay like that for more than a moment and your eyes start to close
  if (r.waking) {
    r.lid = moveToward(r.lid, 0, dt * 0.45);
    if (r.lid <= 0) { r.waking = false; r.asleep = false; r.idle = 0; r.out = true; }
  } else if (!r.asleep) {
    r.idle = up_ && r.lean >= 1 ? r.idle + dt : 0;
    const s = r.idle - TUNE.napDelay;
    r.lid = moveToward(r.lid, s > 0 ? lidCurve(s) : 0, dt * 2.5);
    if (s >= 5.3) startDream();
  }
  // legs: out from under the desk, around its edge, and up onto it
  const ke = easeInOut(r.leg);
  legs.visible = r.leg > 0.01 && !replay;
  for (const p of legParts) {
    hipV.set(TUNE.seat.x + p.side * 0.09, 0.56, TUNE.seat.z - 0.2 + 0.2 * easeInOut(r.lean));
    footV.set(TUNE.seat.x + p.side * (0.1 - 0.015 * ke), 0.07 + (ROOM.deskTop - 0.01) * ke, TUNE.seat.z - 0.42 - 0.1 * ke + 0.3 * Math.sin(Math.PI * ke));
    p.leg.position.copy(hipV); p.leg.lookAt(footV); p.leg.scale.z = hipV.distanceTo(footV);
    p.shoe.position.copy(footV); p.shoe.quaternion.copy(p.leg.quaternion);
  }
}
function applyReclineCamera() {
  const r = recline;
  if (r.leg <= 0 && r.lean <= 0) return;
  const ke = easeInOut(r.leg), le = easeInOut(r.lean);
  // watch your feet go up, then tip back and look at the ceiling
  let pitch = player.pitch + (-0.36 - player.pitch) * ke;
  pitch += (0.44 - pitch) * le;
  pitch += Math.sin(performance.now() / 1000 * 1.1) * 0.012 * le;        // breathing
  camera.position.set(TUNE.seat.x, TUNE.eyeSeated - 0.17 * le, TUNE.seat.z - 0.07 + 0.32 * le);
  camera.rotation.set(pitch, player.yaw, 0);
  camera.updateMatrixWorld();
}

// ---------- The dream ----------
const dream = createDream();
let dreaming = null;
function startDream() {
  recline.asleep = true; recline.lid = 1;
  dreaming = { t: 0 };
  renderPass.scene = dream.scene; renderPass.camera = dream.camera;
  Audio.dream(TUNE.dreamTime + 1);
}
function updateDream(dt) {
  const d = dreaming;
  d.t += dt;
  dream.update(d.t, TUNE.dreamTime);
  // your eyes open onto the dream, and close on it again at the end
  const openT = 1.8, closeT = TUNE.dreamTime - 1.6;
  recline.lid = d.t < openT ? 1 - easeInOut(d.t / openT) : d.t > closeT ? easeInOut(Math.min(1, (d.t - closeT) / 1.6)) : 0;
  grayPass.uniforms.saturation.value = 1;                                  // the dream is in full color
  if (d.t >= TUNE.dreamTime) {
    renderPass.scene = scene; renderPass.camera = camera;
    dreaming = null;
    grayPass.uniforms.saturation.value = colorTarget();
    // you slept through the afternoon
    const st = brain.state, day = Math.floor(st.clockSec / 86400) * 86400;
    if (st.clockSec - day < 17 * 3600) st.clockSec = day + 17 * 3600;
    lastWholeSec = -1;
    recline.lid = 1; recline.waking = true;
    tape.length = 0;
    brain.complete('nap');
  }
}

// ---------- The replay cam: when the world notes something, you see the last two seconds again ----------
// ...from high up, in grainy black and white, with a timestamp. Like footage. (It is.)
const tape = [];
let replay = null, replayQueue = null;
const cctvCam = new THREE.PerspectiveCamera(98, window.innerWidth / window.innerHeight, 0.05, 30);
cctvCam.position.set(room.detector.position.x, ROOM.ceilingY - 0.09, room.detector.position.z);
cctvCam.lookAt(-0.3, 0.55, 0.4);
const cctvHud = document.getElementById('cctv'), cctvTime = document.getElementById('cctvTime');
// a stand-in for you, only ever seen on the footage
const figure = new THREE.Group(); figure.visible = false; scene.add(figure);
{
  const shirt = new THREE.MeshStandardMaterial({ color: '#d8d6cf', roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: '#b9a48e', roughness: 0.8 });
  const hair = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 1 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.22), shirt); torso.position.set(0, 0.8, 0.05);
  const lap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.44), trouser); lap.position.set(0, 0.58, -0.16);
  const shins = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.12), trouser); shins.position.set(0, 0.3, -0.36);
  const head = new THREE.Group(); head.position.set(0, 1.17, 0.02);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), skin); skull.scale.set(0.9, 1.1, 1);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); cap.position.set(0, 0.015, 0.015); cap.scale.set(0.92, 1.1, 1.02);
  head.add(skull, cap);
  const arms = [-1, 1].map((s) => { const a = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.42), shirt); a.position.set(s * 0.22, 0.78, -0.14); a.rotation.x = 0.35; return a; });
  figure.add(torso, lap, shins, head, ...arms);
  figure.userData.head = head;
  figure.traverse((o) => { if (o.isMesh) o.castShadow = true; });
}
function recordFrame(dt) {
  const items = [];
  const add = (m) => { if (m) items.push([m, m.position.x, m.position.y, m.position.z, m.quaternion.x, m.quaternion.y, m.quaternion.z, m.quaternion.w]); };
  for (const p of paper) add(p.mesh);
  if (printJob) add(printJob.prop.mesh);
  if (crumple) add(crumple.mesh);
  if (shred) add(shred.mesh);
  if (fold) add(fold.mesh);
  tape.push({ dt, yaw: player.yaw, pitch: player.pitch, chair: chair.rotation.y, clock: brain.state.clockSec, items });
  let total = 0;
  for (let i = tape.length - 1; i >= 0; i--) { total += tape[i].dt; if (total > TUNE.replayTime) { tape.splice(0, i); break; } }
}
function startReplay() {
  replayQueue = null;
  if (tape.reduce((s, f) => s + f.dt, 0) < 0.6) return;
  const saved = new Map();
  const keep = (m) => { if (!saved.has(m)) saved.set(m, { parent: m.parent, visible: m.visible, pos: m.position.clone(), quat: m.quaternion.clone() }); };
  for (const f of tape) for (const it of f.items) keep(it[0]);
  for (const p of paper) keep(p.mesh);
  replay = { frames: tape.slice(), i: 0, t: 0, acc: 0, saved, chairYaw: chair.rotation.y };
  renderPass.camera = cctvCam;
  cctvCam.aspect = window.innerWidth / window.innerHeight; cctvCam.updateProjectionMatrix();
  grayPass.uniforms.cctv.value = 1;
  cctvHud.style.display = 'block';
  figure.visible = true; legs.visible = false; sticks.visible = false;
  if (highlighted) { setGlow(highlighted, false); highlighted = null; }
}
function updateReplay(dt) {
  const r = replay;
  r.t += dt; r.acc += dt;
  while (r.i < r.frames.length - 1 && r.acc >= r.frames[r.i].dt) { r.acc -= r.frames[r.i].dt; r.i++; }
  const f = r.frames[r.i];
  for (const m of r.saved.keys()) m.visible = false;
  for (const [m, px, py, pz, qx, qy, qz, qw] of f.items) {
    if (!m.parent) scene.add(m);
    m.visible = true; m.position.set(px, py, pz); m.quaternion.set(qx, qy, qz, qw);
  }
  chair.rotation.y = f.chair;
  figure.position.copy(chair.position); figure.rotation.y = f.chair;
  figure.userData.head.rotation.set(f.pitch, f.yaw - f.chair, 0, 'YXZ');
  const s = Math.floor(f.clock), hh = Math.floor(s / 3600) % 24, mm = Math.floor(s / 60) % 60, ss = s % 60;
  cctvTime.textContent = `DAY ${String(brain.state.day).padStart(2, '0')}  ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  if (r.i >= r.frames.length - 1 && r.t > TUNE.replayTime + 0.25) endReplay();
}
function endReplay() {
  const r = replay;
  for (const [m, s] of r.saved) {
    if (!s.parent) scene.remove(m); else if (m.parent !== s.parent) s.parent.add(m);
    m.visible = s.visible; m.position.copy(s.pos); m.quaternion.copy(s.quat);
  }
  chair.rotation.y = r.chairYaw;
  figure.visible = false;
  renderPass.camera = camera;
  grayPass.uniforms.cctv.value = 0;
  cctvHud.style.display = 'none';
  replay = null; tape.length = 0;
}

// =====================================================================================================
// Stage 5 "Days & Mystery": the workday ends at 5:00, things change overnight, hint doodles turn up
// when you're stuck, and the prototype ends with a glimpse from outside your own head.
// =====================================================================================================
const fadeEl = document.getElementById('fade'), fadeText = document.getElementById('fadeText'), endingEl = document.getElementById('ending');
let dayEnd = null;         // the end-of-day sequence in progress
let stall = 0;             // seconds since you last discovered something
let knockTimer = 0;
room.plant.visible = brain.state.day >= 3;

// what the night shift does while you're gone
function applyOvernight() {
  const st = brain.state;
  st.day++; st.clockSec = 9 * 3600;
  // the calendar you crossed off is back the way it was
  if (st.calendarDay > CALENDAR.crossedAtStart) { resetCalendar(calTex); st.calendarDay = CALENDAR.crossedAtStart; }
  // the airplane you threw over the wall is back on your desk. Refolded. Neater than you made it.
  if (st.planeOver > 0) {
    const plane = room.addPlane(-0.5, ROOM.deskTop + 0.03, -0.63);
    plane.body.quaternion.setFromEuler(0, 0.55, 0); plane.mesh.quaternion.copy(plane.body.quaternion);
    trackPaper(plane);
    st.planeOver = 0;
  }
  // every third day, something new
  room.plant.visible = st.day >= 3;
  stall = 0; tape.length = 0; replayQueue = null;
  brain.save();
}

// ---- the third-person glitch: for half a second the view slips out of your head and behind you
const thirdCam = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 30);
{
  // only ever seen in the glitch: what is actually sitting in the chair
  const stalkMat = new THREE.MeshStandardMaterial({ color: '#8fd98a', roughness: 0.8 });
  const antenna = new THREE.Group(); antenna.visible = false;
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 5), stalkMat); stalk.position.set(0.02, 0.2, 0); stalk.rotation.z = -0.2;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: '#f6ffb0' })); tip.position.set(0.04, 0.3, 0);
  antenna.add(stalk, tip);
  figure.userData.head.add(antenna);
  figure.userData.antenna = antenna;
}
function showThirdPerson(on) {
  figure.visible = on; figure.userData.antenna.visible = on;
  if (on) {
    figure.position.copy(chair.position); figure.rotation.y = chair.rotation.y;
    figure.userData.head.rotation.set(player.pitch, player.yaw - chair.rotation.y, 0, 'YXZ');
    const lim = ROOM.half - 0.12;
    thirdCam.position.set(
      THREE.MathUtils.clamp(TUNE.seat.x + Math.sin(player.yaw) * 0.95, -lim, lim), 1.62,
      THREE.MathUtils.clamp(TUNE.seat.z + Math.cos(player.yaw) * 0.95, -lim, lim));
    thirdCam.lookAt(TUNE.seat.x, 1.15, TUNE.seat.z);
    thirdCam.aspect = window.innerWidth / window.innerHeight; thirdCam.updateProjectionMatrix();
  }
  renderPass.camera = on ? thirdCam : camera;
}

function startDayEnd() {
  const st = brain.state;
  const finale = !st.ended && (st.day >= 3 || st.order.length >= Object.keys(TASKS).length);
  dayEnd = { t: 0, finale, glitchDone: !finale, card: false, go: false, applied: false, fadeFrom: 0 };
  if (highlighted) { setGlow(highlighted, false); highlighted = null; }
  hovered = null;
  if (finale) Audio.glitch();
}
function updateDayEnd(dt) {
  const d = dayEnd, st = brain.state;
  d.t += dt;
  const gl = grayPass.uniforms.glitch;
  if (!d.glitchDone) {
    // tear, out of your head, tear, back in. Then a long second to wonder what that was.
    const t = d.t;
    if (t < 0.15) gl.value = 1;
    else if (t < 0.75) { if (renderPass.camera !== thirdCam) showThirdPerson(true); gl.value = 0.25 + Math.random() * 0.2; }
    else if (t < 0.9) { if (renderPass.camera === thirdCam) showThirdPerson(false); gl.value = 1; }
    else { gl.value = 0; if (t > 2.8) { d.glitchDone = true; d.t = 0; } }
    return;
  }
  gl.value = 0;
  if (!d.applied) {
    // fade to black
    fadeEl.style.opacity = Math.min(1, d.t / 1.6);
    if (d.t >= 1.6) {
      if (d.finale && !d.card) {
        // the title card: the prototype ends here (you can keep playing)
        d.card = true;
        document.getElementById('endingFound').textContent = `You found ${st.order.length} of ${Object.keys(TASKS).length}.`;
        endingEl.style.display = 'block';
      }
      if (!d.finale || d.go) {
        endingEl.style.display = 'none';
        if (d.finale) st.ended = true;
        applyOvernight();
        fadeText.textContent = `DAY ${st.day}`;
        d.applied = true; d.t = 0;
      }
    }
    return;
  }
  // the next morning
  fadeText.style.opacity = d.t < 1.8 ? Math.min(1, d.t / 0.5) : Math.max(0, 1 - (d.t - 1.8) / 0.5);
  fadeEl.style.opacity = d.t < 2.2 ? 1 : Math.max(0, 1 - (d.t - 2.2) / 1.6);
  if (d.t >= 3.8) { fadeEl.style.opacity = 0; fadeText.style.opacity = 0; dayEnd = null; player.pitch = -0.18; }
}

// ---------- Each frame: look, chair, camera ----------
function updatePlayer(dt) {
  const look = 1.9 * dt;   // arrow-key look (fallback)
  if (keys.has('ArrowLeft')) player.yaw += look;
  if (keys.has('ArrowRight')) player.yaw -= look;
  if (keys.has('ArrowUp')) player.pitch = Math.min(1.45, player.pitch + look * 0.8);
  if (keys.has('ArrowDown')) player.pitch = Math.max(-1.5, player.pitch - look * 0.8);

  // A / D push the chair around; it glides to a stop
  if (!journal.open && !busy()) {
    const push = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
    if (push) player.spin = THREE.MathUtils.clamp(player.spin + push * TUNE.spinAccel * dt, -TUNE.spinMax, TUNE.spinMax);
    else player.spin *= Math.exp(-TUNE.spinFriction * dt);
    if (Math.abs(player.spin) < 0.02) player.spin = 0;
    player.yaw += player.spin * dt;
  }
  trackSpin(dt);

  // the chair swivels with you
  // (you can turn your head a fair way before the chair comes with you: that's how you can look at its lever)
  const lag = angleTo(chair.rotation.y, player.yaw), slack = busy() ? 0 : TUNE.chairSlack;
  const turn = (Math.abs(lag) > slack ? lag - Math.sign(lag) * slack : 0) * Math.min(1, dt * 14);
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
  applyReclineCamera();
  updateDeskCamera(dt);
  applyDrumCamera();
  applyFlightCamera();
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
  if (crumple || shred || fold || journal.open || busy()) return;
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
  if (raycaster.intersectObject(room.computer, true)[0]) { hovered = { kind: 'computer', obj: room.computer }; return; }
  // small things you can use: the pencil cup, and the lever on your chair
  camera.getWorldDirection(fwd);
  for (const [obj, kind, cone] of [[room.pencilCup, 'pencils', 0.085], [room.lever, 'lever', 0.13]]) {
    obj.getWorldPosition(tmpV).sub(camera.position);
    const d = tmpV.length();
    if (d < TUNE.useReach && tmpV.normalize().angleTo(fwd) < cone) { hovered = { kind, obj }; return; }
  }
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
let lastWholeSec = -1, realSec = 0;
function updateClock(dt) {
  // the workday runs fast: 9:00 to 5:00 in about eight real minutes. The second hand still ticks once a second.
  brain.state.clockSec += dt * TUNE.dayRate;
  realSec += dt;
  const s = brain.state.clockSec;
  clock.minHand.rotation.z = -((s / 60) % 60 / 60) * Math.PI * 2;
  clock.hourHand.rotation.z = -((s / 3600) % 12 / 12) * Math.PI * 2;
  const whole = Math.floor(realSec);
  if (whole !== lastWholeSec) {
    lastWholeSec = whole;
    clock.secHand.rotation.z = -((whole % 60) / 60) * Math.PI * 2;
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
  if (press && !fold) { press.t += dt; if (press.t > TUNE.foldHold && held && held.kind === 'sheet' && held.t >= 1) startFold(); }
  if (fold) updateFold(dt);
  if (flight) updateFlight(dt);
  updateDrums(dt);
  updateRecline(dt);
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
  recordFrame(dt);
  if (knockTimer > 0) { knockTimer -= dt; if (knockTimer <= 0) Audio.knock(); }
  // stuck for a while? a doodle quietly appears on the back page of the journal
  stall += dt;
  if (stall > TUNE.hintAfter) {
    stall = 0;
    const next = HINT_ORDER.find((id) => !brain.isDone(id) && !brain.state.hints.includes(id));
    if (next) { brain.state.hints.push(next); Audio.scratch(); brain.save(); }
  }
  // five o'clock: the day ends (once you've finished whatever you're in the middle of)
  if (brain.state.clockSec >= 17 * 3600 && !busy() && !held && !crumple && !fold && !shred && !replayQueue && !journal.open) startDayEnd();
  if (replayQueue) {
    replayQueue.age += dt;
    if (replayQueue.age > 5) replayQueue = null;                       // too late to be an "instant" replay
    else if (!busy() && !journal.open && !held && !crumple && !fold) { replayQueue.wait -= dt; if (replayQueue.wait <= 0) startReplay(); }
  }
  saveTimer += dt;
  if (saveTimer > 10) saveNow();
}
let saveTimer = 0;
function saveNow() { saveTimer = 0; if (!erased) brain.save(); }
window.addEventListener('beforeunload', saveNow);
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    if (dayEnd) updateDayEnd(dt);
    else if (replay) updateReplay(dt);
    else if (dreaming) updateDream(dt);
    else step(dt);
  }
  lidTop.style.height = lidBot.style.height = (recline.lid * 51).toFixed(2) + '%';

  const fovTarget = calendarFocus > 0 ? TUNE.fovCalendar : flight && !flight.ending ? 84 : TUNE.fov;
  if (Math.abs(camera.fov - fovTarget) > 0.01) { camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 5); camera.updateProjectionMatrix(); }
  grayPass.uniforms.time.value = (now / 1000) % 100;
  room.detectorLed.emissiveIntensity = (now % 4000) < 140 ? 3 : 0;
  ui.cross.classList.toggle('hot', !!hovered);
  ui.cross.style.opacity = busy() ? 0 : 1;
  const hintText = desk.at ? 'RIGHT-CLICK · LEAN BACK' : drums.on ? 'LEFT / RIGHT CLICK · DRUM      Q · PUT THE PENCILS DOWN' : recline.on && !recline.asleep && !recline.out && recline.lean >= 1 ? 'CLICK · SIT UP' : '';
  if (hintText) deskHint.textContent = hintText;
  deskHint.style.opacity = hintText && !replay ? 1 : 0;
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
  held: () => (crumple ? 'crumpling' : fold ? 'folding' : held ? held.prop.name : null),
  click() { click(); releasePress(); return this.held(); },
  press() { mouseHeld = true; click(); }, release() { mouseHeld = false; releasePress(); },
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
  recline, drums, drumHit, leaveDrums, sitUp,
  flight: () => flight, replay: () => replay, dreaming: () => dreaming, busy,
  dayEnd: () => dayEnd, room, stallBy(sec) { stall += sec; },
  // run whole frames (including replays and the dream), not just the normal game step
  run(sec) { for (let t = 0; t < sec; t += 1 / 60) { if (dayEnd) updateDayEnd(1 / 60); else if (replay) updateReplay(1 / 60); else if (dreaming) updateDream(1 / 60); else step(1 / 60); } },
  done: () => brain.state.order.slice(),
  color: () => grayPass.uniforms.saturation.value,
  hold(on) { mouseHeld = on; },
  key(code, on) { on ? keys.add(code) : keys.delete(code); },
};
