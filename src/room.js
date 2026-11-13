// The cubicle: static furniture, physics colliders and the props. Only loose paper can be picked up.
// Units are meters. The desk sits against the back wall (-Z). The player starts seated, facing -Z.
// The detail pass: everything here is built from src/props.js and the relief maps in src/textures.js.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as T from './textures.js';
import * as P from './props.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// wallH is how tall the panels look; nothing gets out over them (there's an invisible lid up to the ceiling)
export const ROOM = { half: 1.35, wallH: 2.0, wallT: 0.06, deskTop: 0.74, ceilingY: 3.2, pitch: 2.82 };

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0, ...o });

export function buildRoom(scene, world) {
  const props = [];      // { name, mesh, body, sound }
  const colliders = [];
  const usables = [];    // things you can click: each has userData.use
  const examinables = []; // things you can pick up and turn over with E
  const H = ROOM.half;
  const DT = ROOM.deskTop;
  const k = P.makeKit();
  const { m, at } = k;

  const physMat = new CANNON.Material('default');

  function staticBox(w, h, d, x, y, z, mat, { collide = true, shadow = true, parent = scene, rotY = 0, r = 0 } = {}) {
    const mesh = new THREE.Mesh(r > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01)) : new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    parent.add(mesh);
    if (collide) staticCollider(w / 2, h / 2, d / 2, x, y, z, rotY);
    return mesh;
  }
  function staticCollider(hx, hy, hz, x, y, z, rotY = 0) {
    const body = new CANNON.Body({ mass: 0, material: physMat });
    body.addShape(new CANNON.Box(new CANNON.Vec3(hx, hy, hz)));
    body.position.set(x, y, z); body.quaternion.setFromEuler(0, rotY, 0); world.addBody(body);
  }
  // a finished prop from props.js: put it in the room. `col` = [halfW, halfH, halfD] adds a simple collider.
  function place(obj, x, y, z, rotY = 0, { col = null, parent = scene, cast = true } = {}) {
    obj.position.set(x, y, z); obj.rotation.y = rotY;
    k.shadow(obj, cast); parent.add(obj);
    if (col) staticCollider(col[0], col[1], col[2], x, y + col[1], z, rotY);
    return obj;
  }
  // give an object its own materials (so it can glow on hover without lighting up its neighbors) and mark what it's for
  function own(obj) {
    const seen = new Map();
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const cl = (mat) => { if (!seen.has(mat)) seen.set(mat, mat.clone()); return seen.get(mat); };
      o.material = Array.isArray(o.material) ? o.material.map(cl) : cl(o.material);
    });
    return obj;
  }
  // an unseen box around something spindly (wire cages, thin rods), so the dot doesn't have to land on a wire
  const hitMat = new THREE.MeshBasicMaterial();
  function hitbox(obj, w, h, d, x = 0, y = 0, z = 0) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat); b.position.set(x, y, z); b.visible = false; b.userData.hitbox = true; obj.add(b); }
  function usable(obj, use, extra = {}) { own(obj); obj.userData.use = use; Object.assign(obj.userData, extra); usables.push(obj); return obj; }
  function examinable(obj, name, size = 0.2) { if (!obj.userData.use) own(obj); obj.userData.examine = { name, size }; examinables.push(obj); return obj; }

  // a flat picture/paper hung on a wall. wall: 'back' (-Z), 'front' (+Z), 'left' (-X), 'right' (+X)
  function wallPlane(w, h, map, wall, a, y, { tilt = 0, inset = 0.004, mat = null } = {}) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat || std({ map, roughness: 0.9 }));
    if (wall === 'back') { mesh.position.set(a, y, -H + inset); }
    if (wall === 'front') { mesh.position.set(a, y, H - inset); mesh.rotation.y = Math.PI; }
    if (wall === 'left') { mesh.position.set(-H + inset, y, a); mesh.rotation.y = Math.PI / 2; }
    if (wall === 'right') { mesh.position.set(H - inset, y, a); mesh.rotation.y = -Math.PI / 2; }
    mesh.rotation.z = tilt; mesh.receiveShadow = true; scene.add(mesh);
    return mesh;
  }
  const pinMat = std({ color: '#c0392b', roughness: 0.3 });
  function pin(wall, a, y) {
    const p = new THREE.Group();
    p.add(at(k.cyl(0.0012, 0.0012, 0.012, m.steel, 5), 0, 0, 0.004, Math.PI / 2), at(new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 8), pinMat), 0, 0, 0.011));
    const yaw = { back: 0, front: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[wall];
    p.rotation.y = yaw;
    if (wall === 'back') p.position.set(a, y, -H);
    if (wall === 'front') p.position.set(a, y, H);
    if (wall === 'left') p.position.set(-H, y, a);
    if (wall === 'right') p.position.set(H, y, a);
    scene.add(p);
  }

  // ---- Grabbable props -------------------------------------------------------
  const GROUP = { WORLD: 1, PROP: 2, PLAYER: 4 };
  const impact = { fn: null };
  function addProp(name, mesh, shape, mass, x, y, z, { sound = 'thunk', rot = null, quat = null, linDamp = 0.05, angDamp = 0.2, offset = null, shapes = null, stuck = false, grab = false, kind = null } = {}) {
    const fixed = stuck || !grab;   // only loose paper moves; the rest of the cubicle stays put
    mesh.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      o.material = Array.isArray(o.material) ? o.material.map((mm) => mm.clone()) : o.material.clone(); // own materials, so it can glow on hover
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
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.002, 0.28), [sheetEdge, sheetEdge, face, face, sheetEdge, sheetEdge]);
    return addProp(kind === 'memo' ? 'memo' : 'sheet', mesh, new CANNON.Box(new CANNON.Vec3(0.1075, 0.003, 0.14)), 0.006, x, y, z,
      { sound: 'paper', linDamp: 0.55, angDamp: 0.6, grab: true, kind, ...opts });
  }
  // A sheet being crumpled in your hands: set(0) is the flat sheet, set(1) is a tight paper ball.
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
      const u = x / 0.215 + 0.5, w = z / 0.28 + 0.5;
      const th = u * Math.PI * 2, ph = 0.25 + w * (Math.PI - 0.5);
      const r = BALL_R * (0.84 + Math.random() * 0.28);
      const bx = r * Math.sin(ph) * Math.cos(th), by = r * Math.cos(ph), bz = r * Math.sin(ph) * Math.sin(th);
      ball[i * 3] = bx; ball[i * 3 + 1] = by; ball[i * 3 + 2] = bz;
      mid[i * 3] = (x * 0.5 + bx) * 0.75 + (Math.random() - 0.5) * 0.012;
      mid[i * 3 + 1] = by * 0.8 + (Math.random() - 0.5) * 0.02;
      mid[i * 3 + 2] = (z * 0.45 + bz) * 0.75 + (Math.random() - 0.5) * 0.012;
    }
    const mesh = new THREE.Mesh(g, std({ map: sheetTex[kind] || sheetTex.blank, roughness: 1, side: THREE.DoubleSide, flatShading: true }));
    mesh.castShadow = true;
    const set = (t) => {
      t = THREE.MathUtils.clamp(t, 0, 1);
      const a = pos.array;
      for (let i = 0; i < a.length; i++) a[i] = t < 0.5 ? flat[i] + (mid[i] - flat[i]) * (t * 2) : mid[i] + (ball[i] - mid[i]) * (t * 2 - 1);
      pos.needsUpdate = true;
      if (t >= 1) g.computeBoundingSphere();
    };
    return { mesh, set };
  }
  // a folded paper airplane (a simple dart): nose toward -Z
  function addPlane(x, y, z) {
    const v = [
      0, 0, -0.14,   0, 0.004, 0.1,   -0.09, 0.018, 0.1,
      0, 0, -0.14,   0.09, 0.018, 0.1,   0, 0.004, 0.1,
      0, 0, -0.14,   0, 0.004, 0.1,   0, -0.035, 0.085,
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, std({ color: '#f4f1e8', roughness: 1, side: THREE.DoubleSide, flatShading: true }));
    return addProp('plane', mesh, new CANNON.Box(new CANNON.Vec3(0.06, 0.012, 0.11)), 0.006, x, y, z, { sound: 'paper', linDamp: 0.6, angDamp: 0.7, grab: true, kind: 'plane' });
  }
  function addBall(mesh, x, y, z) {
    return addProp('paperBall', mesh, new CANNON.Sphere(BALL_R), 0.012, x, y, z, { sound: 'paper', linDamp: 0.12, angDamp: 0.75, grab: true });
  }
  function wallQuat(wall, tilt = 0) {
    const yaw = { back: 0, front: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[wall];
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tilt));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    return q;
  }

  // ================================================================================== the building
  const FAR = 30;                       // the floor and ceiling run this far in every direction
  const { wallH: WH, wallT: WT, pitch: PITCH } = ROOM;

  // ---- Floor: carpet tiles
  const carpetMap = T.carpetTile(); carpetMap.repeat.set(FAR * 4, FAR * 4);
  const carpetN = T.carpetNormal(); carpetN.repeat.set(FAR * 4, FAR * 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FAR * 2, FAR * 2), std({ map: carpetMap, normalMap: carpetN, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const floorBody = new CANNON.Body({ mass: 0, material: physMat });
  floorBody.addShape(new CANNON.Plane());
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floorBody);
  // clear plastic chair mat: it catches the ceiling lights
  const matShape = new THREE.Shape(); const mw = 0.62, md = 0.6, mr = 0.06;
  matShape.moveTo(-mw + mr, -md); matShape.lineTo(mw - mr, -md); matShape.quadraticCurveTo(mw, -md, mw, -md + mr); matShape.lineTo(mw, md - mr); matShape.quadraticCurveTo(mw, md, mw - mr, md);
  matShape.lineTo(-mw + mr, md); matShape.quadraticCurveTo(-mw, md, -mw, md - mr); matShape.lineTo(-mw, -md + mr); matShape.quadraticCurveTo(-mw, -md, -mw + mr, -md);
  const chairMat = new THREE.Mesh(new THREE.ShapeGeometry(matShape), new THREE.MeshPhysicalMaterial({ color: '#c9d2d6', roughness: 0.16, roughnessMap: T.smudges(120, 2), transparent: true, opacity: 0.3, envMapIntensity: 1.3 }));
  chairMat.rotation.x = -Math.PI / 2; chairMat.position.set(-0.25, 0.004, 0.02); chairMat.receiveShadow = true; scene.add(chairMat);

  // ---- Walls: fabric panels in a metal frame, a rounded cap on top, a wiring raceway along the floor
  const fabricMap = T.fabricPanel(); fabricMap.repeat.set(7, 5);
  const fabricN = T.fabricNormal(); fabricN.repeat.set(34, 24);
  const wallMat = std({ map: fabricMap, normalMap: fabricN, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 1 });
  const trimMat = std({ color: '#8f9290', roughness: 0.42, metalness: 0.7, normalMap: T.brushedNormal(3), normalScale: new THREE.Vector2(0.3, 0.3) });
  const racewayMat = k.plastic('#4c4f52', 0.6);
  const lidH = ROOM.ceilingY;
  [
    [2 * H + 2 * WT, WT, 0, -H - WT / 2],
    [2 * H + 2 * WT, WT, 0, H + WT / 2],
    [WT, 2 * H, -H - WT / 2, 0],
    [WT, 2 * H, H + WT / 2, 0],
  ].forEach(([w, d, x, z]) => {
    staticBox(w, WH, d, x, WH / 2, z, wallMat, { collide: false });
    staticCollider(w / 2, lidH / 2, d / 2, x, lidH / 2, z);                       // the wall you can see, plus air above it that nothing gets through
    staticBox(w + 0.02, 0.035, d + 0.02, x, WH + 0.012, z, trimMat, { collide: false, r: 0.012 });
  });
  // frame posts where the panels meet and in the corners, and the raceway
  const post = (x, z, alongX) => staticBox(alongX ? 0.03 : 0.012, WH, alongX ? 0.012 : 0.03, x, WH / 2, z, trimMat, { collide: false, shadow: false });
  [-0.45, 0.45].forEach((a) => { post(a, -H + 0.005, true); post(a, H - 0.005, true); post(-H + 0.005, a, false); post(H - 0.005, a, false); });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => staticBox(0.03, WH, 0.03, sx * (H - 0.012), WH / 2, sz * (H - 0.012), trimMat, { collide: false, shadow: false }));
  staticBox(2 * H, 0.11, 0.022, 0, 0.055, H - 0.011, racewayMat, { collide: false, shadow: false, r: 0.006 });
  staticBox(0.022, 0.11, 2 * H, -H + 0.011, 0.055, 0, racewayMat, { collide: false, shadow: false, r: 0.006 });
  staticBox(0.022, 0.11, 0.9, H - 0.011, 0.055, 0.9, racewayMat, { collide: false, shadow: false, r: 0.006 });
  const outletMat = std({ map: T.wallOutlet(), roughness: 0.5 });
  [['left', 0.55], ['front', -0.6], ['left', -0.75]].forEach(([wall, a]) => wallPlane(0.07, 0.105, null, wall, a, 0.34, { mat: outletMat, inset: 0.002 }));
  // physics lid just under the ceiling so nothing escapes (invisible)
  staticCollider(H + 1, 0.05, H + 1, 0, ROOM.ceilingY - 0.05, 0);

  // ---- Drop ceiling: acoustic tiles in a T-bar grid, fluorescent troffers, vents, sprinklers, the "smoke detector"
  const CY = ROOM.ceilingY;
  const tiles = (FAR * 2) / 0.6;
  const ceilTex = T.ceilingTiles(); ceilTex.repeat.set(tiles, tiles);
  const ceilN = T.ceilingNormal(); ceilN.repeat.set(tiles, tiles);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(FAR * 2, FAR * 2), std({ map: ceilTex, normalMap: ceilN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 1, emissive: '#3a3a37', emissiveMap: ceilTex, emissiveIntensity: 0.5 }));
  ceiling.material.userData.keepEmissive = true;
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = CY; scene.add(ceiling);
  // light fixtures: one every 3.6 m, as far as you can see. A few are dimmer; one, far off, flickers.
  const lensMat = new THREE.MeshBasicMaterial({ map: T.lightLens(), color: new THREE.Color(2.5, 2.6, 2.8) });   // brighter than white, so it blooms
  const nL = 9, panelPos = [];
  for (let i = -Math.floor(nL / 2); i <= Math.floor(nL / 2); i++) for (let j = -Math.floor(nL / 2); j <= Math.floor(nL / 2); j++) panelPos.push([0.3 + 3.6 * i, 3.6 * j, i, j]);
  const lenses = new THREE.InstancedMesh(new THREE.BoxGeometry(0.56, 0.012, 1.16), lensMat, panelPos.length);
  const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(0.6, 0.02, 1.2), std({ color: '#d6d6d1', roughness: 0.45, metalness: 0.4 }), panelPos.length);
  const mx = new THREE.Matrix4(), col = new THREE.Color();
  let flickerIndex = -1;
  panelPos.forEach(([x, z, i, j], n) => {
    mx.makeTranslation(x, CY - 0.012, z); lenses.setMatrixAt(n, mx);
    mx.makeTranslation(x, CY - 0.004, z); frames.setMatrixAt(n, mx);
    const tired = (i * 7 + j * 13) % 11 === 5 || (i === -2 && j === 3);
    lenses.setColorAt(n, col.setScalar(tired ? 0.45 : 1));
    if (i === 2 && j === -3) flickerIndex = n;
  });
  scene.add(lenses, frames);
  const panels = [lenses];
  const ventMat = std({ color: '#c4c4bf', roughness: 0.5, metalness: 0.3 });
  function vent(x, z) {
    const g = new THREE.Group(); g.position.set(x, CY - 0.004, z); scene.add(g);
    for (let i = 0; i < 4; i++) {                                                   // nested square louvres
      const s = 0.56 - i * 0.13, t = 0.035;
      for (const [w, d, px, pz] of [[s, t, 0, s / 2 - t / 2], [s, t, 0, -s / 2 + t / 2], [t, s, s / 2 - t / 2, 0], [t, s, -s / 2 + t / 2, 0]]) g.add(at(k.box(w, 0.008, d, ventMat), px, -0.006 - i * 0.006, pz));
    }
    g.add(at(k.box(0.5, 0.004, 0.5, std({ color: '#141414' })), 0, 0.001, 0));
  }
  vent(-0.9, 0.9); vent(-4.5, -2.7); vent(6.3, 0.9); vent(2.7, 4.5);
  [[-0.9, -1.5], [2.1, 2.1], [-3.9, 2.1], [2.1, -4.5]].forEach(([x, z]) => {      // sprinkler heads
    const s = new THREE.Group(); s.position.set(x, CY, z); scene.add(s);
    s.add(at(k.cyl(0.035, 0.035, 0.006, m.chrome, 16), 0, -0.003, 0), at(k.cyl(0.006, 0.006, 0.03, m.chrome, 8), 0, -0.02, 0), at(k.cyl(0.016, 0.016, 0.002, m.chrome, 12), 0, -0.036, 0));
  });
  const detector = new THREE.Group(); detector.position.set(-0.25, CY, -0.55); scene.add(detector);
  detector.add(at(k.cyl(0.065, 0.072, 0.012, k.plastic('#ecebe6', 0.45), 28), 0, -0.006, 0), at(k.cyl(0.05, 0.062, 0.03, k.plastic('#ecebe6', 0.45), 28), 0, -0.026, 0));
  detector.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: '#060606', roughness: 0.05 })), 0, -0.04, 0, Math.PI));   // a small dark dome. Smoke detectors don't have those.
  const ledMat = new THREE.MeshStandardMaterial({ color: '#400', emissive: '#ff2a1a', emissiveIntensity: 0 }); ledMat.userData.keepEmissive = true;
  detector.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), ledMat), 0.04, -0.04, 0));

  // ---- The rest of the floor: the same cubicle, again and again, as far as the lights go. None of them has a way in.
  const outside = new THREE.Group(); scene.add(outside);
  const N = 6, cells = [];
  for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) if (i || j) cells.push([i * PITCH, j * PITCH]);
  const farFabric = std({ color: '#7b837e', roughness: 1, emissive: '#7b837e', emissiveIntensity: 0.16 });   // lit by their own ceiling lights, which we don't simulate
  farFabric.userData.keepEmissive = true;
  const span = (2 * N + 1) * PITCH;
  for (let n = -N; n <= N + 1; n++) {
    const c = (n - 0.5) * PITCH;
    for (const alongX of [true, false]) {
      const w = at(k.box(alongX ? span : 0.115, WH - 0.002, alongX ? 0.115 : span, farFabric), alongX ? 0 : c, WH / 2, alongX ? c : 0); w.receiveShadow = true; outside.add(w);
      outside.add(at(k.box(alongX ? span : 0.14, 0.03, alongX ? 0.14 : span, trimMat), alongX ? 0 : c, WH + 0.011, alongX ? c : 0));
    }
  }
  const inst = (geo, mat, fn) => { const im = new THREE.InstancedMesh(geo, mat, cells.length); cells.forEach(([cx, cz], n) => { fn(cx, cz); im.setMatrixAt(n, mx); }); im.receiveShadow = true; outside.add(im); return im; };
  const farDesk = std({ color: '#a39b8a', roughness: 0.6, emissive: '#a39b8a', emissiveIntensity: 0.2 });
  inst(new THREE.BoxGeometry(2 * H, 0.035, 0.8), farDesk, (cx, cz) => mx.makeTranslation(cx, DT - 0.0175, cz - 0.95));
  inst(new THREE.BoxGeometry(0.75, 0.035, 1.05), farDesk, (cx, cz) => mx.makeTranslation(cx + 0.975, DT - 0.0175, cz - 0.025));
  inst(new THREE.BoxGeometry(0.44, 0.4, 0.42), m.beige, (cx, cz) => mx.makeTranslation(cx - 0.25, DT + 0.24, cz - 1.0));
  inst(new THREE.BoxGeometry(0.35, 0.27, 0.01), std({ color: '#0b0d0e', roughness: 0.1 }), (cx, cz) => mx.makeTranslation(cx - 0.25, DT + 0.25, cz - 0.787));
  inst(new THREE.BoxGeometry(0.48, 0.09, 0.46), std({ color: '#34425f', roughness: 1 }), (cx, cz) => mx.makeTranslation(cx - 0.25, 0.49, cz - 0.1));
  inst(new THREE.BoxGeometry(0.44, 0.5, 0.08), std({ color: '#34425f', roughness: 1 }), (cx, cz) => mx.makeTranslation(cx - 0.25, 0.88, cz + 0.14));
  inst(new THREE.BoxGeometry(0.42, 0.2, 0.46), m.beige, (cx, cz) => mx.makeTranslation(cx + 1.0, DT + 0.1, cz + 0.2));
  inst(new THREE.CylinderGeometry(0.041, 0.038, 0.095, 12), m.yellow, (cx, cz) => mx.makeTranslation(cx - 0.8, DT + 0.048, cz - 0.68));   // the same yellow mug. On every desk.
  // structural columns, and the dark edge of the floor
  const colMat = std({ color: '#b9b8b2', roughness: 0.9 });
  for (const cx of [-2.5, 0.5, 3.5]) for (const cz of [-2.5, 0.5, 3.5]) { if (cx === 0.5 && cz === 0.5) continue; outside.add(at(k.box(0.5, CY, 0.5, colMat), cx * PITCH, CY / 2, cz * PITCH)); }
  const edgeMat = std({ color: '#3c4043', roughness: 1 });
  const edge = span / 2 + 0.4;
  for (const [x, z, ry] of [[0, -edge, 0], [0, edge, Math.PI], [-edge, 0, Math.PI / 2], [edge, 0, -Math.PI / 2]]) outside.add(at(k.plane(span + 1, CY, edgeMat), x, CY / 2, z, 0, ry));

  // ================================================================================== the desk
  const deskMap = T.deskLaminate();
  const deskMat = std({ map: deskMap, roughness: 0.42, roughnessMap: T.smudges(125, 1) });
  const edgeMat2 = k.plastic('#3c3835', 0.55);
  const panelMat = k.plastic('#8d8b84', 0.7);
  const backZ1 = -0.55;                  // front edge of the back desk
  const retX0 = 0.6, retZ1 = 0.5;        // inner edge + far end of the return
  // tops (colliders exactly as before), each with a dark rounded T-molding along the edges you can see
  staticBox(2 * H, 0.035, H + backZ1, 0, DT - 0.0175, (-H + backZ1) / 2, deskMat);
  staticBox(H - retX0, 0.035, retZ1 - backZ1, (retX0 + H) / 2, DT - 0.0175, (backZ1 + retZ1) / 2, deskMat);
  staticBox(retX0 + H + 0.006, 0.039, 0.014, (-H + retX0) / 2, DT - 0.0175, backZ1 + 0.005, edgeMat2, { collide: false, r: 0.006 });
  staticBox(0.014, 0.039, retZ1 - backZ1 + 0.006, retX0 - 0.005, DT - 0.0175, (backZ1 + retZ1) / 2 + 0.006, edgeMat2, { collide: false, r: 0.006 });
  staticBox(H - retX0, 0.039, 0.014, (retX0 + H) / 2, DT - 0.0175, retZ1 + 0.005, edgeMat2, { collide: false, r: 0.006 });
  // supports: left end panel, return end panel, modesty panel, steel brackets
  staticBox(0.025, DT - 0.035, H + backZ1 - 0.03, -H + 0.0125, (DT - 0.035) / 2, (-H + backZ1) / 2, panelMat);
  staticBox(H - retX0, DT - 0.035, 0.025, (retX0 + H) / 2, (DT - 0.035) / 2, retZ1 - 0.0125, panelMat);
  staticBox(2 * H - 0.05, 0.42, 0.02, 0, DT - 0.25, -H + 0.02, panelMat, { collide: false });
  [-0.9, 0.0, 0.5].forEach((x) => { staticBox(0.03, 0.03, 0.5, x, DT - 0.05, -H + 0.28, trimMat, { collide: false }); });
  // cable grommet behind the monitor, with the cords going down through it
  place(at(k.cyl(0.035, 0.035, 0.004, m.black, 24), 0, 0, 0), 0.02, DT + 0.002, -1.22, 0, { cast: false });
  scene.add(k.shadow(k.tube([[-0.2, DT + 0.03, -1.2], [-0.08, DT + 0.012, -1.24], [0.0, DT + 0.006, -1.225], [0.02, DT - 0.05, -1.22]], 0.005, m.black, 24, 6)));
  scene.add(k.shadow(k.tube([[-0.3, DT + 0.03, -1.22], [-0.12, DT + 0.01, -1.27], [0.01, DT + 0.006, -1.235], [0.025, DT - 0.05, -1.225]], 0.0035, m.beigeDark, 24, 6)));

  // drawer pedestal under the end of the return: three drawers that open (toward the chair)
  const pedW = H - retX0 - 0.08, pedX = (retX0 + H) / 2 + 0.03, pedZ = retZ1 - 0.25, pedFace = pedX - pedW / 2;
  staticBox(pedW, 0.66, 0.42, pedX, 0.33 + 0.01, pedZ, panelMat);
  colliders.push({ minX: pedFace, maxX: H, minZ: pedZ - 0.21, maxZ: retZ1 });
  colliders.push({ minX: -H, maxX: H, minZ: -H, maxZ: backZ1, desk: true });
  colliders.push({ minX: retX0, maxX: H, minZ: backZ1, maxZ: retZ1, desk: true });
  const drawers = [];
  const drawerInside = k.plastic('#6f6d67', 0.8), manila = std({ color: '#d9c58c', roughness: 0.9 });
  [[0.585, 0.13], [0.435, 0.13], [0.2, 0.3]].forEach(([cy, hh], i) => {
    const d = new THREE.Group(); d.position.set(pedFace, cy + 0.01, pedZ); scene.add(d);
    const front = new THREE.Group(); d.add(front);
    front.add(at(k.rbox(0.02, hh - 0.012, 0.4, 0.004, panelMat), -0.008, 0, 0));
    front.add(at(k.rbox(0.012, 0.012, 0.16, 0.004, m.steel), -0.03, 0.01, 0), at(k.box(0.014, 0.01, 0.01, m.steel), -0.022, 0.01, -0.07), at(k.box(0.014, 0.01, 0.01, m.steel), -0.022, 0.01, 0.07));
    if (i === 0) front.add(at(k.cyl(0.007, 0.007, 0.004, m.chrome, 12), -0.019, 0.03, 0.14, 0, 0, Math.PI / 2));   // lock
    usable(front, 'drawer', { index: i });
    // the tray behind the front, and what's in it
    const tray = new THREE.Group(); d.add(tray);
    const L = 0.36, hw = 0.185, th = hh - 0.03;
    tray.add(at(k.box(L, 0.006, hw * 2, drawerInside), L / 2, -th / 2, 0), at(k.box(L, th, 0.006, drawerInside), L / 2, 0, hw), at(k.box(L, th, 0.006, drawerInside), L / 2, 0, -hw), at(k.box(0.006, th, hw * 2, drawerInside), L, 0, 0));
    const fy = -th / 2 + 0.004;
    if (i === 0) {
      // the junk drawer: pens, clips, a rubber band ball, and a stack of badges nobody has filled in
      for (let n = 0; n < 4; n++) tray.add(at(k.cyl(0.004, 0.004, 0.14, n % 2 ? m.red : m.black, 8), 0.07 + n * 0.012, fy + 0.004, -0.1 + n * 0.004, Math.PI / 2, 0, 0.05 * n));
      for (let n = 0; n < 9; n++) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0009, 4, 12), m.steel); c.scale.x = 0.45; c.rotation.set(Math.PI / 2, 0, n * 1.7); c.position.set(0.2 + (n % 3) * 0.022, fy + 0.001, 0.09 + Math.floor(n / 3) * 0.02 - (n % 2) * 0.006); tray.add(c); }
      const bandCols = ['#b0553f', '#3f6fb0', '#c9a23a', '#3e7a4f'];
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.026, 1), bandCols.map((c) => std({ color: c, roughness: 0.7 })));
      ball.geometry.clearGroups(); for (let f = 0; f < ball.geometry.attributes.position.count / 3; f++) ball.geometry.addGroup(f * 3, 3, f % 4);
      tray.add(at(ball, 0.27, fy + 0.026, -0.06));
      const badgeTex = T.label([['EMPLOYEE', 30], ['NAME: ____________', 20, 'normal'], ['FLOOR 7', 22]], { w: 256, h: 160, border: true });
      for (let n = 0; n < 5; n++) tray.add(at(k.box(0.085, 0.0015, 0.054, [m.paper, m.paper, std({ map: badgeTex, roughness: 0.5 }), m.paper, m.paper, m.paper]), 0.1 + n * 0.002, fy + 0.001 + n * 0.0016, 0.085, 0, 0.1 * (n - 2)));
    } else if (i === 1) {
      // more of the same photograph
      const photo = std({ map: T.framedPhoto(), roughness: 0.6 }), wood = std({ color: '#4a3526', roughness: 0.5 });
      for (let n = 0; n < 3; n++) {
        const f = new THREE.Group(); f.add(k.box(0.19, 0.012, 0.15, wood), at(k.plane(0.165, 0.125, photo), 0, 0.0065, 0, -Math.PI / 2));
        tray.add(at(f, 0.16 + n * 0.006, fy + 0.006 + n * 0.013, -0.01 + n * 0.008, 0, 0.12 * (n - 1) + Math.PI / 2));
      }
    } else {
      // hanging folders. Every tab is blank.
      for (let n = 0; n < 9; n++) { tray.add(at(k.box(0.003, 0.2, 0.33, manila), 0.04 + n * 0.033, fy + 0.11, 0, 0, 0, 0.04 * ((n % 3) - 1))); tray.add(at(k.box(0.004, 0.012, 0.06, m.paper), 0.04 + n * 0.033, fy + 0.216, -0.12 + (n % 4) * 0.07)); }
    }
    k.shadow(d);
    drawers.push({ group: d, front, x0: pedFace, open: 0, target: 0, index: i, reach: 0.33 });
  });

  // ---- Hutch shelf above the back desk, with binders, and a task light underneath
  const shelfX0 = -H + 0.02, shelfX1 = 0.15, shelfY = 1.48, shelfD = 0.28;
  const shelfCX = (shelfX0 + shelfX1) / 2, shelfCZ = -H + shelfD / 2;
  staticBox(shelfX1 - shelfX0, 0.028, shelfD, shelfCX, shelfY, shelfCZ, deskMat, { r: 0.004 });
  staticBox(shelfX1 - shelfX0 + 0.004, 0.032, 0.012, shelfCX, shelfY, shelfCZ + shelfD / 2 + 0.003, edgeMat2, { collide: false, r: 0.005 });
  [shelfX0 + 0.2, shelfX1 - 0.2].forEach((x) => {
    staticBox(0.022, 0.2, 0.012, x, shelfY - 0.11, -H + 0.008, trimMat, { collide: false });
    const brace = k.box(0.018, 0.008, 0.3, trimMat); brace.position.set(x, shelfY - 0.1, shelfCZ - 0.01); brace.rotation.x = -0.62; brace.castShadow = true; scene.add(brace);
  });
  const taskLight = new THREE.Group(); taskLight.position.set(shelfCX + 0.1, shelfY - 0.014, shelfCZ + 0.04); scene.add(taskLight);
  taskLight.add(at(k.rbox(0.62, 0.03, 0.09, 0.008, k.plastic('#d8d6cf', 0.5)), 0, -0.015, 0));
  const tubeMat = new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff3dc', emissiveIntensity: 2.2 }); tubeMat.userData.keepEmissive = true;
  taskLight.add(at(k.box(0.56, 0.004, 0.05, tubeMat), 0, -0.0315, 0));
  const taskGlow = new THREE.SpotLight('#fff0d6', 2.2, 2.2, 1.15, 0.9, 1.4); taskGlow.position.set(0, -0.04, 0); taskLight.add(taskGlow);
  const taskAim = new THREE.Object3D(); taskAim.position.set(0, -1, 0.25); taskLight.add(taskAim); taskGlow.target = taskAim;
  const binderColors = ['#2f5d8a', '#2f5d8a', '#3e7a4f', '#8f2f2f', '#d8d4c8', '#2f5d8a', '#c9a23a', '#3e7a4f', '#4b3f6b', '#8f2f2f', '#d8d4c8'];
  let bx = shelfX0 + 0.04;
  binderColors.forEach((c, i) => {
    const w = 0.045 + (i % 3) * 0.012;
    const hgt = 0.29 - (i % 4 === 3 ? 0.04 : 0);
    const b = P.binder(k, w, hgt, c, c !== '#d8d4c8');
    place(b, bx + w / 2, shelfY + 0.014, -H + 0.145, 0);
    if (i === 8) b.rotation.z = -0.16;                                             // one has slumped against the gap
    bx += w + 0.006 + (i === 8 ? 0.03 : 0);
  });
  staticCollider((bx - shelfX0) / 2, 0.15, 0.125, (shelfX0 + bx) / 2, shelfY + 0.16, -H + 0.145);
  // a box file lying flat at the end of the shelf; the open space next to it is where something new might appear one day
  place(at(k.rbox(0.3, 0.09, 0.24, 0.006, std({ color: '#c8b89a', roughness: 0.9 })), 0, 0.045, 0), shelfX1 - 0.2, shelfY + 0.014, -H + 0.14, 0, { col: [0.15, 0.045, 0.12] });
  place(at(k.plane(0.1, 0.045, std({ map: T.label([['MISC.', 44]], { w: 256, h: 112, border: true }), roughness: 0.8 })), 0, 0.045, 0.1205), shelfX1 - 0.2, shelfY + 0.014, -H + 0.14, 0, { cast: false });

  // ================================================================================== the computer
  const monX = -0.25, monFront = -0.8;
  const monY = DT + 0.04 + 0.2;
  const computer = new THREE.Group(); scene.add(computer);
  computer.userData.use = 'computer';
  const mon = P.monitor(k, 0.34, 0.265);
  place(mon.group, monX, monY + 0.01, monFront + 0.001, 0, { parent: computer });
  const screen = mon.screen;
  staticCollider(0.22, 0.2, 0.12, monX, monY, monFront - 0.12);
  staticCollider(0.14, 0.12, 0.11, monX, monY - 0.01, monFront - 0.36);
  // sticky notes on the bezel
  [[monX + 0.2, monY + 0.15, 0.12, 0], [monX - 0.205, monY - 0.1, -0.09, 1]].forEach(([x, y, r, kk]) => {
    const face = std({ map: T.stickyNote(kk), roughness: 0.9 }), back = std({ color: '#e6cf55', roughness: 0.9 });
    const n = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.065, 0.001), [back, back, back, back, face, back]);
    n.position.set(x, y, monFront + 0.018); n.rotation.set(0.06, 0, r); n.castShadow = true; scene.add(n);
  });
  place(P.keyboard(k), monX, DT, -0.67, 0, { col: [0.235, 0.014, 0.085] });
  place(at(k.rbox(0.23, 0.004, 0.19, 0.0018, std({ color: '#2d5876', roughness: 0.95 })), 0, 0.002, 0), 0.12, DT, -0.68, 0, { cast: false });
  place(P.mouse(k), 0.12, DT + 0.004, -0.67, 0.12, { col: [0.03, 0.012, 0.05] });
  scene.add(k.shadow(k.tube([[0.115, DT + 0.012, -0.72], [0.14, DT + 0.005, -0.86], [0.06, DT + 0.005, -1.08], [0.03, DT + 0.006, -1.2], [0.022, DT - 0.04, -1.22]], 0.003, m.beigeDark, 30, 5)));
  // tower under the desk, its front toward your knees
  const tower = new THREE.Group();
  tower.add(at(k.rbox(0.2, 0.42, 0.45, 0.012, m.beige), 0, 0.21, 0));
  tower.add(at(k.plane(0.19, 0.41, k.std({ map: T.towerFront(), roughness: 0.5, normalMap: m.beige.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) })), 0, 0.21, 0.2255));
  tower.add(at(k.box(0.009, 0.005, 0.002, m.led('#3ddc6a', 1.5)), 0.021, 0.208, 0.2262));
  place(tower, 0.28, 0, -1.05, 0, { col: [0.1, 0.21, 0.225] });
  colliders.push({ minX: 0.16, maxX: 0.4, minZ: -H, maxZ: -0.81 });
  // power strip and the tangle that goes with it
  const strip = new THREE.Group();
  strip.add(at(k.rbox(0.3, 0.03, 0.055, 0.006, k.plastic('#e4e1d8', 0.5)), 0, 0.015, 0));
  for (let i = 0; i < 5; i++) strip.add(at(k.box(0.03, 0.002, 0.03, m.rubber), -0.1 + i * 0.045, 0.031, 0));
  strip.add(at(k.box(0.014, 0.006, 0.02, m.led('#ff5a2a', 1.4)), 0.13, 0.031, 0));
  place(strip, -0.35, 0, -1.22, 0.05);
  [[[-0.42, 0.04, -1.2], [-0.5, 0.01, -1.05], [-0.2, 0.012, -0.95], [0.1, 0.02, -1.1], [0.2, 0.2, -1.28]], [[-0.3, 0.04, -1.2], [-0.25, 0.3, -1.3], [-0.02, 0.6, -1.24], [0.02, DT - 0.04, -1.22]],
    [[-0.5, 0.03, -1.22], [-0.9, 0.012, -1.26], [-1.25, 0.2, -1.3], [-1.33, 0.34, -0.9]]].forEach((pts, i) => scene.add(k.shadow(k.tube(pts, 0.0045 - i * 0.0006, i === 1 ? m.beigeDark : m.black, 40, 6))));

  // ================================================================================== on the desk
  // phone on the return, near the corner, facing the chair
  const ph = P.phone(k);
  const phoneYaw = -Math.PI / 2 + 0.35;
  place(ph.group, 0.98, DT, -0.32, phoneYaw, { col: [0.1, 0.03, 0.11] });
  usable(ph.group, 'phone');
  // printer on the far end of the return
  const prX = 1.0, prZ = 0.2;
  place(P.printer(k), prX, DT, prZ, 0, { col: [0.21, 0.1, 0.23] });
  staticCollider(0.13, 0.01, 0.15, prX - 0.34, DT + 0.03, prZ);
  const printerOut = { from: new THREE.Vector3(prX - 0.12, DT + 0.046, prZ), to: new THREE.Vector3(prX - 0.345, DT + 0.046, prZ) };

  // paper shredder on the floor beside the return
  const shredX = 1.07, shredZ = 0.82;
  const shredder = P.shredder(k);
  place(shredder, shredX, 0, shredZ, 0, { col: [0.15, 0.29, 0.12] });
  own(shredder); shredder.userData.use = 'shredder';
  shredder.userData.slot = new THREE.Vector3(shredX, 0.586, shredZ);
  colliders.push({ minX: shredX - 0.15, maxX: shredX + 0.15, minZ: shredZ - 0.12, maxZ: shredZ + 0.12 });

  // stacked letter trays, the spreadsheet stack, loose sheets
  const trayMat = k.plastic('#35373a', 0.45);
  const paperMat = std({ map: T.paper(false), roughness: 0.95 });
  const trayX = -1.08, trayZ = -1.08;
  for (let n = 0; n < 3; n++) {
    const y = DT + n * 0.075;
    staticBox(0.26, 0.006, 0.34, trayX, y + 0.003, trayZ, trayMat, { collide: false });
    staticBox(0.006, 0.05, 0.34, trayX - 0.127, y + 0.025, trayZ, trayMat, { collide: false, r: 0.002 });
    staticBox(0.006, 0.05, 0.34, trayX + 0.127, y + 0.025, trayZ, trayMat, { collide: false, r: 0.002 });
    staticBox(0.26, 0.05, 0.006, trayX, y + 0.025, trayZ - 0.167, trayMat, { collide: false, r: 0.002 });
    for (let s = 0; s < 3 + n * 2; s++) { const sh = staticBox(0.215, 0.0035, 0.28, trayX + (Math.sin(s * 7.3 + n) * 0.006), y + 0.008 + s * 0.0036, trayZ + 0.012 + Math.cos(s * 3.1) * 0.006, paperMat, { collide: false }); sh.rotation.y = Math.sin(s * 5.7 + n) * 0.04; }
    [-0.11, 0.11].forEach((dx) => staticBox(0.008, 0.075, 0.008, trayX + dx, y + 0.0375, trayZ + 0.16, m.steel, { collide: false }));
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
  [[0.5, -1.16, 0.1, true], [0.98, 0.0, -0.25, false], [-0.55, -1.12, -0.12, true]].forEach(([x, z, r, ss]) => {
    makeSheet(ss ? 'spreadsheet' : 'memo', x, DT + 0.004, z, { rot: [0, r, 0] });
  });
  const spawnSheet = (x, y, z) => makeSheet('spreadsheet', x, y, z);

  // the mug (cold, old coffee), and the rings it has left over the years
  const mugP = P.mug(k);
  place(mugP.group, -0.8, DT, -0.68, 2.4, { col: [0.04, 0.048, 0.04] });
  usable(mugP.group, 'mug'); examinable(mugP.group, 'mug', 0.12);
  const ringMat = new THREE.MeshBasicMaterial({ map: T.coffeeRing(), transparent: true, depthWrite: false, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
  [[-0.9, -0.6, 0.086], [-0.72, -0.78, 0.09], [0.52, -0.62, 0.084]].forEach(([x, z, s], i) => { const r = k.plane(s, s, ringMat); r.rotation.set(-Math.PI / 2, 0, i * 2.1); r.position.set(x, DT + 0.0006, z); scene.add(r); });

  // desk lamp in the back corner, reaching out over the desk
  const lampP = P.lamp(k);
  place(lampP.group, 0.76, DT, -1.2, 0.7, { col: [0.08, 0.02, 0.08] });
  usable(lampP.group, 'lamp');
  // little desk fan on the return, pointed across the desk
  const fanP = P.fan(k);
  place(fanP.group, 1.17, DT, -0.72, -Math.PI / 2 - 0.5, { col: [0.075, 0.1, 0.065] });
  usable(fanP.group, 'fan'); hitbox(fanP.head, 0.23, 0.23, 0.07, 0, 0, 0.02);
  // stapler, calculator, tape, sticky notes
  const stap = P.stapler(k);
  place(stap.group, 0.42, DT, -0.9, 0.4, { col: [0.025, 0.025, 0.085] });
  usable(stap.group, 'stapler'); examinable(stap.group, 'stapler', 0.2);
  examinable(place(P.calculator(k), 0.44, DT, -0.66, -0.18, { col: [0.04, 0.008, 0.06] }), 'calculator', 0.16);
  examinable(place(P.tapeDispenser(k), 0.63, DT, -0.84, 0.9, { col: [0.07, 0.03, 0.03] }), 'tape', 0.2);
  place(P.stickyPad(k), 0.2, DT, -0.93, 0.2);
  // the framed photo, the nameplate, the desk toy, the tissues
  examinable(place(P.photoFrame(k), 0.07, DT, -1.06, -0.32, { col: [0.1, 0.07, 0.03] }), 'photo', 0.24);
  examinable(place(P.nameplate(k), 0.86, DT, -0.56, -1.05, { col: [0.11, 0.025, 0.03] }), 'nameplate', 0.26);
  const cradleP = P.cradle(k);
  place(cradleP.group, 0.74, DT, -0.16, -Math.PI / 2 + 0.5, { col: [0.085, 0.07, 0.055] });
  usable(cradleP.group, 'cradle'); hitbox(cradleP.group, 0.16, 0.13, 0.09, 0, 0.075, 0);
  place(P.tissueBox(k), 1.25, DT, -0.3, Math.PI / 2, { col: [0.06, 0.04, 0.115] });
  // a few paper clips that never made it back to the drawer
  for (let n = 0; n < 4; n++) { const c = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0009, 4, 12), m.steel); c.scale.x = 0.45; c.rotation.set(Math.PI / 2, 0, n * 2.3); c.position.set(0.31 + n * 0.03 + (n % 2) * 0.012, DT + 0.001, -0.78 - (n % 2) * 0.03); scene.add(c); }

  // archive boxes on the floor, under the left end of the desk
  place(P.archiveBox(k, 'Q3 — 1/2'), -1.02, 0, -0.98, 0.08, { col: [0.165, 0.14, 0.2] });
  place(P.archiveBox(k, 'Q3 — 2/2'), -1.0, 0.265, -1.0, -0.06);
  place(P.archiveBox(k, 'Q3 — 2/2'), -0.62, 0, -1.08, 0.3, { col: [0.165, 0.14, 0.2] });

  // ================================================================================== on the walls
  const cal = wallPlane(0.36, 0.5, T.calendar(), 'left', -0.12, 1.42); cal.name = 'calendar';   // stuck on the wrong month
  cal.userData.use = 'calendar';
  pin('left', -0.12, 1.66);
  // our own motivational poster, in a thin frame behind glass
  const posterG = new THREE.Group(); posterG.position.set(-H + 0.006, 1.42, 0.82); posterG.rotation.y = Math.PI / 2; scene.add(posterG);
  posterG.add(at(k.box(0.54, 0.74, 0.012, std({ color: '#161616', roughness: 0.4 })), 0, 0, 0.004), at(k.plane(0.5, 0.7, std({ map: T.poster(), roughness: 0.7 })), 0, 0, 0.0105));
  const posterGlass = at(k.plane(0.5, 0.7, m.glass), 0, 0, 0.012); posterG.add(posterGlass);
  k.shadow(posterG, false);
  // corkboard over the return, in a wooden frame
  staticBox(0.02, 0.66, 0.8, H - 0.01, 1.42, -0.0, std({ color: '#6e5232', roughness: 0.6 }), { collide: false, shadow: false, r: 0.004 });
  const corkboard = wallPlane(0.8, 0.53, T.corkboard(), 'right', 0.0, 1.42, { inset: 0.0215 });
  corkboard.userData.use = 'corkboard';
  const pinned = [];
  function pinSheet(kind, z, y, tilt) {
    z = THREE.MathUtils.clamp(z, -0.4 + 0.115, 0.4 - 0.115); y = THREE.MathUtils.clamp(y, 1.42 - 0.265 + 0.145, 1.42 + 0.265 - 0.14);
    const face = std({ map: sheetTex[kind] || sheetTex.blank, roughness: 0.95 });
    const grp = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.002, 0.28), [sheetEdge, sheetEdge, face, face, sheetEdge, sheetEdge]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const tack = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), pinMat); tack.position.set(0, 0.006, -0.12);
    grp.add(mesh, tack);
    grp.userData.use = 'corkboard';            // pointing at a pinned sheet still counts as pointing at the board
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
  const clock = new THREE.Group(); clock.position.set(0.72, 1.74, -H + 0.03); scene.add(clock);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.012, 12, 48), k.plastic('#232323', 0.35)); clock.add(rim);
  const clockBack = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.03, 40), k.plastic('#232323', 0.5)); clockBack.rotation.x = Math.PI / 2; clockBack.position.z = -0.012; clock.add(clockBack);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.147, 40), std({ map: T.clockFace(), roughness: 0.7 }));
  face.position.z = 0.004; clock.add(face);
  const hand = (len, w, color, z) => {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.002), std({ color, roughness: 0.4 }));
    mesh.position.y = len / 2 - 0.015; g.add(mesh); g.position.z = z; clock.add(g); return g;
  };
  const hourHand = hand(0.08, 0.012, '#111', 0.008);
  const minHand = hand(0.12, 0.008, '#111', 0.011);
  const secHand = hand(0.13, 0.003, '#b22', 0.014);
  clock.add(at(k.cyl(0.008, 0.008, 0.006, m.black, 12), 0, 0, 0.015, Math.PI / 2));
  const clockGlass = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 10, 0, Math.PI * 2, 0, 0.51), m.glass); clockGlass.rotation.x = Math.PI / 2; clockGlass.position.z = -0.244; clock.add(clockGlass);
  k.shadow(clock); clockGlass.castShadow = false;

  // ---- Wire mesh trash can (hollow, so things can land in it), in the back-left corner
  const canX = -1.1, canZ = 1.1, canR = 0.155, canH = 0.33;
  const meshTex = T.wireMesh();
  const canGroup = new THREE.Group();
  const canMetal = { color: '#1d1d1d', metalness: 0.75, roughness: 0.35 };
  const can = new THREE.Mesh(new THREE.CylinderGeometry(canR + 0.015, canR - 0.02, canH, 36, 1, true),
    new THREE.MeshStandardMaterial({ ...canMetal, alphaMap: meshTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
  can.position.y = canH / 2; canGroup.add(can);
  const canRim = new THREE.Mesh(new THREE.TorusGeometry(canR + 0.015, 0.006, 8, 40), std(canMetal));
  canRim.rotation.x = Math.PI / 2; canRim.position.y = canH; canGroup.add(canRim);
  const canFoot = new THREE.Mesh(new THREE.TorusGeometry(canR - 0.02, 0.006, 8, 40), std(canMetal)); canFoot.rotation.x = Math.PI / 2; canFoot.position.y = 0.006; canGroup.add(canFoot);
  const canBase = new THREE.Mesh(new THREE.CircleGeometry(canR - 0.02, 28), std({ ...canMetal, side: THREE.DoubleSide }));
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

  // ---- The desk plant: not here at first. It turns up on the morning of Day 3, in the corner of the desk.
  const plant = new THREE.Group(); plant.position.set(0.98, DT, -1.02); plant.visible = false; scene.add(plant);
  const potPts = [[0, 0], [0.046, 0], [0.05, 0.004], [0.064, 0.086], [0.07, 0.088], [0.071, 0.104], [0.062, 0.104], [0.058, 0.09], [0, 0.09]].map(([x, y]) => new THREE.Vector2(x, y));
  plant.add(new THREE.Mesh(new THREE.LatheGeometry(potPts, 28), std({ color: '#b5613c', roughness: 0.85, side: THREE.DoubleSide })));
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), std({ color: '#3a2a1e', roughness: 1 })); soil.rotation.x = -Math.PI / 2; soil.position.y = 0.092; plant.add(soil);
  const leafMat = std({ color: '#3f9a4e', roughness: 0.55, side: THREE.DoubleSide });
  const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.bezierCurveTo(0.03, 0.03, 0.035, 0.11, 0, 0.17); leafShape.bezierCurveTo(-0.035, 0.11, -0.03, 0.03, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 8);
  { const lp = leafGeo.attributes.position; for (let i = 0; i < lp.count; i++) lp.setZ(i, -0.045 * (lp.getY(i) / 0.17) ** 2 + 0.012 * Math.abs(lp.getX(i)) / 0.03); leafGeo.computeVertexNormals(); }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + (i % 2) * 0.3, s = 0.75 + (i % 3) * 0.2;
    const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.scale.setScalar(s);
    const stem = new THREE.Group(); stem.position.y = 0.09; stem.rotation.set(0.28 + (i % 3) * 0.24, a, 0, 'YXZ');
    stem.add(leaf); plant.add(stem);
  }
  plant.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // ---- Rolling chair
  const chairP = P.chair(k);
  const chair = chairP.group; scene.add(chair); k.shadow(chair);
  const lever = chairP.lever; own(lever);
  chair.userData.chair = true;
  const chairBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: physMat, collisionFilterGroup: GROUP.PLAYER, collisionFilterMask: GROUP.PROP });
  chairBody.addShape(new CANNON.Box(new CANNON.Vec3(0.24, 0.04, 0.23)), new CANNON.Vec3(0, 0.48, 0));
  chairBody.addShape(new CANNON.Box(new CANNON.Vec3(0.22, 0.25, 0.035)), new CANNON.Vec3(0, 0.86, 0.22));
  world.addBody(chairBody);

  // a couple of paper balls someone already crumpled
  const ballMat = std({ color: '#efece4', roughness: 1 });
  function crumpleGeo(r) {
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
  [[-0.6, -0.8], [-0.56, -0.66]].forEach(([x, z]) => {
    const mesh = new THREE.Mesh(crumpleGeo(0.038), ballMat);
    mesh.material = ballMat.clone(); mesh.material.flatShading = true;
    addBall(mesh, x, DT + 0.04, z);
  });

  // pencils (in a wire-mesh cup)
  const cupX = 0.28, cupZ = -1.12;
  const cup = new THREE.Group(); cup.position.set(cupX, DT, cupZ); scene.add(cup);
  const cupWall = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.1, 24, 1, true), new THREE.MeshStandardMaterial({ ...canMetal, color: '#262626', alphaMap: meshTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
  cupWall.position.y = 0.05; cup.add(cupWall);
  const cupRim = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.003, 6, 28), std({ ...canMetal, color: '#262626' })); cupRim.rotation.x = Math.PI / 2; cupRim.position.y = 0.1; cup.add(cupRim);
  cup.add(at(k.cyl(0.036, 0.036, 0.004, std({ ...canMetal, color: '#262626' }), 20), 0, 0.002, 0));
  k.shadow(cup); own(cup);
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
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.16, 6), std({ color, roughness: 0.45 }));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.022, 6), std({ color: '#e3c9a0' })); tip.position.y = 0.091;
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.0016, 0.007, 6), std({ color: '#222' })); lead.position.y = 0.1;
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.012, 8), std({ color: '#b9b9b0', metalness: 0.8, roughness: 0.3 })); ferrule.position.y = -0.082;
    const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.0046, 0.0046, 0.012, 8), std({ color: '#d98c8c' })); eraser.position.y = -0.093;
    g.add(body, tip, lead, ferrule, eraser);
    return g;
  }
  [['#e8b923', 0.012, 0.0], ['#e8b923', -0.012, 0.01], ['#3d6fb0', 0.0, -0.014]].forEach(([c, dx, dz], i) => {
    addProp(i === 2 ? 'pen' : 'pencil', pencilMesh(c), new CANNON.Cylinder(0.0045, 0.0045, 0.2, 6), 0.008,
      cupX + dx, DT + 0.11, cupZ + dz, { sound: 'pencil', rot: [0.12 * (i - 1), 0, 0.1 * (i - 1)] });
  });
  // scissors and a ruler keep the pencils company
  cup.add(at(k.box(0.022, 0.19, 0.0015, std({ color: '#d9cf9a', roughness: 0.5 })), -0.012, 0.1, -0.012, 0.1, 0.6, -0.08));

  // anything that moves a little on its own: called once a frame
  let flick = 1;
  function tick(t) {
    if (flickerIndex >= 0) {
      const f = (Math.sin(t * 31) > 0.72 || Math.sin(t * 3.3) > 0.94) ? 0.15 : 1;
      if (f !== flick) { flick = f; lenses.setColorAt(flickerIndex, col.setScalar(f)); lenses.instanceColor.needsUpdate = true; }
    }
  }

  return {
    props, colliders, chair, chairBody, clock: { hourHand, minHand, secHand, group: clock }, trashCan, physMat,
    detectorLed: ledMat, panels, GROUP, impact, spawnSheet, dispensers: [stack], makeCrumple, addBall, addPlane, plant, lever, pencilCup: cup, detector, removeProp, shredder, calendar: cal, computer, screen, printerOut, corkboard, pinSheet, pinned, unpinOldest, makeSheet,
    monitorView: { x: monX, y: monY + 0.01, z: monFront + 0.001, h: 0.265 }, stackTop: new THREE.Vector3(stackX, DT + 0.07, stackZ),
    // the detail pass
    usables, examinables, outside, tick, drawers,
    chairBack: chairP.back, lamp: lampP, fan: fanP, phone: { ...ph, yaw: phoneYaw }, stapler: stap, mug: mugP, cradle: cradleP, monitor: mon, taskGlow,
  };
}
