// The cubicle: static furniture, physics colliders and the grabbable props.
// Units are meters. The desk sits against the back wall (-Z). The player starts seated, facing -Z.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as T from './textures.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const ROOM = { half: 1.25, wallH: 2.6, wallT: 0.06, deskTop: 0.74 };

const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0, ...o });

export function buildRoom(scene, world) {
  const props = [];      // { name, mesh, body, sound }
  const colliders = [];  // XZ rectangles the player can't walk through
  const H = ROOM.half;

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

  // ---- Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * H + 0.2, 2 * H + 0.2), std({ map: T.carpet(), roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const floorBody = new CANNON.Body({ mass: 0, material: physMat });
  floorBody.addShape(new CANNON.Plane());
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floorBody);

  // ---- Walls (tall, fabric-covered, no way out, no ceiling)
  const wallMat = std({ map: T.fabric(), roughness: 1 });
  const trimMat = std({ color: '#8a8d90', roughness: 0.6, metalness: 0.3 });
  const { wallH: WH, wallT: WT } = ROOM;
  const walls = [
    [2 * H + 2 * WT, WH, WT, 0, WH / 2, -H - WT / 2],
    [2 * H + 2 * WT, WH, WT, 0, WH / 2, H + WT / 2],
    [WT, WH, 2 * H, -H - WT / 2, WH / 2, 0],
    [WT, WH, 2 * H, H + WT / 2, WH / 2, 0],
  ];
  walls.forEach(([w, h, d, x, y, z]) => {
    staticBox(w, h, d, x, y, z, wallMat, { shadow: false });
    staticBox(w + 0.02, 0.04, d + 0.02, x, WH + 0.02, z, trimMat, { collide: false });
  });
  // physics lid so nothing escapes over the wall (invisible)
  const lid = new CANNON.Body({ mass: 0, material: physMat });
  lid.addShape(new CANNON.Box(new CANNON.Vec3(H + 1, 0.05, H + 1)));
  lid.position.set(0, 6, 0);
  world.addBody(lid);

  // ---- Desk
  const deskMat = std({ map: T.laminate(), roughness: 0.55 });
  const panelMat = std({ color: '#7d7a72', roughness: 0.8 });
  const DT = ROOM.deskTop;
  const deskX0 = -H, deskX1 = 0.6, deskZ0 = -H, deskZ1 = -0.47;
  const deskW = deskX1 - deskX0, deskD = deskZ1 - deskZ0;
  const deskCX = (deskX0 + deskX1) / 2, deskCZ = (deskZ0 + deskZ1) / 2;
  staticBox(deskW, 0.035, deskD, deskCX, DT - 0.0175, deskCZ, deskMat);
  staticBox(0.025, DT - 0.035, deskD, deskX0 + 0.0125, (DT - 0.035) / 2, deskCZ, panelMat);
  staticBox(0.025, DT - 0.035, deskD, deskX1 - 0.0125, (DT - 0.035) / 2, deskCZ, panelMat);
  staticBox(deskW - 0.05, 0.42, 0.02, deskCX, DT - 0.25, deskZ0 + 0.02, panelMat, { collide: false });
  // a drawer unit under the right side of the desk
  staticBox(0.4, 0.5, deskD - 0.05, deskX1 - 0.23, 0.25 + 0.01, deskCZ, panelMat);
  [0.1, 0.27, 0.42].forEach((y) => staticBox(0.12, 0.015, 0.015, deskX1 - 0.23, y, deskZ1 - 0.02, trimMat, { collide: false }));
  colliders.push({ minX: deskX0, maxX: deskX1, minZ: deskZ0, maxZ: deskZ1, desk: true });

  // ---- Filing cabinet + printer (right of the desk)
  const beige = std({ color: '#cfc8b4', roughness: 0.6 });
  const cabX = 0.95, cabZ = -0.97;
  staticBox(0.52, 0.7, 0.52, cabX, 0.35, cabZ, std({ color: '#8f9294', roughness: 0.5, metalness: 0.35 }));
  [0.2, 0.52].forEach((y) => staticBox(0.16, 0.02, 0.02, cabX, y, cabZ + 0.27, trimMat, { collide: false }));
  const printer = staticBox(0.46, 0.2, 0.4, cabX, 0.7 + 0.1, cabZ - 0.02, beige);
  staticBox(0.3, 0.02, 0.14, cabX, 0.82, cabZ + 0.24, beige, { collide: false }); // output tray
  staticBox(0.08, 0.025, 0.06, cabX + 0.15, 0.91, cabZ + 0.12, std({ color: '#4a4f52' }), { collide: false }); // button panel
  printer.name = 'printer';
  colliders.push({ minX: cabX - 0.27, maxX: H, minZ: -H, maxZ: cabZ + 0.27 });

  // ---- Paper shredder (floor, front of the cabinet)
  const shredX = 1.0, shredZ = -0.47;
  staticBox(0.3, 0.5, 0.24, shredX, 0.25, shredZ, std({ color: '#3c3f42', roughness: 0.5 }));
  staticBox(0.31, 0.08, 0.25, shredX, 0.54, shredZ, std({ color: '#26282a', roughness: 0.4 }));
  staticBox(0.22, 0.006, 0.012, shredX, 0.583, shredZ, std({ color: '#050505' }), { collide: false }); // slot
  colliders.push({ minX: shredX - 0.15, maxX: shredX + 0.15, minZ: shredZ - 0.12, maxZ: shredZ + 0.12 });

  // ---- Computer: CRT monitor, tower, keyboard, mouse
  const monX = -0.32, monZ = -0.98;
  staticBox(0.3, 0.04, 0.24, monX, DT + 0.02, monZ, beige);
  staticBox(0.44, 0.38, 0.32, monX, DT + 0.04 + 0.19, monZ + 0.03, beige);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.16), beige);
  back.position.set(monX, DT + 0.04 + 0.18, monZ - 0.2); back.castShadow = true; scene.add(back);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.28), std({ map: T.crtScreen(), roughness: 0.15, metalness: 0.1 }));
  screen.position.set(monX, DT + 0.04 + 0.2, monZ + 0.191); scene.add(screen);
  screen.name = 'crtScreen';
  staticBox(0.2, 0.42, 0.42, deskX1 - 0.65, 0.21, -1.0, beige); // tower under the desk
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.16), std({ map: T.keyboard(), roughness: 0.6 }));
  kb.position.set(monX, DT + 0.013, -0.66); kb.rotation.x = -0.05; kb.castShadow = true; kb.receiveShadow = true; scene.add(kb);
  const kbBody = new CANNON.Body({ mass: 0, material: physMat }); kbBody.addShape(new CANNON.Box(new CANNON.Vec3(0.23, 0.0125, 0.08))); kbBody.position.set(monX, DT + 0.013, -0.66); world.addBody(kbBody);
  const mouse = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.04, 4, 10), beige);
  mouse.rotation.x = Math.PI / 2; mouse.scale.set(1, 1, 0.55); mouse.position.set(-0.0, DT + 0.016, -0.65); mouse.castShadow = true; scene.add(mouse);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, DT + 0.01, -0.69), new THREE.Vector3(0.02, DT + 0.005, -0.85), new THREE.Vector3(-0.1, DT + 0.005, -1.05), new THREE.Vector3(-0.2, DT + 0.005, -1.15)]), 20, 0.004, 5), std({ color: '#bdb6a0' }));
  scene.add(cord);

  // ---- Paper stack (left side of the desk)
  const stack = new THREE.Group(); stack.position.set(-0.98, DT, -0.86); scene.add(stack);
  const paperMat = std({ map: T.paper(false), roughness: 0.95 });
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.215, 0.004, 0.28), paperMat);
    s.position.set((Math.random() - 0.5) * 0.012, 0.002 + i * 0.0042, (Math.random() - 0.5) * 0.012);
    s.rotation.y = (Math.random() - 0.5) * 0.06; s.castShadow = true; s.receiveShadow = true; stack.add(s);
  }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(0.215, 0.28), std({ map: T.spreadsheet(), roughness: 0.95 }));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.062; stack.add(top);
  const stackBody = new CANNON.Body({ mass: 0, material: physMat }); stackBody.addShape(new CANNON.Box(new CANNON.Vec3(0.11, 0.03, 0.14))); stackBody.position.set(-0.98, DT + 0.03, -0.86); world.addBody(stackBody);

  // ---- Calendar on the left wall (stuck on the wrong month)
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.5), std({ map: T.calendar(), roughness: 0.9 }));
  cal.position.set(-H + 0.004, 1.42, -0.32); cal.rotation.y = Math.PI / 2; cal.name = 'calendar'; scene.add(cal);
  const calPin = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), std({ color: '#c33' }));
  calPin.position.set(-H + 0.01, 1.66, -0.32); scene.add(calPin);

  // ---- Wall clock above the desk
  const clock = new THREE.Group(); clock.position.set(0.15, 1.95, -H + 0.03); scene.add(clock);
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

  // ---- Wire mesh trash can under the desk (hollow, so things can land in it)
  // tucked at the desk's front-left corner: still "by the desk", but the opening is reachable for a shot
  const canX = -0.98, canZ = -0.3, canR = 0.155, canH = 0.33;
  const meshTex = T.wireMesh();
  const can = new THREE.Mesh(new THREE.CylinderGeometry(canR + 0.015, canR - 0.02, canH, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: '#1d1d1d', alphaMap: meshTex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 }));
  can.position.set(canX, canH / 2, canZ); can.castShadow = true; scene.add(can);
  const canRim = new THREE.Mesh(new THREE.TorusGeometry(canR + 0.015, 0.006, 6, 32), std({ color: '#1d1d1d', metalness: 0.6, roughness: 0.4 }));
  canRim.rotation.x = Math.PI / 2; canRim.position.set(canX, canH, canZ); scene.add(canRim);
  const canBase = new THREE.Mesh(new THREE.CircleGeometry(canR - 0.02, 28), std({ color: '#1d1d1d' }));
  canBase.rotation.x = -Math.PI / 2; canBase.position.set(canX, 0.004, canZ); scene.add(canBase);
  const canBody = new CANNON.Body({ mass: 0, material: physMat });
  const segs = 12;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const q = new CANNON.Quaternion(); q.setFromEuler(0, -a, 0);
    canBody.addShape(new CANNON.Box(new CANNON.Vec3(0.006, canH / 2, (Math.PI * canR) / segs + 0.004)),
      new CANNON.Vec3(Math.cos(a) * canR, canH / 2, Math.sin(a) * canR), q);
  }
  canBody.position.set(canX, 0, canZ);
  world.addBody(canBody);
  const trashCan = { x: canX, z: canZ, r: canR, h: canH };
  colliders.push({ minX: canX - canR, maxX: canX + canR, minZ: canZ - canR, maxZ: canZ + canR });

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
  chair.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const chairBody = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: physMat });
  chairBody.addShape(new CANNON.Box(new CANNON.Vec3(0.24, 0.04, 0.23)), new CANNON.Vec3(0, 0.48, 0));
  chairBody.addShape(new CANNON.Box(new CANNON.Vec3(0.22, 0.25, 0.035)), new CANNON.Vec3(0, 0.86, 0.22));
  world.addBody(chairBody);

  // ---- Grabbable props
  const p_damp = new Map(); // remembers each prop's normal spin damping (holding changes it)
  function addProp(name, mesh, shape, mass, x, y, z, { sound = 'thunk', rot = null, linDamp = 0.05, angDamp = 0.2 } = {}) {
    mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    mesh.userData.prop = name;
    scene.add(mesh);
    const body = new CANNON.Body({ mass, material: physMat, linearDamping: linDamp, angularDamping: angDamp, allowSleep: true, sleepSpeedLimit: 0.05, sleepTimeLimit: 0.6 });
    p_damp.set(body, angDamp);
    body.addShape(shape);
    body.position.set(x, y, z);
    if (rot) body.quaternion.setFromEuler(...rot);
    world.addBody(body);
    const p = { name, mesh, body, sound };
    body.userData = p;
    props.push(p);
    return p;
  }

  // crumpled paper balls (the real crumple-and-toss task comes in Stage 2)
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
  [[-0.62, -0.78], [-0.55, -0.6]].forEach(([x, z], i) => {
    const m = new THREE.Mesh(crumpleGeo(0.038), ballMat);
    m.material = ballMat.clone(); m.material.flatShading = true;
    // paper is light and lumpy: lots of air drag, and it stops rolling quickly
    addProp('paperBall', m, new CANNON.Sphere(0.036), 0.012, x, DT + 0.04, z, { sound: 'paper', linDamp: 0.12, angDamp: 0.75 });
  });

  // pencils (in a cup)
  const cupX = 0.3, cupZ = -1.08;
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 18, 1, true), std({ color: '#2a2a2a', side: THREE.DoubleSide, roughness: 0.4, metalness: 0.4 }));
  cup.position.set(cupX, DT + 0.05, cupZ); cup.castShadow = true; scene.add(cup);
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
  addProp('stapler', stapler, new CANNON.Box(new CANNON.Vec3(0.0225, 0.025, 0.08)), 0.32, 0.38, DT + 0.03, -0.72, { sound: 'heavy', rot: [0, 0.4, 0] });

  // coffee mug (cold, old coffee)
  const mug = new THREE.Group();
  const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.038, 0.095, 20, 1, true), std({ color: '#d9a830', roughness: 0.3, side: THREE.DoubleSide }));
  const mugBottom = new THREE.Mesh(new THREE.CircleGeometry(0.038, 20), std({ color: '#d9a830' })); mugBottom.rotation.x = Math.PI / 2; mugBottom.position.y = -0.047;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.037, 20), std({ color: '#2a1a10', roughness: 0.1 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.02;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 16, Math.PI), std({ color: '#d9a830', roughness: 0.3 }));
  handle.rotation.z = -Math.PI / 2; handle.position.x = 0.04;
  mug.add(mugBody, mugBottom, coffee, handle);
  addProp('mug', mug, new CANNON.Cylinder(0.04, 0.04, 0.095, 12), 0.3, -0.7, DT + 0.05, -0.58, { sound: 'ceramic' });

  props.forEach((p) => { p.angDamp = p_damp.get(p.body); });
  return { props, colliders, chair, chairBody, clock: { hourHand, minHand, secHand }, trashCan, physMat };
}
