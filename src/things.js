// The detail pass: the things in the cubicle you can use, and picking things up to look at them closely.
// None of these are tasks. They're just a desk that behaves like a desk.
import * as THREE from 'three';
import * as Audio from './audio.js';

const ease = (t) => t * t * (3 - 2 * t);
const clamp = THREE.MathUtils.clamp;

export function createThings({ scene, camera, room, props, TUNE }) {
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), v = new THREE.Vector3(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion();
  const basis = () => { camera.getWorldDirection(fwd); up.copy(camera.up).applyQuaternion(camera.quaternion); right.crossVectors(fwd, up).normalize(); };
  let time = 0;

  // ---------------------------------------------------------------- lamp
  const lamp = { on: false, k: 0 };
  room.lamp.light.castShadow = true; room.lamp.light.shadow.mapSize.set(1024, 1024); room.lamp.light.shadow.bias = -0.0006; room.lamp.light.shadow.normalBias = 0.02;
  room.lamp.light.shadow.camera.near = 0.05; room.lamp.light.shadow.camera.far = 2.6;
  function useLamp() { lamp.on = !lamp.on; Audio.switchClick(); }

  // ---------------------------------------------------------------- fan
  const fan = { speed: 0, spin: 0, dir: new THREE.Vector3(), pos: new THREE.Vector3() };
  function useFan() { fan.speed = (fan.speed + 1) % 3; Audio.switchClick(); Audio.loop('fan', [0, 0.012, 0.022][fan.speed]); }

  // ---------------------------------------------------------------- stapler, mug, drawers, cradle
  const stapler = { t: -1 };
  function useStapler() { if (stapler.t < 0) { stapler.t = 0; Audio.staple(); } }
  const mug = { t: -1, sips: 0, home: room.mug.group.position.clone(), homeQ: room.mug.group.quaternion.clone(), full: room.mug.coffee.position.y };
  function useMug() { if (mug.t < 0 && !exam) { mug.t = 0; Audio.lift(); } }
  function useDrawer(obj) { const d = room.drawers[obj.userData.index]; d.target = d.target ? 0 : 1; Audio.drawer(!!d.target); }
  const cradle = { amp: 0, t: 0, lastSide: 0 };
  function useCradle() { cradle.amp = 0.62; cradle.t = 0; cradle.lastSide = -1; }

  // ---------------------------------------------------------------- phone
  const phone = { up: false, k: 0, mode: 'idle', digits: '', t: 0, n: 0, message: true, restQ: room.phone.handset.quaternion.clone() };
  function quiet() { Audio.loop('dial', 0); Audio.loop('line', 0); }
  function setMode(mode) { phone.mode = mode; phone.t = 0; phone.n = 0; quiet(); if (mode === 'dial') Audio.loop('dial', 0.02); if (mode === 'message' || mode === 'answered') Audio.loop('line', 0.012); }
  function usePhone() {
    phone.up = !phone.up; Audio.handset(phone.up);
    if (phone.up) { phone.digits = ''; setMode(phone.message ? 'message' : 'dial'); phone.message = false; }
    else setMode('idle');
  }
  function dial(d) {
    if (!phone.up || (phone.mode !== 'dial' && phone.mode !== 'dialing') || phone.digits.length >= 10) return false;
    if (phone.mode === 'dial') setMode('dialing');
    phone.digits += d; phone.t = 0; Audio.dtmf(d);
    const key = room.phone.keys[{ '*': 9, 0: 10, '#': 11 }[d] ?? (Number(d) - 1)];
    if (key) { key.userData.press = 0.12; }
    return true;
  }
  function updatePhone(dt) {
    const p = phone, h = room.phone.handset, g = room.phone.group;
    p.k = clamp(p.k + (p.up ? 1 : -1) * dt / 0.35, 0, 1);
    // the handset comes up to your ear: it sits at the left edge of your view while you're on the line
    basis();
    v.copy(camera.position).addScaledVector(fwd, 0.36).addScaledVector(right, -0.37 * Math.min(1.3, camera.aspect / 1.4)).addScaledVector(up, -0.1);
    g.updateWorldMatrix(true, false); g.worldToLocal(v);
    const e = ease(p.k);
    h.position.lerpVectors(room.phone.rest, v, e);
    if (p.k > 0) { g.getWorldQuaternion(q).invert(); q2.setFromEuler(new THREE.Euler(0.5, 0.5, 1.2)).premultiply(camera.quaternion); q.multiply(q2); h.quaternion.copy(p.restQ).slerp(q, e); }
    else h.quaternion.copy(p.restQ);
    for (const key of room.phone.keys) { if (key.userData.press > 0) { key.userData.press -= dt; key.userData.baseY ??= key.position.y; key.position.y = key.userData.baseY - (key.userData.press > 0 ? 0.003 : 0); } }
    room.phone.msgLight.material.emissiveIntensity = p.message && Math.sin(time * 5.2) > 0 ? 3 : 0;
    if (!p.up) return;
    p.t += dt;
    const at = (sec) => p.t >= sec && p.t - dt < sec;
    if (p.mode === 'message') {                       // one saved message: something knocking. Then the tone.
      if (at(1.2)) Audio.lineKnock();
      if (at(4.4)) Audio.beep();
      if (p.t > 5.6) setMode('dial');
    } else if (p.mode === 'dialing') {
      if (p.digits.length >= 7 || p.t > 2.6) setMode('ringing');
    } else if (p.mode === 'ringing') {
      if (at(0.6) || at(3.4) || at(6.2)) Audio.ringback();
      if (p.t > 8.6) { Audio.handset(true); setMode('answered'); }
    } else if (p.mode === 'answered') {               // somebody picks up, says nothing, and dials your number back to you
      const i = Math.floor((p.t - 1.6) / 0.52);
      if (p.t > 1.6 && i < p.digits.length && i >= p.n) { p.n = i + 1; Audio.dtmf(p.digits[i], 0.014, 0.3); }
      if (p.t > 1.6 + p.digits.length * 0.52 + 1.4) { Audio.handset(false); setMode('busy'); }
    } else if (p.mode === 'busy') {
      const i = Math.floor(p.t / 0.52);
      if (i < 8 && i >= p.n) { p.n = i + 1; Audio.busy(); }
    }
  }

  // ---------------------------------------------------------------- pick a thing up and turn it over (E)
  let exam = null;
  const box = new THREE.Box3();
  function examine(obj) {
    if (exam || !obj.userData.examine || mug.t >= 0) return false;
    obj.updateWorldMatrix(true, true);
    box.setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3()); obj.worldToLocal(center);
    exam = { obj, pos: obj.position.clone(), quat: obj.quaternion.clone(), center, k: 0, out: false, yaw: 0.5, pitch: 0.25, dist: obj.userData.examine.size * 0.9 + 0.15, name: obj.userData.examine.name };
    Audio.lift();
    return true;
  }
  function putBack() { if (exam && !exam.out) { exam.out = true; } }
  function turn(dx, dy) { if (!exam) return; exam.yaw += dx * 0.006; exam.pitch = clamp(exam.pitch + dy * 0.006, -Math.PI, Math.PI); }
  function zoom(d) { if (exam) exam.dist = clamp(exam.dist + d * 0.0006, 0.16, 0.6); }
  function updateExam(dt) {
    const x = exam; if (!x) return;
    x.k = clamp(x.k + (x.out ? -1 : 1) * dt / 0.4, 0, 1);
    const e = ease(x.k);
    basis();
    q.copy(camera.quaternion).multiply(q2.setFromEuler(new THREE.Euler(x.pitch, x.yaw, 0, 'XYZ')));
    x.obj.quaternion.copy(x.quat).slerp(q, e);
    v.copy(camera.position).addScaledVector(fwd, x.dist).addScaledVector(up, -0.015);
    // keep the middle of the thing (not its base) in the middle of the view
    const off = x.center.clone().applyQuaternion(x.obj.quaternion);
    v.sub(off);
    x.obj.position.lerpVectors(x.pos, v, e);
    if (x.out && x.k <= 0) { x.obj.position.copy(x.pos); x.obj.quaternion.copy(x.quat); if (x.name === 'mug') Audio.mugDown(); else Audio.lift(); exam = null; }
  }

  // ---------------------------------------------------------------- every frame
  function update(dt) {
    time += dt;
    // lamp
    lamp.k = clamp(lamp.k + (lamp.on ? 1 : -1) * dt / 0.12, 0, 1);
    room.lamp.light.intensity = lamp.k * TUNE.lampPower;
    room.lamp.bulb.material.emissiveIntensity = lamp.k * 5;
    room.lamp.inner.material.emissiveIntensity = lamp.k * 0.9;
    // fan: spins up and down, and pushes loose paper around
    const want = [0, 16, 30][fan.speed];
    fan.spin += (want - fan.spin) * Math.min(1, dt * 1.6);
    room.fan.blades.rotation.z += fan.spin * dt;
    if (fan.spin > 2) {
      room.fan.head.getWorldPosition(fan.pos); room.fan.head.getWorldDirection(fan.dir);
      for (const p of props) {
        if (!p.grab || p.body.mass === 0) continue;
        v.set(p.body.position.x - fan.pos.x, p.body.position.y - fan.pos.y, p.body.position.z - fan.pos.z);
        const along = v.dot(fan.dir); if (along < 0.05 || along > 1.5) continue;
        const side = Math.sqrt(Math.max(0, v.lengthSq() - along * along));
        if (side > 0.14 + along * 0.32) continue;
        const f = TUNE.fanPush * (fan.spin / 30) * (1 - along / 1.5) * (p.name === 'paperBall' ? 0.6 : 1) * (0.7 + 0.5 * Math.sin(time * 9 + p.body.id));
        p.body.wakeUp(); p.body.force.x += fan.dir.x * f; p.body.force.z += fan.dir.z * f; p.body.force.y += f * 0.35;
      }
    }
    // stapler
    if (stapler.t >= 0) { stapler.t += dt; const s = Math.sin(clamp(stapler.t / 0.22, 0, 1) * Math.PI); room.stapler.top.rotation.x = -0.13 * (1 - s); if (stapler.t > 0.22) stapler.t = -1; }
    // a sip of cold coffee
    if (mug.t >= 0) {
      mug.t += dt;
      const g = room.mug.group, kUp = ease(clamp(mug.t / 0.45, 0, 1)) * (1 - ease(clamp((mug.t - 1.25) / 0.45, 0, 1)));
      basis();
      v.copy(camera.position).addScaledVector(fwd, 0.2).addScaledVector(up, -0.13);
      g.position.lerpVectors(mug.home, v, kUp);
      const tip = ease(clamp((mug.t - 0.4) / 0.3, 0, 1)) * (1 - ease(clamp((mug.t - 1.0) / 0.25, 0, 1)));
      q.copy(camera.quaternion).multiply(q2.setFromEuler(new THREE.Euler(0.15 + tip * 0.75, 2.2, 0)));
      g.quaternion.copy(mug.homeQ).slerp(q, kUp);
      if (mug.t >= 0.55 && mug.t - dt < 0.55) { if (mug.sips < 5) { Audio.sip(); mug.sips++; room.mug.coffee.position.y = mug.full - mug.sips * 0.012; if (mug.sips >= 5) room.mug.coffee.visible = false; } }
      if (mug.t > 1.7) { mug.t = -1; g.position.copy(mug.home); g.quaternion.copy(mug.homeQ); Audio.mugDown(); }
    }
    // drawers
    for (const d of room.drawers) { d.open = clamp(d.open + (d.target ? 1 : -1) * dt / 0.4, 0, 1); d.group.position.x = d.x0 - d.reach * ease(d.open); }
    // the desk toy: the end balls take turns
    if (cradle.amp > 0.01) {
      cradle.t += dt; cradle.amp *= Math.exp(-dt / 9);
      const c = Math.cos(cradle.t * 9.4), b = room.cradle.balls;
      b[0].rotation.z = -cradle.amp * Math.max(0, c); b[4].rotation.z = cradle.amp * Math.max(0, -c);
      const side = Math.sign(c);
      if (side !== cradle.lastSide && cradle.lastSide !== 0) Audio.clack(Math.min(1, cradle.amp * 2));
      cradle.lastSide = side;
      if (cradle.amp <= 0.012) { b[0].rotation.z = b[4].rotation.z = 0; cradle.amp = 0; }
    }
    updatePhone(dt);
    updateExam(dt);
  }

  return {
    use(kind, obj) {
      if (kind === 'lamp') useLamp(); else if (kind === 'fan') useFan(); else if (kind === 'stapler') useStapler(); else if (kind === 'mug') useMug();
      else if (kind === 'drawer') useDrawer(obj); else if (kind === 'cradle') useCradle(); else if (kind === 'phone') usePhone(); else return false;
      return true;
    },
    update, examine, putBack, turn, zoom, dial,
    get examining() { return exam; }, get phoneUp() { return phone.up; }, get sipping() { return mug.t >= 0; },
    state: { lamp, fan, phone, mug, cradle },
    // somebody tidies up overnight
    overnight() {
      for (const d of room.drawers) d.target = 0;
      lamp.on = false; if (fan.speed) { fan.speed = 0; Audio.loop('fan', 0); }
      if (phone.up) { phone.up = false; setMode('idle'); }
      phone.message = true;
      mug.sips = 0; room.mug.coffee.visible = true; room.mug.coffee.position.y = mug.full;
    },
    hush() { quiet(); Audio.loop('fan', 0); },
    resume() { if (fan.speed) Audio.loop('fan', [0, 0.012, 0.022][fan.speed]); },
  };
}
