// Office Paradox — Stage 1 "The Box": the cubicle, first-person controls, the chair, grab / inspect / throw.
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
  walkSpeed: 1.5,          // m/s standing
  rollSpeed: 1.25,         // m/s in the chair
  rollGlide: 2.2,          // lower = chair glides longer after you let go
  eyeStanding: 1.66,
  eyeSeated: 1.17,
  reach: 1.7,              // how far away you can grab things
  throwMin: 1.6, throwMax: 8.0, chargeTime: 0.9,
  fov: 72, fovAim: 64, fovInspect: 48,
  startColor: 0.06,        // 0 = fully gray, 1 = full color
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
scene.background = new THREE.Color('#111113');
const camera = new THREE.PerspectiveCamera(TUNE.fov, window.innerWidth / window.innerHeight, 0.03, 60);
camera.rotation.order = 'YXZ';

// Lights: flat, overhead office light. There's no ceiling — just a light hanging in the dark, far too high up.
scene.add(new THREE.HemisphereLight('#eef2f6', '#4a4a4a', 1.0));
const sun = new THREE.DirectionalLight('#f4f6ff', 1.7);
sun.position.set(0.4, 6, 0.9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -1.7, right: 1.7, top: 1.7, bottom: -1.7, near: 1, far: 9 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun);
const fill = new THREE.PointLight('#fff8ee', 0.6, 4, 2); fill.position.set(0, 1.9, 0.6); scene.add(fill);
const panelMat = new THREE.MeshBasicMaterial({ color: '#f2f6ff' });
[[-0.5, 0.6], [0.7, 0.6]].forEach(([x, z]) => {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.45), panelMat);
  p.rotation.x = Math.PI / 2; p.position.set(x, 6.2, z); scene.add(p);
});

// ---------- Physics ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.allowSleep = true;
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.45;
world.defaultContactMaterial.restitution = 0.22;

const room = buildRoom(scene, world);
const { props, colliders, chair, chairBody, clock } = room;

// impact sounds
const lastSound = new Map();
props.forEach((p) => {
  p.body.addEventListener('collide', (e) => {
    const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (v < 0.45 || p === held) return;
    const now = performance.now();
    if (now - (lastSound.get(p) || 0) < 70) return;
    lastSound.set(p, now);
    Audio.impact(p.sound, v);
  });
});

// ---------- Post-processing (the gray filter) ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());
const grayPass = new ShaderPass(GrayFilterShader);
grayPass.uniforms.saturation.value = TUNE.startColor;
composer.addPass(grayPass);

// ---------- Player ----------
const player = {
  pos: new THREE.Vector3(-0.32, 0, -0.22),
  vel: new THREE.Vector2(),
  yaw: 0, pitch: -0.18,
  seated: true,
  eye: TUNE.eyeSeated,
  bob: 0,
};
chair.position.set(player.pos.x, 0, player.pos.z);

const keys = new Set();
let started = false, paused = true, fallbackLook = false;

// ---------- Interaction state ----------
let held = null, hovered = null;
let charging = false, chargeStart = 0, ignoreNextUp = false, inspecting = false;
const inspectQuat = new THREE.Quaternion();
const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();

const ui = {
  overlay: document.getElementById('overlay'),
  cross: document.getElementById('crosshair'),
  charge: document.getElementById('charge'),
  chargeCircle: document.querySelector('#charge circle'),
  hint: document.getElementById('hint'),
  debug: document.getElementById('debug'),
  sat: document.getElementById('sat'),
  satVal: document.getElementById('satVal'),
  dbgInfo: document.getElementById('dbgInfo'),
};
ui.sat.value = TUNE.startColor;
ui.satVal.textContent = Math.round(TUNE.startColor * 100) + '%';
ui.sat.addEventListener('input', () => {
  grayPass.uniforms.saturation.value = parseFloat(ui.sat.value);
  ui.satVal.textContent = Math.round(ui.sat.value * 100) + '%';
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
function pause() { paused = true; ui.overlay.style.display = 'flex'; releaseCharge(true); inspecting = false; }

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
  if (e.code === 'KeyE' && !e.repeat) toggleSeat();
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
  if (inspecting && held) {
    camera.getWorldDirection(fwd); up.copy(camera.up).applyQuaternion(camera.quaternion); right.crossVectors(fwd, up).normalize();
    const qa = new THREE.Quaternion().setFromAxisAngle(up, dx * 0.008);
    const qb = new THREE.Quaternion().setFromAxisAngle(right, dy * 0.008);
    inspectQuat.premultiply(qb).premultiply(qa);
    return;
  }
  player.yaw -= dx * TUNE.lookSensitivity;
  player.pitch = THREE.MathUtils.clamp(player.pitch - dy * TUNE.lookSensitivity, -1.45, 1.45);
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('contextmenu', (e) => { if (started) e.preventDefault(); });
window.addEventListener('mousedown', (e) => {
  if (paused || e.target !== canvas) return;
  if (e.button === 0) {
    if (held) { charging = true; chargeStart = performance.now(); }
    else if (hovered) { grab(hovered); ignoreNextUp = true; }
  } else if (e.button === 2 && held) {
    inspecting = true; releaseCharge(true);
  }
});
window.addEventListener('mouseup', (e) => {
  if (paused) return;
  if (e.button === 0) {
    if (ignoreNextUp) { ignoreNextUp = false; return; }
    if (held && charging) releaseCharge(false);
  } else if (e.button === 2) inspecting = false;
});

// ---------- Grab / drop / throw ----------
function grab(p) {
  held = p;
  p.body.wakeUp();
  p.body.angularDamping = 0.9;
  inspectQuat.set(p.body.quaternion.x, p.body.quaternion.y, p.body.quaternion.z, p.body.quaternion.w);
  Audio.impact(p.sound, 0.6);
}
function dropHeld(speed, dir = null) {
  if (!held) return;
  const b = held.body;
  b.angularDamping = held.angDamp;
  const pv = playerVelocity3();
  if (dir) {
    b.velocity.set(dir.x * speed + pv.x, dir.y * speed + pv.y + speed * 0.08, dir.z * speed + pv.z);
    b.angularVelocity.set((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    Audio.whoosh(speed / TUNE.throwMax);
  } else {
    b.velocity.set(pv.x, Math.min(b.velocity.y, 0), pv.z);
    b.angularVelocity.scale(0.3, b.angularVelocity);
  }
  held = null; inspecting = false;
}
function releaseCharge(cancel) {
  if (!charging) return;
  const t = (performance.now() - chargeStart) / 1000;
  charging = false;
  if (cancel || !held) return;
  const c = Math.min(1, t / TUNE.chargeTime);
  if (c < 0.12) { dropHeld(0); return; }
  camera.getWorldDirection(fwd);
  dropHeld(TUNE.throwMin + (TUNE.throwMax - TUNE.throwMin) * c, fwd.clone());
}
function playerVelocity3() { return new THREE.Vector3(player.vel.x, 0, player.vel.y); }

// Holding: steer the held object toward a point in front of the camera every physics step.
const holdTarget = new THREE.Vector3();
world.addEventListener('preStep', () => {
  if (!held) return;
  const b = held.body;
  const dt = world.dt || 1 / 120;
  tmpV.set(holdTarget.x - b.position.x, holdTarget.y - b.position.y, holdTarget.z - b.position.z);
  const dist = tmpV.length();
  if (dist > 0.75) { dropHeld(0); return; }
  tmpV.multiplyScalar(Math.min(1 / dt * 0.35, 18));
  if (tmpV.length() > 9) tmpV.setLength(9);
  b.velocity.set(tmpV.x, tmpV.y, tmpV.z);
  if (inspecting) {
    b.quaternion.set(inspectQuat.x, inspectQuat.y, inspectQuat.z, inspectQuat.w);
    b.angularVelocity.set(0, 0, 0);
  } else {
    b.angularVelocity.scale(0.85, b.angularVelocity);
    inspectQuat.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  }
});

// ---------- Sit / stand ----------
function toggleSeat() {
  if (player.seated) {
    // stand up: the chair rolls back behind you
    player.seated = false;
    const back = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(0.42);
    const target = chair.position.clone().add(back);
    const lim = ROOM.half - 0.3;
    target.x = THREE.MathUtils.clamp(target.x, -lim, lim);
    target.z = THREE.MathUtils.clamp(target.z, -lim, lim);
    chairSlide = { from: chair.position.clone(), to: target, t: 0 };
  } else if (chairDistance() < 0.85) {
    player.seated = true;
    sitSlide = { from: player.pos.clone(), t: 0 };
  }
}
let chairSlide = null, sitSlide = null;
function chairDistance() { return Math.hypot(chair.position.x - player.pos.x, chair.position.z - player.pos.z); }

// ---------- Movement + collisions ----------
function resolveCollisions(pos) {
  const lim = ROOM.half;
  const rWall = player.seated ? 0.3 : 0.22;
  const clampRoom = () => {
    pos.x = THREE.MathUtils.clamp(pos.x, -lim + rWall, lim - rWall);
    pos.z = THREE.MathUtils.clamp(pos.z, -lim + rWall, lim - rWall);
  };
  const inRoom = (x, z) => Math.abs(x) <= lim - rWall + 1e-6 && Math.abs(z) <= lim - rWall + 1e-6;
  const rects = colliders.slice();
  if (!player.seated) rects.push({ minX: chair.position.x - 0.27, maxX: chair.position.x + 0.27, minZ: chair.position.z - 0.27, maxZ: chair.position.z + 0.27 });
  for (let pass = 0; pass < 3; pass++) {
    clampRoom();
    for (const r of rects) {
      const rad = r.desk ? (player.seated ? 0.14 : 0.22) : rWall;
      const cx = THREE.MathUtils.clamp(pos.x, r.minX, r.maxX);
      const cz = THREE.MathUtils.clamp(pos.z, r.minZ, r.maxZ);
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rad * rad) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * rad; pos.z = cz + (dz / d) * rad;
      } else {
        // inside the rectangle: push out the shortest way that stays inside the room
        const opts = [[r.minX - rad, pos.z], [r.maxX + rad, pos.z], [pos.x, r.minZ - rad], [pos.x, r.maxZ + rad]]
          .filter(([x, z]) => inRoom(x, z))
          .sort((a, b) => Math.hypot(a[0] - pos.x, a[1] - pos.z) - Math.hypot(b[0] - pos.x, b[1] - pos.z));
        if (opts.length) { pos.x = opts[0][0]; pos.z = opts[0][1]; }
      }
    }
  }
  clampRoom();
}

function updatePlayer(dt) {
  let ix = 0, iz = 0;
  if (keys.has('KeyW')) iz -= 1;
  if (keys.has('KeyS')) iz += 1;
  if (keys.has('KeyA')) ix -= 1;
  if (keys.has('KeyD')) ix += 1;
  // arrow-key look (fallback)
  const look = 1.9 * dt;
  if (keys.has('ArrowLeft')) player.yaw += look;
  if (keys.has('ArrowRight')) player.yaw -= look;
  if (keys.has('ArrowUp')) player.pitch = Math.min(1.45, player.pitch + look * 0.8);
  if (keys.has('ArrowDown')) player.pitch = Math.max(-1.45, player.pitch - look * 0.8);

  const len = Math.hypot(ix, iz) || 1;
  ix /= len; iz /= len;
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  const wx = ix * cos + iz * sin, wz = -ix * sin + iz * cos;
  const speed = player.seated ? TUNE.rollSpeed : TUNE.walkSpeed;
  const tx = wx * speed, tz = wz * speed;
  const moving = ix !== 0 || iz !== 0;
  const k = player.seated ? (moving ? 3.2 : TUNE.rollGlide) : (moving ? 12 : 14);
  player.vel.x += (tx - player.vel.x) * Math.min(1, k * dt);
  player.vel.y += (tz - player.vel.y) * Math.min(1, k * dt);

  if (sitSlide) {
    sitSlide.t = Math.min(1, sitSlide.t + dt / 0.35);
    player.pos.lerpVectors(sitSlide.from, new THREE.Vector3(chair.position.x, 0, chair.position.z), easeInOut(sitSlide.t));
    player.vel.set(0, 0);
    if (sitSlide.t >= 1) sitSlide = null;
  } else {
    const before = player.pos.clone();
    player.pos.x += player.vel.x * dt;
    player.pos.z += player.vel.y * dt;
    resolveCollisions(player.pos);
    // bumping into something kills velocity along that axis
    if (dt > 0) {
      player.vel.x = (player.pos.x - before.x) / dt;
      player.vel.y = (player.pos.z - before.z) / dt;
    }
  }

  if (player.seated && !sitSlide) {
    chair.position.set(player.pos.x, 0, player.pos.z);
    chair.rotation.y = player.yaw;
    Audio.chairRoll(player.vel.length());
  } else if (chairSlide) {
    chairSlide.t = Math.min(1, chairSlide.t + dt / 0.45);
    chair.position.lerpVectors(chairSlide.from, chairSlide.to, easeOut(chairSlide.t));
    if (chairSlide.t >= 1) chairSlide = null;
  } else if (player.seated && sitSlide) {
    chair.rotation.y += (player.yaw - chair.rotation.y) * Math.min(1, dt * 8);
  }
  if (dt > 0) {
    chairBody.velocity.set((chair.position.x - chairBody.position.x) / dt, 0, (chair.position.z - chairBody.position.z) / dt);
  }
  chairBody.position.set(chair.position.x, 0, chair.position.z);
  chairBody.quaternion.setFromEuler(0, chair.rotation.y, 0);

  // eye height + a little head bob when walking
  const eyeTarget = player.seated ? TUNE.eyeSeated : TUNE.eyeStanding;
  player.eye += (eyeTarget - player.eye) * Math.min(1, dt * 6);
  const sp = player.vel.length();
  if (!player.seated && sp > 0.2) player.bob += dt * sp * 6.5; else player.bob *= 0.9;
  const bobY = player.seated ? 0 : Math.sin(player.bob) * 0.018;

  const fwdOff = player.seated ? 0.07 : 0;
  camera.position.set(player.pos.x - Math.sin(player.yaw) * fwdOff, player.eye + bobY, player.pos.z - Math.cos(player.yaw) * fwdOff);
  camera.rotation.set(player.pitch, player.yaw, 0);
}
const easeInOut = (t) => t * t * (3 - 2 * t);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

// ---------- Hover + HUD ----------
const propMeshes = () => props.map((p) => p.mesh);
function updateHover() {
  hovered = null;
  if (held) return;
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  raycaster.far = TUNE.reach;
  const hits = raycaster.intersectObjects(propMeshes(), true);
  if (hits.length) {
    let o = hits[0].object;
    while (o && !o.userData.prop) o = o.parent;
    hovered = props.find((p) => p.mesh === o) || null;
  }
}

function updateHUD() {
  ui.cross.classList.toggle('hot', !!hovered);
  let hint = '';
  if (!player.seated && !held && chairDistance() < 0.85) hint = 'E · sit';
  ui.hint.textContent = hint;
  if (charging && held) {
    const c = Math.min(1, (performance.now() - chargeStart) / 1000 / TUNE.chargeTime);
    ui.charge.style.opacity = 1;
    ui.chargeCircle.style.strokeDashoffset = String(113.1 * (1 - c));
  } else ui.charge.style.opacity = 0;
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
      // pan the tick toward the clock
      const toClock = new THREE.Vector3(0.15 - camera.position.x, 0, -ROOM.half - camera.position.z).normalize();
      camera.getWorldDirection(fwd); right.set(-fwd.z, 0, fwd.x).normalize();
      Audio.tick(THREE.MathUtils.clamp(toClock.dot(right), -1, 1) * 0.7);
    }
  }
}

// ---------- Main loop ----------
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
    else holdTarget.copy(camera.position).addScaledVector(fwd, 0.48).addScaledVector(up, -0.12).addScaledVector(right, 0.1);
    world.step(1 / 120, dt, 6);
    updateHover();
    updateClock(dt);
  }
  for (const p of props) { p.mesh.position.copy(p.body.position); p.mesh.quaternion.copy(p.body.quaternion); }

  const fovTarget = inspecting ? TUNE.fovInspect : charging && held ? TUNE.fovAim : TUNE.fov;
  camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 7);
  camera.updateProjectionMatrix();
  grayPass.uniforms.inspect.value += ((inspecting ? 1 : 0) - grayPass.uniforms.inspect.value) * Math.min(1, dt * 7);
  grayPass.uniforms.time.value = (now / 1000) % 100;

  updateHUD();
  composer.render();

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0;
    if (ui.debug.style.display === 'block') ui.dbgInfo.textContent = `${fps} fps · ${player.seated ? 'seated' : 'standing'} · x ${player.pos.x.toFixed(2)} z ${player.pos.z.toFixed(2)}${fallbackLook ? ' · arrow-look' : ''}`;
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
  TUNE, player, props, world, camera,
  start() { started = true; fallbackLook = true; resume(); },
  look(yaw, pitch) { player.yaw = yaw; player.pitch = pitch; },
  stand() { if (player.seated) toggleSeat(); },
  sit() { if (!player.seated) toggleSeat(); },
  setPos(x, z) { player.pos.set(x, 0, z); },
  hovered: () => (hovered ? hovered.name : null),
  held: () => (held ? held.name : null),
  grabHovered() { if (hovered) grab(hovered); return !!held; },
  throwHeld(c) { if (!held) return; camera.getWorldDirection(fwd); dropHeld(TUNE.throwMin + (TUNE.throwMax - TUNE.throwMin) * c, fwd.clone()); },
  dropAt(name, x, y, z) { const p = props.find((q) => q.name === name); p.body.position.set(x, y, z); p.body.velocity.set(0, 0, 0); p.body.angularVelocity.set(0, 0, 0); p.body.wakeUp(); },
  trashCan: room.trashCan,
  setColor(v) { grayPass.uniforms.saturation.value = v; ui.sat.value = v; },
  inspect(on) { inspecting = on && !!held; },
};
