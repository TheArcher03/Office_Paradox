// Office Paradox — Stage 1 "The Box" (feel pass): the cubicle, first-person controls, the chair,
// kneel / crawl, grab / inspect, and the flick throw.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildRoom, ROOM } from './room.js';
import { GrayFilterShader } from './grayFilter.js';
import * as Audio from './audio.js';

// ---------- Tuning knobs (change these to adjust the feel) ----------
const TUNE = {
  lookSensitivity: 0.0022,
  walkSpeed: 1.5, kneelSpeed: 0.75, crawlSpeed: 0.55, // m/s
  rollSpeed: 1.25,          // m/s in the chair
  rollGlide: 2.2,           // lower = chair glides longer after you let go
  chairFriction: 3.0,       // how fast a pushed / abandoned chair rolls to a stop
  eyeStanding: 1.66, eyeKneel: 0.92, eyeCrawl: 0.42, eyeSeated: 1.17,
  reach: 1.8,               // how far away you can grab things
  aimAssist: 0.075,         // radians: how close to the dot something has to be to count as "looked at"
  // Flick throw: hold click, pull the mouse back, release while sliding the mouse up.
  throwMin: 1.2, throwMax: 9.0,   // m/s
  flickMinSpeed: 250,       // px/s of upward mouse motion before it counts as a throw (slower = gentle drop)
  flickFullSpeed: 3200,     // px/s for a full-power flick
  flickWindow: 0.1,         // seconds of mouse motion measured at the moment you let go
  pullFull: 160,            // px of pull-back for a full wind-up
  flickCurve: 0.0012,       // how much sideways mouse motion curves the throw
  fov: 72, fovAim: 66, fovInspect: 48,
  sitTime: 0.55, standTime: 0.45,
  startColor: 0.06,         // 0 = fully gray, 1 = full color
};

// ---------- Renderer, scene, camera ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
const { props, colliders, chair, chairBody, clock, GROUP } = room;

// impact sounds (new props, like sheets pulled off the stack, report here too)
const lastSound = new Map();
room.impact.fn = (p, e) => {
  const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
  if (v < 0.45 || p === held) return;
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

// ---------- Player ----------
const STANCE = { STAND: 0, KNEEL: 1, CRAWL: 2 };
const STANCE_EYE = [TUNE.eyeStanding, TUNE.eyeKneel, TUNE.eyeCrawl];
const STANCE_SPEED = [TUNE.walkSpeed, TUNE.kneelSpeed, TUNE.crawlSpeed];
const player = {
  pos: new THREE.Vector3(-0.25, 0, -0.1),
  vel: new THREE.Vector2(),
  yaw: 0, pitch: -0.18,
  seated: true,
  stance: STANCE.STAND,
  eye: TUNE.eyeSeated,
  bob: 0,
  anim: null,     // sit-down / stand-up animation in progress
  shake: 0,       // head bump
};
chair.position.set(player.pos.x, 0, player.pos.z);
const chairVel = new THREE.Vector2();

// Invisible body for the player, so you bump and push things on the floor (one per stance; only one is active).
function makePlayerBody(hx, hy, hz) {
  const b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, collisionFilterGroup: 0, collisionFilterMask: GROUP.PROP });
  b.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
  b.position.set(0, -10, 0);
  world.addBody(b);
  return b;
}
const playerBodies = [makePlayerBody(0.17, 0.8, 0.17), makePlayerBody(0.2, 0.45, 0.22), makePlayerBody(0.2, 0.18, 0.36)];
const playerBodyY = [0.8, 0.45, 0.19];
let activeBody = -1;

const keys = new Set();
let started = false, paused = true, fallbackLook = false;

// ---------- Interaction state ----------
let held = null;            // the prop in your hand
let hovered = null;         // { kind: 'prop' | 'chair' | 'dispenser', prop? }
let highlighted = null;     // the object currently glowing
let windup = null;          // flick throw in progress: { pull, samples: [{t, dx, dy}] }
let inspecting = false, ignoreNextUp = false;
const inspectQuat = new THREE.Quaternion();
const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
const spawnedSheets = [];

const ui = {
  overlay: document.getElementById('overlay'),
  cross: document.getElementById('crosshair'),
  hint: document.getElementById('hint'),
  debug: document.getElementById('debug'),
  sat: document.getElementById('sat'),
  satVal: document.getElementById('satVal'),
  flick: document.getElementById('flick'),
  flickVal: document.getElementById('flickVal'),
  dbgInfo: document.getElementById('dbgInfo'),
};
ui.sat.value = TUNE.startColor;
ui.satVal.textContent = Math.round(TUNE.startColor * 100) + '%';
ui.sat.addEventListener('input', () => {
  grayPass.uniforms.saturation.value = parseFloat(ui.sat.value);
  ui.satVal.textContent = Math.round(ui.sat.value * 100) + '%';
});
const baseFlickFull = TUNE.flickFullSpeed;
ui.flick.value = 1;
ui.flickVal.textContent = '1.0×';
ui.flick.addEventListener('input', () => {
  const k = parseFloat(ui.flick.value);
  TUNE.flickFullSpeed = baseFlickFull / k;
  ui.flickVal.textContent = k.toFixed(1) + '×';
});

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
function pause() { paused = true; ui.overlay.style.display = 'flex'; windup = null; inspecting = false; }

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
  if (e.code === 'KeyE') toggleSeat();
  if (e.code === 'KeyC') cycleStance();
  if (e.code === 'Space') { e.preventDefault(); setStance(STANCE.STAND); }
  if (e.code === 'KeyF' && held) dropHeld(0);
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

window.addEventListener('mousemove', (e) => {
  if (paused) return;
  const locked = document.pointerLockElement === canvas;
  if (!locked && !fallbackLook) return;
  const dx = e.movementX || 0, dy = e.movementY || 0;
  if (windup) { windupMove(dx, dy, performance.now()); return; }   // the view holds still while you wind up
  if (inspecting && held) { rotateInspect(dx, dy); return; }
  player.yaw -= dx * TUNE.lookSensitivity;
  player.pitch = THREE.MathUtils.clamp(player.pitch - dy * TUNE.lookSensitivity, -1.5, 1.45);
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('contextmenu', (e) => { if (started) e.preventDefault(); });
window.addEventListener('mousedown', (e) => {
  if (paused || e.target !== canvas) return;
  if (e.button === 0) {
    if (held) { windup = { pull: 0, samples: [] }; inspecting = false; }
    else if (hovered) { useHovered(); ignoreNextUp = true; }
  } else if (e.button === 2 && held && !windup) {
    inspecting = true;
  }
});
window.addEventListener('mouseup', (e) => {
  if (paused) return;
  if (e.button === 0) {
    if (ignoreNextUp) { ignoreNextUp = false; windup = null; return; }
    if (windup) releaseWindup(performance.now());
  } else if (e.button === 2) inspecting = false;
});

function rotateInspect(dx, dy) {
  camera.getWorldDirection(fwd); up.copy(camera.up).applyQuaternion(camera.quaternion); right.crossVectors(fwd, up).normalize();
  const qa = new THREE.Quaternion().setFromAxisAngle(up, dx * 0.008);
  const qb = new THREE.Quaternion().setFromAxisAngle(right, dy * 0.008);
  inspectQuat.premultiply(qb).premultiply(qa);
}

// ---------- Using what you're looking at ----------
function useHovered() {
  if (!hovered) return;
  if (hovered.kind === 'prop') grab(hovered.prop);
  else if (hovered.kind === 'chair') { if (!player.seated) toggleSeat(); }
  else if (hovered.kind === 'dispenser') {
    // pull a fresh sheet off the stack, straight into your hand
    let sheet;
    if (spawnedSheets.length < 20) { sheet = room.spawnSheet(holdTarget.x, holdTarget.y, holdTarget.z); spawnedSheets.push(sheet); }
    else { sheet = spawnedSheets.shift(); spawnedSheets.push(sheet); sheet.body.position.set(holdTarget.x, holdTarget.y, holdTarget.z); sheet.body.velocity.set(0, 0, 0); }
    Audio.peel();
    grab(sheet);
  }
}

// ---------- Grab / drop / flick throw ----------
const holdTarget = new THREE.Vector3();
function grab(p) {
  const b = p.body;
  if (p.stuck) {
    // peel it off the monitor / pull it off the wall
    b.type = CANNON.Body.DYNAMIC; b.mass = p.mass; b.updateMassProperties(); p.stuck = false;
    Audio.peel();
  } else Audio.impact(p.sound, 0.6);
  held = p;
  held.grabAge = 0; held.farTime = 0;
  b.wakeUp();
  b.angularDamping = 0.9;
  b.collisionFilterMask = GROUP.WORLD | GROUP.PROP;   // a held object passes through you instead of fighting you
  p.restoreMaskAt = 0;
  inspectQuat.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
}
function dropHeld(speed, dir = null) {
  if (!held) return;
  const b = held.body;
  b.angularDamping = held.angDamp;
  held.restoreMaskAt = performance.now() + 450;     // collide with you again once it's clear
  const pv = new THREE.Vector3(player.vel.x, 0, player.vel.y);
  if (dir) {
    b.velocity.set(dir.x * speed + pv.x, dir.y * speed, dir.z * speed + pv.z);
    b.angularVelocity.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
    Audio.whoosh(speed / TUNE.throwMax);
  } else {
    b.velocity.set(pv.x, Math.min(b.velocity.y, 0), pv.z);
    b.angularVelocity.scale(0.3, b.angularVelocity);
  }
  held = null; inspecting = false; windup = null;
}
function windupMove(dx, dy, now) {
  windup.pull = THREE.MathUtils.clamp(windup.pull + dy, 0, TUNE.pullFull * 2);  // pulling the mouse back (down) winds up
  windup.samples.push({ t: now, dx, dy });
  if (windup.samples.length > 120) windup.samples.splice(0, 40);
}
function releaseWindup(now) {
  const w = windup; windup = null;
  if (!w || !held) return;
  let upward = 0, side = 0;
  for (const s of w.samples) if (now - s.t <= TUNE.flickWindow * 1000) { upward -= s.dy; side += s.dx; }
  flickThrow(upward / TUNE.flickWindow, side, w.pull);
}
// speed: px/s of upward mouse motion at the moment of release. side: px of sideways motion. pull: px of wind-up.
function flickThrow(speed, side, pull) {
  if (!held) return;
  if (speed < TUNE.flickMinSpeed) { dropHeld(0); return; }     // no flick: just let go
  const power = THREE.MathUtils.clamp((speed - TUNE.flickMinSpeed) / (TUNE.flickFullSpeed - TUNE.flickMinSpeed), 0, 1);
  const windupBonus = 0.6 + 0.4 * Math.min(1, pull / TUNE.pullFull);
  const v = TUNE.throwMin + (TUNE.throwMax - TUNE.throwMin) * Math.pow(power, 0.85) * windupBonus;
  camera.getWorldDirection(fwd);
  const dir = fwd.clone();
  dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.clamp(-side * TUNE.flickCurve, -0.3, 0.3));
  dir.y += 0.12; dir.normalize();                               // a natural little arc
  dropHeld(v, dir);
}

// Holding: steer the held object toward your hand every physics step.
world.addEventListener('preStep', () => {
  if (!held) return;
  const b = held.body;
  const dt = world.dt || 1 / 120;
  held.grabAge += dt;
  tmpV.set(holdTarget.x - b.position.x, holdTarget.y - b.position.y, holdTarget.z - b.position.z);
  const dist = tmpV.length();
  // Only let go if it's been stuck far from your hand for a moment (not while it's still on its way up from the floor).
  if (dist > 0.9) { held.farTime += dt; if (held.farTime > 0.35 && held.grabAge > 0.5) { dropHeld(0); return; } }
  else held.farTime = 0;
  tmpV.multiplyScalar(Math.min(1 / dt * 0.35, 18));
  if (tmpV.length() > 10) tmpV.setLength(10);
  b.velocity.set(tmpV.x, tmpV.y, tmpV.z);
  if (inspecting) {
    b.quaternion.set(inspectQuat.x, inspectQuat.y, inspectQuat.z, inspectQuat.w);
    b.angularVelocity.set(0, 0, 0);
  } else {
    b.angularVelocity.scale(0.85, b.angularVelocity);
    inspectQuat.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  }
});

// ---------- Stances: stand / kneel / crawl ----------
function inDeskZone(x, z) {
  return colliders.some((r) => r.desk && x > r.minX - 0.05 && x < r.maxX + 0.05 && z > r.minZ - 0.05 && z < r.maxZ + 0.05);
}
function setStance(s) {
  if (player.seated || player.anim) return;
  if (s < STANCE.CRAWL && player.stance === STANCE.CRAWL && inDeskZone(player.pos.x, player.pos.z)) {
    player.shake = 0.25; Audio.bump();                         // bonk: you're under the desk
    return;
  }
  player.stance = s;
}
function cycleStance() { setStance((player.stance + 1) % 3); }

// ---------- Sit / stand (short animations) ----------
function chairDistance() { return Math.hypot(chair.position.x - player.pos.x, chair.position.z - player.pos.z); }
function canSit() {
  return !player.seated && !player.anim && chairDistance() < 1.0 && !(player.stance === STANCE.CRAWL && inDeskZone(player.pos.x, player.pos.z));
}
function toggleSeat() {
  if (player.anim) return;
  if (player.seated) {
    // stand up: you rise and the chair rolls back behind you
    player.seated = false;
    player.stance = STANCE.STAND;
    const back = new THREE.Vector2(Math.sin(player.yaw), Math.cos(player.yaw));
    chairVel.set(back.x * 1.1, back.y * 1.1);   // rolls back ~35 cm
    player.anim = { kind: 'stand', t: 0, dur: TUNE.standTime, eyeFrom: player.eye, eyeTo: TUNE.eyeStanding };
  } else if (canSit()) {
    if (held && windup) windup = null;
    chairVel.set(0, 0);
    player.anim = {
      kind: 'sit', t: 0, dur: TUNE.sitTime,
      from: player.pos.clone(), to: new THREE.Vector3(chair.position.x, 0, chair.position.z),
      eyeFrom: player.eye, eyeTo: TUNE.eyeSeated,
    };
  }
}

// ---------- Collisions (simple circles vs rectangles on the floor plan) ----------
// radiusFor(rect) returns the radius to use against that rectangle, or null to ignore it
function resolveCircle(pos, wallR, radiusFor) {
  const lim = ROOM.half;
  const inRoom = (x, z) => Math.abs(x) <= lim - wallR + 1e-6 && Math.abs(z) <= lim - wallR + 1e-6;
  const clampRoom = () => {
    pos.x = THREE.MathUtils.clamp(pos.x, -lim + wallR, lim - wallR);
    pos.z = THREE.MathUtils.clamp(pos.z, -lim + wallR, lim - wallR);
  };
  for (let pass = 0; pass < 3; pass++) {
    clampRoom();
    for (const r of colliders) {
      const rad = radiusFor(r);
      if (rad == null) continue;
      const cx = THREE.MathUtils.clamp(pos.x, r.minX, r.maxX);
      const cz = THREE.MathUtils.clamp(pos.z, r.minZ, r.maxZ);
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rad * rad) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * rad; pos.z = cz + (dz / d) * rad;
      } else {
        const opts = [[r.minX - rad, pos.z], [r.maxX + rad, pos.z], [pos.x, r.minZ - rad], [pos.x, r.maxZ + rad]]
          .filter(([x, z]) => inRoom(x, z))
          .sort((a, b) => Math.hypot(a[0] - pos.x, a[1] - pos.z) - Math.hypot(b[0] - pos.x, b[1] - pos.z));
        if (opts.length) { pos.x = opts[0][0]; pos.z = opts[0][1]; }
      }
    }
  }
  clampRoom();
}
function resolvePlayer(pos) {
  if (player.seated) resolveCircle(pos, 0.3, (r) => (r.desk ? 0.14 : 0.3));
  else if (player.stance === STANCE.CRAWL) resolveCircle(pos, 0.22, (r) => (r.desk ? null : 0.22));  // crawl under the desk
  else resolveCircle(pos, 0.22, () => 0.22);
}
// the chair's seat slides a little way under the desk
function resolveChair(pos) { resolveCircle(pos, 0.3, (r) => (r.desk ? 0.08 : 0.3)); }

const angleTo = (from, to) => { let d = (to - from) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const easeInOut = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function updatePlayer(dt) {
  let ix = 0, iz = 0;
  if (keys.has('KeyW')) iz -= 1;
  if (keys.has('KeyS')) iz += 1;
  if (keys.has('KeyA')) ix -= 1;
  if (keys.has('KeyD')) ix += 1;
  const look = 1.9 * dt;   // arrow-key look (fallback)
  if (!windup) {
    if (keys.has('ArrowLeft')) player.yaw += look;
    if (keys.has('ArrowRight')) player.yaw -= look;
    if (keys.has('ArrowUp')) player.pitch = Math.min(1.45, player.pitch + look * 0.8);
    if (keys.has('ArrowDown')) player.pitch = Math.max(-1.5, player.pitch - look * 0.8);
  }
  const anim = player.anim;
  if (anim) { ix = 0; iz = 0; }

  const len = Math.hypot(ix, iz) || 1;
  ix /= len; iz /= len;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const wx = ix * cos + iz * sin, wz = -ix * sin + iz * cos;
  const speed = player.seated ? TUNE.rollSpeed : STANCE_SPEED[player.stance];
  const moving = ix !== 0 || iz !== 0;
  const k = player.seated ? (moving ? 3.2 : TUNE.rollGlide) : (moving ? 10 : 12);
  player.vel.x += (wx * speed - player.vel.x) * Math.min(1, k * dt);
  player.vel.y += (wz * speed - player.vel.y) * Math.min(1, k * dt);

  if (anim && anim.kind === 'sit') {
    anim.t = Math.min(1, anim.t + dt / anim.dur);
    const e = easeInOut(anim.t);
    player.pos.lerpVectors(anim.from, anim.to, e);
    player.eye = anim.eyeFrom + (anim.eyeTo - anim.eyeFrom) * e - Math.sin(anim.t * Math.PI) * 0.06; // a little settle as you drop in
    player.vel.set(0, 0);
    chair.rotation.y += angleTo(chair.rotation.y, player.yaw) * Math.min(1, dt * 9);
    if (anim.t >= 1) { player.anim = null; player.seated = true; player.stance = STANCE.STAND; }
  } else {
    const before = player.pos.clone();
    player.pos.x += player.vel.x * dt;
    player.pos.z += player.vel.y * dt;
    resolvePlayer(player.pos);
    if (dt > 0) { player.vel.x = (player.pos.x - before.x) / dt; player.vel.y = (player.pos.z - before.z) / dt; }
    if (anim && anim.kind === 'stand') {
      anim.t = Math.min(1, anim.t + dt / anim.dur);
      player.eye = anim.eyeFrom + (anim.eyeTo - anim.eyeFrom) * easeOut(anim.t);
      if (anim.t >= 1) player.anim = null;
    } else {
      const eyeTarget = player.seated ? TUNE.eyeSeated : STANCE_EYE[player.stance];
      player.eye += (eyeTarget - player.eye) * Math.min(1, dt * 8);
    }
  }

  // ---- the chair
  if (player.seated) {
    chair.position.set(player.pos.x, 0, player.pos.z);
    chair.rotation.y += angleTo(chair.rotation.y, player.yaw) * Math.min(1, dt * 14);  // swivels with you
    Audio.chairRoll(player.vel.length());
  } else if (!(anim && anim.kind === 'sit')) {
    // free chair: glides to a stop, and you can push it around
    chair.position.x += chairVel.x * dt; chair.position.z += chairVel.y * dt;
    chairVel.multiplyScalar(Math.exp(-TUNE.chairFriction * dt));
    const minD = player.stance === STANCE.CRAWL ? 0.4 : 0.44;
    let dx = chair.position.x - player.pos.x, dz = chair.position.z - player.pos.z;
    let d = Math.hypot(dx, dz);
    if (d < minD && d > 1e-4) {
      const push = minD - d;
      chair.position.x += (dx / d) * push; chair.position.z += (dz / d) * push;
      // only walking into it gives it a shove; just standing next to it doesn't
      const into = Math.max(0, (player.vel.x * dx + player.vel.y * dz) / d);
      chairVel.x += (dx / d) * into * 0.25; chairVel.y += (dz / d) * into * 0.25;
    }
    const cb = chair.position.clone();
    resolveChair(chair.position);
    if (cb.distanceToSquared(chair.position) > 1e-8) chairVel.multiplyScalar(0.4);
    // if the chair is jammed, it stops you instead
    dx = chair.position.x - player.pos.x; dz = chair.position.z - player.pos.z; d = Math.hypot(dx, dz);
    if (d < minD && d > 1e-4) { player.pos.x -= (dx / d) * (minD - d); player.pos.z -= (dz / d) * (minD - d); resolvePlayer(player.pos); }
    Audio.chairRoll(chairVel.length());
  }
  if (dt > 0) chairBody.velocity.set((chair.position.x - chairBody.position.x) / dt, 0, (chair.position.z - chairBody.position.z) / dt);
  chairBody.position.set(chair.position.x, 0, chair.position.z);
  chairBody.quaternion.setFromEuler(0, chair.rotation.y, 0);

  // ---- your invisible body (pushes things on the floor)
  const want = player.seated || (anim && anim.kind === 'sit') ? -1 : player.stance;
  playerBodies.forEach((b, i) => {
    if (i === want) {
      const ty = playerBodyY[i];
      if (activeBody !== i) { b.position.set(player.pos.x, ty, player.pos.z); b.velocity.set(0, 0, 0); b.collisionFilterGroup = GROUP.PLAYER; }
      else if (dt > 0) b.velocity.set((player.pos.x - b.position.x) / dt, 0, (player.pos.z - b.position.z) / dt);
      b.position.set(player.pos.x, ty, player.pos.z);
      b.quaternion.setFromEuler(0, player.yaw, 0);
    } else if (b.collisionFilterGroup !== 0) { b.collisionFilterGroup = 0; b.position.set(0, -10, 0); b.velocity.set(0, 0, 0); }
  });
  activeBody = want;

  // ---- camera: head bob, crawl sway, head bump
  const sp = player.vel.length();
  if (!player.seated && sp > 0.15) player.bob += dt * sp * (player.stance === STANCE.CRAWL ? 9 : 6.5); else player.bob *= 0.9;
  const bobAmp = player.seated ? 0 : [0.016, 0.012, 0.02][player.stance];
  const bobY = Math.sin(player.bob) * bobAmp;
  player.shake = Math.max(0, player.shake - dt);
  const shake = player.shake > 0 ? (Math.random() - 0.5) * player.shake * 0.08 : 0;
  const fwdOff = player.seated ? 0.07 : 0;
  camera.position.set(player.pos.x - Math.sin(player.yaw) * fwdOff, player.eye + bobY + shake, player.pos.z - Math.cos(player.yaw) * fwdOff);
  const roll = !player.seated && player.stance === STANCE.CRAWL ? Math.sin(player.bob * 0.5) * 0.025 : 0;
  camera.rotation.set(player.pitch, player.yaw, roll);
}

// ---------- What you're looking at (+ a soft glow on it) ----------
function ownerOf(o) {
  while (o) {
    if (o.userData.prop) { const p = props.find((q) => q.mesh === o); return p && p !== held ? { kind: 'prop', prop: p } : null; }
    if (o.userData.dispenser) return { kind: 'dispenser', obj: o };
    if (o.userData.chair) return player.seated ? null : { kind: 'chair', obj: o };
    o = o.parent;
  }
  return null;
}
function updateHover() {
  hovered = null;
  if (held || windup) return;
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = TUNE.reach;
  const hits = raycaster.intersectObjects(scene.children, true);
  let blockedAt = TUNE.reach;
  for (const h of hits) {
    if (!h.object.visible) continue;
    const own = ownerOf(h.object);
    if (own) { hovered = own; break; }
    blockedAt = h.distance; break;
  }
  if (hovered) return;
  // aim assist: small things near the dot count, as long as nothing is in front of them
  camera.getWorldDirection(fwd);
  let best = null, bestAngle = Infinity;
  for (const p of props) {
    if (p === held) continue;
    tmpV.set(p.body.position.x - camera.position.x, p.body.position.y - camera.position.y, p.body.position.z - camera.position.z);
    const d = tmpV.length();
    if (d > TUNE.reach || d > blockedAt + 0.12 || d < 0.05) continue;
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
  const target = hovered && hovered.kind === 'prop' ? hovered.prop.mesh : hovered && hovered.kind === 'chair' ? chair : null;
  if (target === highlighted) return;
  if (highlighted) setGlow(highlighted, false);
  if (target) setGlow(target, true);
  highlighted = target;
}

function updateHUD() {
  ui.cross.classList.toggle('hot', !!hovered);
  let hint = '';
  if (!held && (hovered?.kind === 'chair' || canSit())) hint = 'E · sit';
  ui.hint.textContent = hint;
  ui.cross.style.opacity = inspecting ? 0 : 1;
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
const mouseHome = room.mouseProp.body.position.clone();
let last = performance.now(), fpsAcc = 0, fpsN = 0, fps = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    updatePlayer(dt);
    camera.updateMatrixWorld();
    camera.getWorldDirection(fwd);
    up.copy(camera.up).applyQuaternion(camera.quaternion);
    right.crossVectors(fwd, up).normalize();
    if (inspecting) holdTarget.copy(camera.position).addScaledVector(fwd, 0.3);
    else {
      const pf = windup ? Math.min(1, windup.pull / TUNE.pullFull) : 0;   // pulled back = hand drops back toward you
      holdTarget.copy(camera.position)
        .addScaledVector(fwd, 0.5 - 0.24 * pf)
        .addScaledVector(up, -0.12 - 0.16 * pf)
        .addScaledVector(right, 0.12 + 0.04 * pf);
      if (held && held.name === 'trashCan') holdTarget.y -= 0.2;
    }
    world.step(1 / 120, dt, 6);
    for (const p of props) if (p.restoreMaskAt && now > p.restoreMaskAt) { p.body.collisionFilterMask = GROUP.WORLD | GROUP.PROP | GROUP.PLAYER; p.restoreMaskAt = 0; }
    if (room.mouseCord.visible && room.mouseProp.body.position.distanceTo(mouseHome) > 0.05) room.mouseCord.visible = false; // unplugged
    updateHover();
    updateGlow();
    updateClock(dt);
  }
  for (const p of props) { p.mesh.position.copy(p.body.position); p.mesh.quaternion.copy(p.body.quaternion); }

  const fovTarget = inspecting ? TUNE.fovInspect : windup && held ? TUNE.fovAim : TUNE.fov;
  camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 7);
  camera.updateProjectionMatrix();
  grayPass.uniforms.inspect.value += ((inspecting ? 1 : 0) - grayPass.uniforms.inspect.value) * Math.min(1, dt * 7);
  grayPass.uniforms.time.value = (now / 1000) % 100;
  room.detectorLed.emissiveIntensity = (now % 4000) < 140 ? 3 : 0;

  updateHUD();
  composer.render();

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) {
    fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
    if (ui.debug.style.display === 'block') ui.dbgInfo.textContent = `${fps} fps · ${player.seated ? 'seated' : ['standing', 'kneeling', 'crawling'][player.stance]} · x ${player.pos.x.toFixed(2)} z ${player.pos.z.toFixed(2)}${fallbackLook ? ' · arrow-look' : ''}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Test hooks (used by automated checks, harmless in play) ----------
window.__op = {
  TUNE, player, props, world, camera, chair,
  start() { started = true; fallbackLook = true; resume(); },
  look(yaw, pitch) { player.yaw = yaw; player.pitch = pitch; },
  stand() { if (player.seated) toggleSeat(); },
  sit() { if (!player.seated) toggleSeat(); },
  stance(s) { setStance(s); return player.stance; },
  setPos(x, z) { player.pos.set(x, 0, z); },
  move(code, ms) { keys.add(code); return new Promise((r) => setTimeout(() => { keys.delete(code); r(); }, ms)); },
  hovered: () => (hovered ? (hovered.kind === 'prop' ? hovered.prop.name : hovered.kind) : null),
  held: () => (held ? held.name : null),
  use() { useHovered(); return held ? held.name : null; },
  grabHovered() { if (hovered && hovered.kind === 'prop') grab(hovered.prop); return !!held; },
  // simulate the flick: pull back `pull` px, then flick up at `speed` px/s with `side` px sideways
  flick(pull, speed, side = 0) { if (!held) return false; flickThrow(speed, side, pull); return true; },
  windupHold(pull) { if (held) windup = { pull, samples: [] }; },
  throwHeld(c) { if (!held) return; this.flick(TUNE.pullFull, TUNE.flickMinSpeed + c * (TUNE.flickFullSpeed - TUNE.flickMinSpeed)); },
  dropAt(name, x, y, z) { const p = props.find((q) => q.name === name); p.body.position.set(x, y, z); p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0); p.body.wakeUp(); },
  trashCan: room.trashCan,
  inDeskZone,
  setColor(v) { grayPass.uniforms.saturation.value = v; ui.sat.value = v; },
  inspect(on) { inspecting = on && !!held; },
};
