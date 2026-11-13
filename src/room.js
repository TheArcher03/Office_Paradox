// The cubicle: static furniture, physics colliders and the props. Only loose paper can be picked up (for now).
// Units are meters. The desk sits against the back wall (-Z). The player starts seated, facing -Z.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as T from './textures.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const ROOM = { half: 1.35, wallH: 2.6, wallT: 0.06, deskTop: 0.74, ceilingY: 3.2 };

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0, ...o });

export function buildRoom(scene, world) {
  const props = [];      // { name, mesh, body, sound }
  const colliders = [];  // XZ rectangles the player can't walk through
  const H = ROOM.half;
  const DT = ROOM.deskTop;

  const physMat = new CANNON.Material('default');

  function staticBox(w, h, d, x, y, z, mat, { collide = true, shadow = true, parent = scene, rotY = 0 } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    parent.add(mesh);
    if (collide) {
      const body = new CANNON.Body({ mass: 0, material: physMat });
      body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
      body.position.set(x, y, z);
      body.quaternion.setFromEuler(0, rotY, 0);
      world.addBody(body);
    }
    return mesh;
  }
  function staticCollider(hx, hy, hz, x, y, z) {
    const body = new CANNON.Body({ mass: 0, material: physMat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
    body.position.set(x, y, z); world.addBody(body);
  }
  // a flat picture/paper hung on a wall. wall: 'back' (-Z), 'front' (+Z), 'left' (-X), 'right' (+X)
  function wallPlane(w, h, map, wall, a, y, { tilt = 0, inset = 0.004, mat = null } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat || std({ map, roughness: 0.9 }));
    if (wall === 'back') { m.position.set(a, y, -H + inset); }
    if (wall === 'front') { m.position.set(a, y, H - inset); m.rotation.y = Math.PI; }
    if (wall === 'left') { m.position.set(-H + inset, y, a); m.rotation.y = Math.PI / 2; }
    if (wall === 'right') { m.position.set(H - inset, y, a); m.rotation.y = -Math.PI / 2; }
    m.rotation.z = tilt; m.receiveShadow = true; scene.add(m);
    return m;
  }
  const pinMat = std({ color: '#c0392b', roughness: 0.4 });
  function pin(wall, a, y) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), pinMat);
    const o = 0.01;
    if (wall === 'back') p.position.set(a, y, -H + o);
    if (wall === 'front') p.position.set(a, y, H - o);
    if (wall === 'left') p.position.set(-H + o, y, a);
    if (wall === 'right') p.position.set(H - o, y, a);
    scene.add(p);
  }

  // ---- Grabbable props -------------------------------------------------------
  // Collision groups: the world, props, and the player's own body (so a held object can pass through you).
  const GROUP = { WORLD: 1, PROP: 2, PLAYER: 4 };
  const impact = { fn: null };
  // stuck = held in place (taped/pinned) until the player grabs it, then it becomes a normal physics object
  function addProp(name, mesh, shape, mass, x, y, z, { sound = 'thunk', rot = null, quat = null, linDamp = 0.05, angDamp = 0.2, offset = null, shapes = null, stuck = false, grab = false, kind = null } = {}) {
    const fixed = stuck || !grab;   // only loose paper moves; the rest of the cubicle stays put
    mesh.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); // own materials, so it can glow on hover
    });
    mesh.userData.prop = name;
    scene.add(mesh);
    const body = new CANNON.Body({
      mass: fixed ? 0 : mass, type: fixed ? CANNON.Body.STATIC : CANNON.Body.DYNAMIC, material: physMat,
      linearDamping: linDamp, angularDamping: angDamp, allowSleep: true, sleepSpeedLimit: 0.05, sleepTimeLimit: 0.6,
      collisionFilterGroup: GROUP.PROP, collisionFilterMask: GROUP.WORLD | GROUP.PROP,
    });
    if (shape) body.addShape(shape, offset || undefined);
    if (shapes) shapes.forEach(([sh, o, q]) => body.addShape(sh, o, q));
    body.position.set(x, y, z);
    if (rot) body.quaternion.setFromEuler(...rot);
    if (quat) body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    world.addBody(body);
    const p = { name, mesh, body, sound, mass, angDamp, stuck, grab: grab && !stuck, kind };
    body.userData = p;
    body.addEventListener('collide', (e) => impact.fn && impact.fn(p, e));
    mesh.position.copy(body.position); mesh.quaternion.copy(body.quaternion);
    props.push(p);
    return p;
  }
  function removeProp(p) {
    scene.remove(p.mesh); world.removeBody(p.body);
    const i = props.indexOf(p); if (i >= 0) props.splice(i, 1);
  }
  // a single sheet of paper: light, floaty, and it can lie flat or be pinned to a wall
  const sheetTex = { spreadsheet: T.spreadsheet(), memo: T.paper(true), blank: T.paper(false), cat: T.catPrint() };
  const sheetEdge = std({ color: '#efece4', roughness: 0.95 });
  function makeSheet(kind, x, y, z, opts = {}) {
    const face = std({ map: sheetTex[kind], roughness: 0.95 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.002, 0.28), [sheetEdge, sheetEdge, face, face, sheetEdge, sheetEdge]);
    return addProp(kind === 'memo' ? 'memo' : 'sheet', m, new CANNON.Box(new CANNON.Vec3(0.1075, 0.003, 0.14)), 0.006, x, y, z,
      { sound: 'paper', linDamp: 0.55, angDamp: 0.6, grab: true, kind, ...opts });
  }
  // A sheet being crumpled in your hands: set(0) is the flat sheet, set(1) is a tight paper ball.
  // The finished mesh becomes the ball itself, so the ball you made still shows what was printed on it.
  const BALL_R = 0.036;
  function makeCrumple(kind) {
    const NX = 8, NZ = 10;
    const g = new THREE.PlaneGeometry(0.215, 0.28, NX, NZ);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const flat = Float32Array.from(pos.array);
    const mid = new Float32Array(flat.length), ball = new Float32Array(flat.length);
    for (let i = 0; i < pos.count; i++) {
      const x = flat[i * 3], z = flat[i * 3 + 2];
      // done: the sheet wrapped around into a lumpy ball
      const u = x / 0.215 + 0.5, w = z / 0.28 + 0.5;
      const th = u * Math.PI * 2, ph = 0.25 + w * (Math.PI - 0.5);
      const r = BALL_R * (0.84 + Math.random() * 0.28);
      const bx = r * Math.sin(ph) * Math.cos(th), by = r * Math.cos(ph), bz = r * Math.sin(ph) * Math.sin(th);
      ball[i * 3] = bx; ball[i * 3 + 1] = by; ball[i * 3 + 2] = bz;
      // halfway: a scrunched, wrinkled sheet closing in on itself
      mid[i * 3] = (x * 0.5 + bx) * 0.75 + (Math.random() - 0.5) * 0.012;
      mid[i * 3 + 1] = by * 0.8 + (Math.random() - 0.5) * 0.02;
      mid[i * 3 + 2] = (z * 0.45 + bz) * 0.75 + (Math.random() - 0.5) * 0.012;
    }
    const mesh = new THREE.Mesh(g, std({ map: sheetTex[kind] || sheetTex.blank, roughness: 1, side: THREE.DoubleSide, flatShading: true }));
    mesh.castShadow = true;
    const set = (t) => {
      t = THREE.MathUtils.clamp(t, 0, 1);
      const a = pos.array;
      for (let i = 0; i < a.length; i++) {
        a[i] = t < 0.5 ? flat[i] + (mid[i] - flat[i]) * (t * 2) : mid[i] + (ball[i] - mid[i]) * (t * 2 - 1);
      }
      pos.needsUpdate = true;
      if (t >= 1) g.computeBoundingSphere();
    };
    return { mesh, set };
  }
  // a folded paper airplane (a simple dart): nose toward -Z
  function addPlane(x, y, z) {
    const v = [
      0, 0, -0.14,   0, 0.004, 0.1,   -0.09, 0.018, 0.1,     // left wing
      0, 0, -0.14,   0.09, 0.018, 0.1,   0, 0.004, 0.1,      // right wing
      0, 0, -0.14,   0, 0.004, 0.1,   0, -0.035, 0.085,      // keel
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, std({ color: '#f4f1e8', roughness: 1, side: THREE.DoubleSide, flatShading: true }));
    return addProp('plane', m, new CANNON.Box(new CANNON.Vec3(0.06, 0.012, 0.11)), 0.006, x, y, z, { sound: 'paper', linDamp: 0.6, angDamp: 0.7, grab: true, kind: 'plane' });
  }
  // paper is light and lumpy: lots of air drag, and it stops rolling quickly
  function addBall(mesh, x, y, z) {
    return addProp('paperBall', mesh, new CANNON.Sphere(BALL_R), 0.012, x, y, z, { sound: 'paper', linDamp: 0.12, angDamp: 0.75, grab: true });
  }
  // orientation for something flat stuck to a wall, face out, with a small tilt
  function wallQuat(wall, tilt = 0) {
    const yaw = { back: 0, front: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[wall];
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    return q;
  }

  // ---- Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), std({ map: T.carpet(), roughness: 1 }));
  floor.material.map.repeat.set(28, 28);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const floorBody = new CANNON.Body({ mass: 0, material: physMat });
  floorBody.addShape(new CANNON.Plane());
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floorBody);

  // ---- Walls: fabric cubicle panels with metal trim and panel seams. Too tall to see over, and no way out.
  const wallMat = std({ map: T.fabric(), roughness: 1 });
  const trimMat = std({ color: '#9a9c98', roughness: 0.5, metalness: 0.4 });
  const { wallH: WH, wallT: WT } = ROOM;
  const walls = [
    [2 * H + 2 * WT, WH, WT, 0, WH / 2, -H - WT / 2],
    [2 * H + 2 * WT, WH, WT, 0, WH / 2, H + WT / 2],
    [WT, WH, 2 * H, -H - WT / 2, WH / 2, 0],
    [WT, WH, 2 * H, H + WT / 2, WH / 2, 0],
  ];
  walls.forEach(([w, h, d, x, y, z]) => {
    staticBox(w, h, d, x, y, z, wallMat, { shadow: false });
    staticBox(w + 0.03, 0.05, d + 0.03, x, WH + 0.025, z, trimMat, { collide: false });
  });
  // vertical seams where the panels meet, plus a kick strip at the floor
  [-0.45, 0.45].forEach((a) => {
    staticBox(0.025, WH, 0.012, a, WH / 2, -H + 0.006, trimMat, { collide: false, shadow: false });
    staticBox(0.025, WH, 0.012, a, WH / 2, H - 0.006, trimMat, { collide: false, shadow: false });
    staticBox(0.012, WH, 0.025, -H + 0.006, WH / 2, a, trimMat, { collide: false, shadow: false });
    staticBox(0.012, WH, 0.025, H - 0.006, WH / 2, a, trimMat, { collide: false, shadow: false });
  });
  const kick = std({ color: '#55585a', roughness: 0.6 });
  staticBox(2 * H, 0.08, 0.01, 0, 0.04, H - 0.005, kick, { collide: false, shadow: false });
  staticBox(0.01, 0.08, 2 * H, -H + 0.005, 0.04, 0, kick, { collide: false, shadow: false });
  // physics lid just under the ceiling so nothing escapes over the walls (invisible)
  staticCollider(H + 1, 0.05, H + 1, 0, ROOM.ceilingY - 0.05, 0);

  // ---- Drop ceiling: acoustic tiles, fluorescent panels, an air vent and a "smoke detector"
  const CY = ROOM.ceilingY;
  const ceilTex = T.ceilingTiles(); ceilTex.repeat.set(20, 20); ceilTex.offset.set(0.5, 0.5);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), std({ map: ceilTex, roughness: 1, emissive: '#2a2a28', emissiveMap: ceilTex, emissiveIntensity: 0.6 }));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = CY; scene.add(ceiling);
  const lightPanelMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#f3f6ff', emissiveIntensity: 1.35, roughness: 0.3 });
  const panelFrame = std({ color: '#cfcfca', roughness: 0.5, metalness: 0.3 });
  const panels = [];
  for (const x of [-3.3, 0.3, 3.9]) for (const z of [-3.6, 0.0, 3.6]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.015, 1.16), lightPanelMat);
    p.position.set(x, CY - 0.008, z); scene.add(p); panels.push(p);
    for (const dz of [-0.4, 0, 0.4]) {
      const louver = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.02, 0.012), panelFrame);
      louver.position.set(x, CY - 0.02, z + dz); scene.add(louver);
    }
  }
  const vent = new THREE.Group(); vent.position.set(-0.9, CY - 0.01, 0.9); scene.add(vent);
  const ventFace = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.015, 0.56), std({ color: '#b9b9b4', roughness: 0.6, metalness: 0.2 }));
  vent.add(ventFace);
  for (let i = -3; i <= 3; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.012, 0.02), std({ color: '#5e5e5a' }));
    slat.position.set(0, -0.012, i * 0.065); vent.add(slat);
  }
  const detector = new THREE.Group(); detector.position.set(-0.25, CY, -0.55); scene.add(detector);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.035, 24), std({ color: '#ecebe6', roughness: 0.5 }));
  dome.position.y = -0.02; detector.add(dome);
  const ledMat = new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff2a1a', emissiveIntensity: 0 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), ledMat);
  led.position.set(0.035, -0.04, 0); detector.add(led);

  // ---- L-shaped corner desk: along the back wall, then down the right wall
  const deskMat = std({ map: T.laminate(), roughness: 0.55 });
  const edgeMat = std({ color: '#4a4440', roughness: 0.5 });
  const panelMat = std({ color: '#86847c', roughness: 0.8 });
  const backZ1 = -0.55;                  // front edge of the back desk
  const retX0 = 0.6, retZ1 = 0.5;        // inner edge + far end of the return
  // back run
  staticBox(2 * H, 0.035, H + backZ1, 0, DT - 0.0175, (-H + backZ1) / 2, deskMat);
  staticBox(retX0 + H, 0.035, 0.012, (-H + retX0) / 2, DT - 0.0175, backZ1 + 0.006, edgeMat, { collide: false });
  // return
  staticBox(H - retX0, 0.035, retZ1 - backZ1, (retX0 + H) / 2, DT - 0.0175, (backZ1 + retZ1) / 2, deskMat);
  staticBox(0.012, 0.035, retZ1 - backZ1, retX0 - 0.006, DT - 0.0175, (backZ1 + retZ1) / 2, edgeMat, { collide: false });
  staticBox(H - retX0, 0.035, 0.012, (retX0 + H) / 2, DT - 0.0175, retZ1 + 0.006, edgeMat, { collide: false });
  // supports: left end panel, return end panel, modesty panel at the back
  staticBox(0.025, DT - 0.035, H + backZ1, -H + 0.0125, (DT - 0.035) / 2, (-H + backZ1) / 2, panelMat);
  staticBox(H - retX0, DT - 0.035, 0.025, (retX0 + H) / 2, (DT - 0.035) / 2, retZ1 - 0.0125, panelMat);
  staticBox(2 * H - 0.05, 0.42, 0.02, 0, DT - 0.25, -H + 0.02, panelMat, { collide: false });
  // drawer pedestal under the end of the return
  const pedX = (retX0 + H) / 2 + 0.03, pedZ = retZ1 - 0.25;
  staticBox(H - retX0 - 0.08, 0.66, 0.42, pedX, 0.33 + 0.01, pedZ, panelMat);
  [0.12, 0.33, 0.54].forEach((y) => staticBox(0.015, 0.015, 0.14, retX0 + 0.065, y, pedZ, trimMat, { collide: false }));
  colliders.push({ minX: pedX - (H - retX0 - 0.08) / 2, maxX: H, minZ: pedZ - 0.21, maxZ: retZ1 });  // pedestal + end panel (even when crawling)
  colliders.push({ minX: -H, maxX: H, minZ: -H, maxZ: backZ1, desk: true });
  colliders.push({ minX: retX0, maxX: H, minZ: backZ1, maxZ: retZ1, desk: true });

  // ---- Hutch shelf above the back desk, with binders
  const shelfX0 = -H + 0.02, shelfX1 = 0.15, shelfY = 1.48, shelfD = 0.28;
  const shelfCX = (shelfX0 + shelfX1) / 2, shelfCZ = -H + shelfD / 2;
  staticBox(shelfX1 - shelfX0, 0.025, shelfD, shelfCX, shelfY, shelfCZ, deskMat);
  [shelfX0 + 0.2, shelfX1 - 0.2].forEach((x) => {
    staticBox(0.02, 0.16, 0.02, x, shelfY - 0.09, -H + 0.012, trimMat, { collide: false });
    staticBox(0.02, 0.02, shelfD - 0.03, x, shelfY - 0.023, shelfCZ - 0.01, trimMat, { collide: false });
  });
  const binderColors = ['#2f5d8a', '#2f5d8a', '#3e7a4f', '#8f2f2f', '#d8d4c8', '#2f5d8a', '#c9a23a', '#3e7a4f', '#4b3f6b', '#8f2f2f', '#d8d4c8'];
  let bx = shelfX0 + 0.04;
  binderColors.forEach((col, i) => {
    const w = 0.045 + (i % 3) * 0.012;
    const hgt = 0.29 - (i % 4 === 3 ? 0.04 : 0);
    const spine = T.binderSpine(col, col !== '#d8d4c8');
    const mats = [std({ color: col }), std({ color: col }), std({ color: col }), std({ color: col }), std({ map: spine, roughness: 0.7 }), std({ color: col })];
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, 0.25), mats);
    addProp('binder', b, new CANNON.Box(new CANNON.Vec3(w / 2, hgt / 2, 0.125)), 0.6, bx + w / 2, shelfY + 0.0125 + hgt / 2 + 0.001, -H + 0.145, { sound: 'heavy' });
    bx += w + 0.006;
  });
  // a box file lying flat at the end of the shelf; the open space next to it is where something new might appear one day
  addProp('boxFile', new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.24), std({ color: '#c8b89a', roughness: 0.9 })),
    new CANNON.Box(new CANNON.Vec3(0.15, 0.045, 0.12)), 0.7, shelfX1 - 0.2, shelfY + 0.0125 + 0.046, -H + 0.14, { sound: 'heavy' });

  // ---- Computer on the back desk: deep beige CRT, keyboard, mousepad + mouse, tower under the desk
  const beige = std({ color: '#d2cab3', roughness: 0.6 });
  const monX = -0.25, monFront = -0.8;
  const monY = DT + 0.04 + 0.2;
  const computer = new THREE.Group(); scene.add(computer);
  computer.userData.use = 'computer';
  const monBeige = beige.clone();   // its own material, so only the monitor glows when you look at it
  staticBox(0.26, 0.04, 0.24, monX, DT + 0.02, monFront - 0.16, monBeige, { parent: computer });                     // swivel base
  staticBox(0.44, 0.38, 0.05, monX, monY, monFront - 0.025, monBeige, { parent: computer });                          // bezel
  staticBox(0.4, 0.34, 0.2, monX, monY, monFront - 0.15, monBeige, { parent: computer });                             // body
  const crtBack = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.22, 4, 1), beige);  // tapered tube housing
  crtBack.rotation.x = -Math.PI / 2; crtBack.rotation.y = Math.PI / 4;
  crtBack.position.set(monX, monY - 0.01, monFront - 0.36); crtBack.castShadow = true; scene.add(crtBack);
  staticCollider(0.14, 0.12, 0.11, monX, monY - 0.01, monFront - 0.36);
  // the screen lights itself (the picture comes from src/computer.js)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.265), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  screen.position.set(monX, monY + 0.01, monFront + 0.001); computer.add(screen);
  screen.name = 'crtScreen';
  const powerLed = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.004), std({ color: '#1a3', emissive: '#1a3', emissiveIntensity: 0.6 }));
  powerLed.position.set(monX + 0.17, monY - 0.165, monFront + 0.002); scene.add(powerLed);
  // sticky notes on the monitor bezel
  [[monX + 0.2, monY + 0.15, 0.12, 0], [monX - 0.21, monY - 0.12, -0.09, 1]].forEach(([x, y, r, k]) => {
    const face = std({ map: T.stickyNote(k), roughness: 0.9 });
    const back = std({ color: '#e6cf55', roughness: 0.9 });
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.0015), [back, back, back, back, face, back]);
    addProp('stickyNote', n, new CANNON.Box(new CANNON.Vec3(0.0325, 0.0325, 0.003)), 0.002, x, y, monFront + 0.004,
      { sound: 'paper', linDamp: 0.9, angDamp: 0.8, rot: [0, 0, r], stuck: true });
  });
  const kbSide = std({ color: '#cfc6ae', roughness: 0.6 });
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.16), [kbSide, kbSide, std({ map: T.keyboard(), roughness: 0.6 }), kbSide, kbSide, kbSide]);
  addProp('keyboard', kb, new CANNON.Box(new CANNON.Vec3(0.23, 0.0125, 0.08)), 0.8, monX, DT + 0.0135, -0.67, { sound: 'plastic' });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.004, 0.18), std({ color: '#2d5876', roughness: 0.95 }));
  pad.position.set(0.12, DT + 0.002, -0.68); pad.receiveShadow = true; scene.add(pad);
  const mouseShell = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.04, 4, 10), beige);
  mouseShell.rotation.x = Math.PI / 2; mouseShell.scale.set(1, 1, 0.55);
  const mouseGroup = new THREE.Group(); mouseGroup.add(mouseShell);
  const mouseProp = addProp('mouse', mouseGroup, new CANNON.Box(new CANNON.Vec3(0.028, 0.0155, 0.048)), 0.1, 0.12, DT + 0.017, -0.67, { sound: 'plastic' });
  const cordMat = std({ color: '#bdb6a0' });
  const mouseCord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.12, DT + 0.012, -0.71), new THREE.Vector3(0.14, DT + 0.006, -0.85), new THREE.Vector3(0.02, DT + 0.005, -1.05), new THREE.Vector3(-0.1, DT + 0.005, -1.2)]), 20, 0.004, 5), cordMat);
  scene.add(mouseCord);
  staticBox(0.2, 0.42, 0.45, 0.28, 0.21, -1.05, beige); // tower under the desk
  colliders.push({ minX: 0.16, maxX: 0.4, minZ: -H, maxZ: -0.81 });
  staticBox(0.12, 0.012, 0.004, 0.28, 0.33, -0.824, std({ color: '#333' }), { collide: false }); // floppy slot

  // ---- Desk phone on the return, near the corner
  const phone = new THREE.Group();
  const phoneMat = std({ color: '#2a2b2d', roughness: 0.45 });
  const pBase = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.22), phoneMat); pBase.position.y = 0.025; phone.add(pBase);
  const pKeys = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), std({ map: T.phoneKeypad(), roughness: 0.5 }));
  pKeys.rotation.x = -Math.PI / 2 + 0.15; pKeys.position.set(0.02, 0.052, 0.05); phone.add(pKeys);
  const handset = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.22), phoneMat); handset.position.set(-0.07, 0.07, -0.01); phone.add(handset);
  [-0.09, 0.07].forEach((z) => { const cup = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.045, 0.06), phoneMat); cup.position.set(-0.07, 0.065, z); phone.add(cup); });
  const coil = []; for (let i = 0; i <= 80; i++) { const t = i / 80; coil.push(new THREE.Vector3(-0.1 - 0.03 * Math.sin(t * Math.PI) + 0.012 * Math.cos(t * 50), 0.015 + 0.012 * Math.sin(t * 50), -0.12 + 0.2 * t)); }
  const coilMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 240, 0.003, 4), phoneMat); phone.add(coilMesh);
  addProp('phone', phone, new CANNON.Box(new CANNON.Vec3(0.1, 0.045, 0.11)), 0.9, 0.98, DT + 0.001, -0.32,
    { offset: new CANNON.Vec3(0, 0.045, 0), rot: [0, Math.PI / 2, 0], sound: 'plastic' });

  // ---- Printer on the far end of the return
  const prX = 1.0, prZ = 0.2;
  staticBox(0.42, 0.2, 0.46, prX, DT + 0.1, prZ, beige);
  staticBox(0.26, 0.02, 0.3, prX - 0.34, DT + 0.03, prZ, beige); // output tray (faces you): printed pages slide out onto it
  const printerOut = { from: new THREE.Vector3(prX - 0.12, DT + 0.046, prZ), to: new THREE.Vector3(prX - 0.345, DT + 0.046, prZ) };
  staticBox(0.05, 0.025, 0.09, prX - 0.12, DT + 0.21, prZ + 0.14, std({ color: '#4a4f52' }), { collide: false }); // buttons

  // ---- Paper shredder on the floor beside the return
  const shredX = 1.07, shredZ = 0.82;
  const shredder = new THREE.Group(); scene.add(shredder);
  shredder.userData.use = 'shredder';
  staticBox(0.3, 0.5, 0.24, shredX, 0.25, shredZ, std({ color: '#3c3f42', roughness: 0.5 }), { parent: shredder });
  staticBox(0.31, 0.08, 0.25, shredX, 0.54, shredZ, std({ color: '#26282a', roughness: 0.4 }), { parent: shredder });
  staticBox(0.22, 0.006, 0.012, shredX, 0.583, shredZ, std({ color: '#050505' }), { collide: false, parent: shredder });
  shredder.userData.slot = new THREE.Vector3(shredX, 0.586, shredZ);
  colliders.push({ minX: shredX - 0.15, maxX: shredX + 0.15, minZ: shredZ - 0.12, maxZ: shredZ + 0.12 });

  // ---- Paperwork: stacked letter trays, the spreadsheet stack, loose sheets
  const trayMat = std({ color: '#3a3b3d', roughness: 0.5 });
  const paperMat = std({ map: T.paper(false), roughness: 0.95 });
  const trayX = -1.08, trayZ = -1.08;
  for (let k = 0; k < 3; k++) {
    const y = DT + k * 0.075;
    staticBox(0.26, 0.006, 0.34, trayX, y + 0.003, trayZ, trayMat, { collide: false });
    staticBox(0.006, 0.05, 0.34, trayX - 0.127, y + 0.025, trayZ, trayMat, { collide: false });
    staticBox(0.006, 0.05, 0.34, trayX + 0.127, y + 0.025, trayZ, trayMat, { collide: false });
    staticBox(0.22, 0.012 + k * 0.01, 0.29, trayX, y + 0.012 + k * 0.005, trayZ + 0.01, paperMat, { collide: false });
    [-0.11, 0.11].forEach((dx) => staticBox(0.01, 0.075, 0.01, trayX + dx, y + 0.0375, trayZ + 0.16, trayMat, { collide: false }));
  }
  staticCollider(0.13, 0.11, 0.17, trayX, DT + 0.11, trayZ);
  const stackX = -0.78, stackZ = -0.98;
  const stack = new THREE.Group(); stack.position.set(stackX, DT, stackZ); scene.add(stack);
  stack.userData.dispenser = 'sheet';   // click it to pull a sheet off the top
  const stackMat = paperMat.clone();
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.004, 0.28), stackMat);
    s.position.set((Math.random() - 0.5) * 0.012, 0.002 + i * 0.0042, (Math.random() - 0.5) * 0.012);
    s.rotation.y = (Math.random() - 0.5) * 0.06; s.castShadow = true; s.receiveShadow = true; stack.add(s);
  }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.215, 0.28), std({ map: T.spreadsheet(), roughness: 0.95 }));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.062; stack.add(top);
  staticCollider(0.11, 0.03, 0.14, stackX, DT + 0.03, stackZ);
  [[0.55, -1.02, 0.35, true], [0.98, 0.0, -0.25, false], [-0.55, -1.12, -0.12, true]].forEach(([x, z, r, ss]) => {
    makeSheet(ss ? 'spreadsheet' : 'memo', x, DT + 0.004, z, { rot: [0, r, 0] });
  });
  const spawnSheet = (x, y, z) => makeSheet('spreadsheet', x, y, z);

  // ---- Things on the walls
  const cal = wallPlane(0.36, 0.5, T.calendar(), 'left', -0.12, 1.42); cal.name = 'calendar';   // stuck on the wrong month
  cal.userData.use = 'calendar';
  pin('left', -0.12, 1.66);
  wallPlane(0.5, 0.7, T.poster(), 'left', 0.82, 1.45);                                          // our own motivational poster
  [[0.63, 1.69], [1.01, 1.69]].forEach(([a, y]) => pin('left', a, y));
  staticBox(0.02, 0.66, 0.8, H - 0.01, 1.42, -0.0, std({ color: '#6e5232' }), { collide: false, shadow: false });
  const corkboard = wallPlane(0.8, 0.53, T.corkboard(), 'right', 0.0, 1.42, { inset: 0.0215 }); // corkboard over the return
  corkboard.userData.use = 'corkboard';
  // Pin a sheet to the corkboard at (z, y) on the wall. Returns the pinned group.
  const pinned = [];
  function pinSheet(kind, z, y, tilt) {
    z = THREE.MathUtils.clamp(z, -0.4 + 0.115, 0.4 - 0.115); y = THREE.MathUtils.clamp(y, 1.42 - 0.265 + 0.145, 1.42 + 0.265 - 0.14);
    const face = std({ map: sheetTex[kind] || sheetTex.blank, roughness: 0.95 });
    const grp = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.002, 0.28), [sheetEdge, sheetEdge, face, face, sheetEdge, sheetEdge]);
    m.castShadow = true; m.receiveShadow = true;
    const tack = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), pinMat); tack.position.set(0, 0.006, -0.12);
    grp.add(m, tack);
    grp.quaternion.copy(wallQuat('right', tilt));
    grp.position.set(H - 0.0215 - 0.004 - pinned.length * 0.0012, y, z);
    scene.add(grp);
    const rec = { kind, z, y, tilt, group: grp };
    pinned.push(rec);
    return rec;
  }
  function unpinOldest() { const r = pinned.shift(); if (r) scene.remove(r.group); }
  // pinned memos: pull them off the wall (the pin stays behind)
  [['back', 0.28, 1.2, 0.04], ['back', 1.08, 1.32, -0.03], ['front', 0.15, 1.4, 0.02]].forEach(([wall, a, y, tilt]) => {
    const pos = { back: [a, y, -H + 0.006], front: [a, y, H - 0.006] }[wall];
    makeSheet('memo', pos[0], pos[1], pos[2], { quat: wallQuat(wall, tilt), stuck: true });
    pin(wall, a, y + 0.12);
  });

  // ---- Wall clock (back wall, right of the shelf)
  const clock = new THREE.Group(); clock.position.set(0.72, 1.95, -H + 0.03); scene.add(clock);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 40), std({ color: '#2b2b2b', roughness: 0.4 }));
  rim.rotation.x = Math.PI / 2; clock.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.145, 40), std({ map: T.clockFace(), roughness: 0.7 }));
  face.position.z = 0.021; clock.add(face);
  const hand = (len, w, color, z) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.003), std({ color }));
    m.position.y = len / 2 - 0.015; g.add(m); g.position.z = z; clock.add(g); return g;
  };
  const hourHand = hand(0.08, 0.012, '#111', 0.024);
  const minHand = hand(0.12, 0.008, '#111', 0.027);
  const secHand = hand(0.13, 0.003, '#b22', 0.03);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.15, 40), new THREE.MeshStandardMaterial({ color: '#fff', transparent: true, opacity: 0.08, roughness: 0.05 }));
  glass.position.z = 0.034; clock.add(glass);

  // ---- Wire mesh trash can (hollow, so things can land in it)
  // in the back-left corner (behind you on the left as you face the desk), out in the open: spin the chair to see it
  const canX = -1.1, canZ = 1.1, canR = 0.155, canH = 0.33;
  const meshTex = T.wireMesh();
  const canGroup = new THREE.Group();
  const can = new THREE.Mesh(new THREE.CylinderGeometry(canR + 0.015, canR - 0.02, canH, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: '#1d1d1d', alphaMap: meshTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 }));
  can.position.y = canH / 2; canGroup.add(can);
  const canRim = new THREE.Mesh(new THREE.TorusGeometry(canR + 0.015, 0.006, 6, 32), std({ color: '#1d1d1d', metalness: 0.6, roughness: 0.4 }));
  canRim.rotation.x = Math.PI / 2; canRim.position.y = canH; canGroup.add(canRim);
  const canBase = new THREE.Mesh(new THREE.CircleGeometry(canR - 0.02, 28), std({ color: '#1d1d1d', side: THREE.DoubleSide }));
  canBase.rotation.x = -Math.PI / 2; canBase.position.y = 0.006; canGroup.add(canBase);
  const canShapes = [];
  const segs = 12;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const q = new CANNON.Quaternion(); q.setFromEuler(0, -a, 0);
    canShapes.push([new CANNON.Box(new CANNON.Vec3(0.006, canH / 2, (Math.PI * canR) / segs + 0.004)), new CANNON.Vec3(Math.cos(a) * canR, canH / 2, Math.sin(a) * canR), q]);
  }
  canShapes.push([new CANNON.Cylinder(canR - 0.01, canR - 0.01, 0.012, 12), new CANNON.Vec3(0, 0.006, 0), new CANNON.Quaternion()]);
  const canProp = addProp('trashCan', canGroup, null, 0.9, canX, 0.001, canZ, { shapes: canShapes, sound: 'metal', linDamp: 0.15, angDamp: 0.5 });
  const trashCan = { get x() { return canProp.body.position.x; }, get z() { return canProp.body.position.z; }, r: canR, h: canH, prop: canProp };

  // ---- Rolling chair
  const chair = new THREE.Group(); scene.add(chair);
  const chairFabric = std({ color: '#33415e', roughness: 1 });
  const chairBlack = std({ color: '#1b1b1d', roughness: 0.5, metalness: 0.3 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.08, 0.46), chairFabric); seat.position.y = 0.48; chair.add(seat);
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.07), chairFabric); backrest.position.set(0, 0.86, 0.22); backrest.rotation.x = -0.08; chair.add(backrest);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.03), chairBlack); spine.position.set(0, 0.62, 0.24); chair.add(spine);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 10), chairBlack); post.position.y = 0.3; chair.add(post);
  [-1, 1].forEach((s) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.26), chairBlack); arm.position.set(s * 0.25, 0.68, 0.02); chair.add(arm);
    const armPost = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), chairBlack); armPost.position.set(s * 0.25, 0.58, 0.05); chair.add(armPost);
  });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.3), chairBlack);
    spoke.position.set(Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15); spoke.rotation.y = a; chair.add(spoke);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), chairBlack);
    wheel.position.set(Math.sin(a) * 0.29, 0.028, Math.cos(a) * 0.29); chair.add(wheel);
  }
  // the recline lever, at the front-right corner of the seat
  const lever = new THREE.Group(); lever.position.set(0.3, 0.47, -0.2); chair.add(lever);
  const leverArm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.16), std({ color: '#1b1b1d', roughness: 0.5, metalness: 0.3 })); leverArm.position.set(0, 0, -0.04); lever.add(leverArm);
  const leverKnob = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.028, 0.07), std({ color: '#8a2f2a', roughness: 0.5 })); leverKnob.position.set(0, 0.004, -0.14); lever.add(leverKnob);
  lever.userData.use = 'lever';
  chair.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  chair.userData.chair = true;
  const chairBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: physMat, collisionFilterGroup: GROUP.PLAYER, collisionFilterMask: GROUP.PROP });
  chairBody.addShape(new CANNON.Box(new CANNON.Vec3(0.24, 0.04, 0.23)), new CANNON.Vec3(0, 0.48, 0));
  chairBody.addShape(new CANNON.Box(new CANNON.Vec3(0.22, 0.25, 0.035)), new CANNON.Vec3(0, 0.86, 0.22));
  world.addBody(chairBody);

  // a couple of paper balls someone already crumpled
  const ballMat = std({ color: '#efece4', roughness: 1 });
  function crumpleGeo(r) {
    // merge shared corners first so the dents don't tear the surface apart
    let g = new THREE.IcosahedronGeometry(r, 2);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = mergeVertices(g);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      v.multiplyScalar(0.82 + Math.random() * 0.3);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g = g.toNonIndexed();
    g.computeVertexNormals();
    return g;
  }
  [[-0.6, -0.8], [-0.56, -0.66]].forEach(([x, z], i) => {
    const m = new THREE.Mesh(crumpleGeo(0.038), ballMat);
    m.material = ballMat.clone(); m.material.flatShading = true;
    addBall(m, x, DT + 0.04, z);
  });

  // pencils (in a cup)
  const cupX = 0.28, cupZ = -1.12;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 18, 1, true), std({ color: '#2a2a2a', side: THREE.DoubleSide, roughness: 0.4, metalness: 0.4 }));
  cup.position.set(cupX, DT + 0.05, cupZ); cup.castShadow = true; scene.add(cup);
  cup.userData.use = 'pencils';
  const cupBody = new CANNON.Body({ mass: 0, material: physMat });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2; const q = new CANNON.Quaternion(); q.setFromEuler(0, -a, 0);
    cupBody.addShape(new CANNON.Box(new CANNON.Vec3(0.004, 0.05, 0.017)), new CANNON.Vec3(Math.cos(a) * 0.038, 0.05, Math.sin(a) * 0.038), q);
  }
  cupBody.addShape(new CANNON.Box(new CANNON.Vec3(0.035, 0.003, 0.035)), new CANNON.Vec3(0, 0.003, 0));
  cupBody.position.set(cupX, DT, cupZ); world.addBody(cupBody);
  function pencilMesh(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.16, 6), std({ color, roughness: 0.6 }));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.022, 6), std({ color: '#e3c9a0' }));
    tip.position.y = 0.091;
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.0016, 0.007, 6), std({ color: '#222' }));
    lead.position.y = 0.1;
    const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.0047, 0.0047, 0.016, 8), std({ color: '#d98c8c' }));
    eraser.position.y = -0.088;
    g.add(body, tip, lead, eraser);
    return g;
  }
  [['#e8b923', 0.012, 0.0], ['#e8b923', -0.012, 0.01], ['#3d6fb0', 0.0, -0.014]].forEach(([c, dx, dz], i) => {
    addProp(i === 2 ? 'pen' : 'pencil', pencilMesh(c), new CANNON.Cylinder(0.0045, 0.0045, 0.2, 6), 0.008,
      cupX + dx, DT + 0.11, cupZ + dz, { sound: 'pencil', rot: [0.12 * (i - 1), 0, 0.1 * (i - 1)] });
  });

  // stapler
  const stapler = new THREE.Group();
  const sBase = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.018, 0.16), std({ color: '#2a2a2a', roughness: 0.4, metalness: 0.3 }));
  sBase.position.y = -0.016;
  const sTop = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.026, 0.155), std({ color: '#a8322d', roughness: 0.35 }));
  sTop.position.set(0, 0.008, -0.004); sTop.rotation.x = 0.04;
  stapler.add(sBase, sTop);
  addProp('stapler', stapler, new CANNON.Box(new CANNON.Vec3(0.0225, 0.025, 0.08)), 0.32, 0.42, DT + 0.03, -0.9, { sound: 'heavy', rot: [0, 0.4, 0] });

  // coffee mug (cold, old coffee)
  const mug = new THREE.Group();
  const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.038, 0.095, 20, 1, true), std({ color: '#d9a830', roughness: 0.3, side: THREE.DoubleSide }));
  const mugBottom = new THREE.Mesh(new THREE.CircleGeometry(0.038, 20), std({ color: '#d9a830' })); mugBottom.rotation.x = Math.PI / 2; mugBottom.position.y = -0.047;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.037, 20), std({ color: '#2a1a10', roughness: 0.1 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.02;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 16, Math.PI), std({ color: '#d9a830', roughness: 0.3 }));
  handle.rotation.z = -Math.PI / 2; handle.position.x = 0.04;
  mug.add(mugBody, mugBottom, coffee, handle);
  addProp('mug', mug, new CANNON.Cylinder(0.04, 0.04, 0.095, 12), 0.3, -0.8, DT + 0.05, -0.68, { sound: 'ceramic' });

  return {
    props, colliders, chair, chairBody, clock: { hourHand, minHand, secHand, group: clock }, trashCan, physMat,
    detectorLed: ledMat, panels, GROUP, impact, spawnSheet, dispensers: [stack], makeCrumple, addBall, addPlane, lever, pencilCup: cup, detector, removeProp, shredder, calendar: cal, computer, screen, printerOut, corkboard, pinSheet, pinned, unpinOldest, makeSheet,
    monitorView: { x: monX, y: monY + 0.01, z: monFront + 0.001, h: 0.265 }, stackTop: new THREE.Vector3(stackX, DT + 0.07, stackZ),
  };
}
