// The things in the cubicle, built with care: rounded edges, real buttons, cords, labels.
// Every builder returns a group standing on y = 0 with its front toward +Z (toward whoever is using it).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as T from './textures.js';

export function makeKit() {
  const grain = T.plasticNormal(6), grainFine = T.plasticNormal(14), brushed = T.brushedNormal(2), smudge = T.smudges(150, 1);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...o });
  const plastic = (color, rough = 0.52, o = {}) => std({ color, roughness: rough, normalMap: grain, normalScale: new THREE.Vector2(0.35, 0.35), ...o });
  const m = {
    beige: plastic('#c4bba3', 0.5), beigeDark: plastic('#a69d86', 0.55), beigeKey: plastic('#c9c1ab', 0.5), grayKey: plastic('#98937f', 0.5),
    black: plastic('#232426', 0.42), charcoal: plastic('#3a3c40', 0.5), blackGloss: std({ color: '#151617', roughness: 0.18 }),
    rubber: std({ color: '#1a1a1b', roughness: 0.95 }),
    steel: std({ color: '#a3a6a8', roughness: 0.38, metalness: 0.85, normalMap: brushed, normalScale: new THREE.Vector2(0.4, 0.4) }),
    chrome: std({ color: '#e6e8ea', roughness: 0.08, metalness: 1 }),
    darkSteel: std({ color: '#3b3d40', roughness: 0.45, metalness: 0.7 }),
    paper: std({ color: '#f1eee6', roughness: 0.95 }),
    red: plastic('#a5322c', 0.36), teal: plastic('#2f7a78', 0.4), yellow: std({ color: '#dba92c', roughness: 0.22, roughnessMap: smudge }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.6, depthWrite: false }),
    led: (color, power = 2) => { const x = new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: power }); x.userData.keepEmissive = true; return x; },
  };
  const shadow = (o, cast = true) => { o.traverse((x) => { if (x.isMesh) { x.castShadow = cast && !x.userData.noShadow; x.receiveShadow = true; } }); return o; };
  const at = (mesh, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); return mesh; };
  const rbox = (w, h, d, r, mat, seg = 3) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4)), mat);
  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const cyl = (r1, r2, h, mat, seg = 24, open = false) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg, 1, open), mat);
  const plane = (w, h, mat) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const tube = (pts, r, mat, seg = 40, radial = 6) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), seg, r, radial), mat);
  // the inventory sticker. Faces +Z by default; put it on the underside of things.
  let tagN = 96;
  const tag = (w = 0.05, n = null) => { const p = plane(w, w * 0.44, std({ map: T.assetTag(n ?? (tagN += 3 + (tagN % 5))), roughness: 0.7 })); p.userData.noShadow = true; return p; };
  const badge = (text, w, h, o = {}) => { const p = plane(w, h, std({ map: T.label([[text, o.size || 40]], { w: 256, h: Math.round(256 * h / w), bg: o.bg || '#d6ceb8', ink: o.ink || '#6f6956', ...o }), roughness: 0.5 })); p.userData.noShadow = true; return p; };
  return { m, std, plastic, shadow, at, rbox, box, cyl, plane, tube, tag, badge };
}

// ------------------------------------------------------------------------------------------------ CRT monitor
// Origin: the middle of the screen glass. Returns the flat `screen` the computer draws on.
export function monitor(k, screenW, screenH) {
  const { m, at, rbox, box, cyl, plane } = k;
  const g = new THREE.Group();
  const shell = m.beige.clone();                       // its own material, so only the monitor lights up on hover
  const W = screenW + 0.1, top = screenH / 2, chin = 0.078, brow = 0.05;
  g.add(at(rbox(W, brow, 0.07, 0.014, shell), 0, top + brow / 2 - 0.004, -0.02));
  g.add(at(rbox(W, chin, 0.07, 0.014, shell), 0, -top - chin / 2 + 0.004, -0.02));
  for (const s of [-1, 1]) g.add(at(rbox(0.055, screenH + 0.02, 0.07, 0.014, shell), s * (screenW / 2 + 0.024), 0, -0.02));
  // the dark lip the tube sits behind
  const lip = m.blackGloss;
  g.add(at(box(screenW + 0.012, 0.008, 0.02, lip), 0, top + 0.002, -0.004), at(box(screenW + 0.012, 0.008, 0.02, lip), 0, -top - 0.002, -0.004));
  for (const s of [-1, 1]) g.add(at(box(0.008, screenH + 0.012, 0.02, lip), s * (screenW / 2 + 0.002), 0, -0.004));
  // body, stepping back and narrowing to the neck of the tube
  g.add(at(rbox(W - 0.03, screenH + brow + chin - 0.03, 0.2, 0.02, shell), 0, (brow - chin) / 2, -0.15));
  g.add(at(rbox(W - 0.13, screenH + 0.02, 0.15, 0.03, m.beigeDark), 0, 0.0, -0.3));
  g.add(at(rbox(0.2, 0.19, 0.08, 0.03, m.beigeDark), 0, 0.0, -0.4));
  for (let i = -6; i <= 6; i++) g.add(at(box(0.012, 0.004, 0.11, m.rubber), i * 0.024, (screenH + brow + chin - 0.03) / 2 + (brow - chin) / 2 + 0.0005, -0.16));   // top vents
  // swivel stand
  const baseY = -top - chin;
  g.add(at(cyl(0.075, 0.09, 0.035, m.beigeDark, 28), 0, baseY - 0.012, -0.17));
  g.add(at(cyl(0.13, 0.14, 0.016, shell, 36), 0, baseY - 0.036, -0.17));
  // chin: buttons, power light, badge
  const cy = -top - chin / 2 + 0.004;
  for (let i = 0; i < 4; i++) g.add(at(cyl(0.0065, 0.0065, 0.008, m.beigeDark, 12), 0.03 + i * 0.024, cy - 0.012, 0.016, Math.PI / 2));
  g.add(at(cyl(0.011, 0.011, 0.008, m.beigeDark, 16), 0.16, cy - 0.012, 0.016, Math.PI / 2));
  const led = at(box(0.012, 0.004, 0.004, m.led('#3ddc6a', 1.6)), 0.135, cy - 0.012, 0.0155); g.add(led);
  g.add(at(k.badge('TWOFOLD 15', 0.085, 0.016, { size: 30 }), -0.13, cy + 0.008, 0.0156));
  g.add(at(k.tag(0.055, 71), 0, 0.02, -0.441, 0, Math.PI));          // on the back, where nobody looks
  // the picture itself, then the curved glass in front of it
  const screen = plane(screenW, screenH, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  screen.name = 'crtScreen'; g.add(screen);
  const glassGeo = new THREE.PlaneGeometry(screenW, screenH, 14, 10);
  const p = glassGeo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (screenW / 2), y = p.getY(i) / (screenH / 2); p.setZ(i, 0.003 + 0.007 * (1 - x * x) * (1 - y * y)); }
  glassGeo.computeVertexNormals();
  const glass = new THREE.Mesh(glassGeo, m.glass); glass.renderOrder = 2; glass.userData.noShadow = true; g.add(glass);
  return { group: g, screen, glass, shell };
}

// ------------------------------------------------------------------------------------------------ keyboard
export function keyboard(k) {
  const { m, at, rbox } = k;
  const g = new THREE.Group();
  const W = 0.47, D = 0.17;
  g.add(at(rbox(W, 0.02, D, 0.008, m.beige), 0, 0.012, 0, -0.07));
  g.add(at(rbox(W, 0.012, 0.03, 0.005, m.beige), 0, 0.02, -D / 2 + 0.016, -0.07));
  // keys: [x, row, width] in key units; row 0 is the top (function) row
  const keys = [];
  const U = 0.0187, x0 = -W / 2 + 0.02, z0 = -D / 2 + 0.026;
  const row = (r, startU, widths, gap = 0) => { let x = startU; widths.forEach((w) => { if (w > 0) keys.push([x + w / 2, r, w]); x += Math.abs(w) + gap; }); };
  row(0, 0, [1, -1, 1, 1, 1, 1, -0.5, 1, 1, 1, 1, -0.5, 1, 1, 1, 1]);
  row(1.25, 0, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2]);
  row(2.25, 0, [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5]);
  row(3.25, 0, [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25]);
  row(4.25, 0, [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75]);
  row(5.25, 0, [1.5, -1, 1.5, 7, 1.5, -1, 1.5]);
  for (let r = 0; r < 3; r++) row([0, 1.25, 2.25][r], 15.4, [1, 1, 1]);                 // nav cluster
  row(4.25, 16.4, [1]); row(5.25, 15.4, [1, 1, 1]);                                     // arrows
  for (let r = 0; r < 4; r++) row(1.25 + r, 18.8, r === 3 ? [1, 1, 1] : [1, 1, 1, r % 2 === 0 ? 1 : 0]);   // number pad
  row(5.25, 18.8, [2, 1]);
  const keyGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.16);
  const light = new THREE.InstancedMesh(keyGeo, m.beigeKey, keys.length), dark = new THREE.InstancedMesh(keyGeo, m.grayKey, keys.length);
  const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.07, 0, 0)), s = new THREE.Vector3(), pos = new THREE.Vector3();
  let nl = 0, nd = 0;
  keys.forEach(([x, r, w]) => {
    const z = z0 + r * U, y = 0.026 - (z) * 0.07 + (r > 3 ? 0.0006 * (r - 3) : 0);
    pos.set(x0 + x * U * 0.985, y, z); s.set(w * U - 0.0028, 0.0085, U - 0.0028);
    mat4.compose(pos, q, s);
    const isDark = w !== 1 && w < 7 || r === 0 || x > 15.2 && x < 18.4;
    if (isDark) dark.setMatrixAt(nd++, mat4); else light.setMatrixAt(nl++, mat4);
  });
  light.count = nl; dark.count = nd; g.add(light, dark);
  for (let i = 0; i < 3; i++) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.002, 0.003), m.led(i === 0 ? '#3ddc6a' : '#16301c', i === 0 ? 1.4 : 0.3)), W / 2 - 0.075 + i * 0.02, 0.0325, -D / 2 + 0.03));
  g.add(at(k.tag(0.05, 72), 0.1, 0.0005, 0.02, Math.PI / 2));
  return g;
}

// ------------------------------------------------------------------------------------------------ mouse
export function mouse(k) {
  const { m, at } = k;
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), m.beige);
  shell.scale.set(0.03, 0.022, 0.052); g.add(shell);
  g.add(at(k.box(0.058, 0.004, 0.1, m.beigeDark), 0, 0.002, 0));
  g.add(at(k.box(0.0012, 0.002, 0.04, m.beigeDark), 0, 0.0176, -0.026, 0.3));       // the split between the buttons
  return g;
}

// ------------------------------------------------------------------------------------------------ phone
// Returns the handset separately so it can be lifted.
export function phone(k) {
  const { m, at, rbox, box, cyl, plane, tube } = k;
  const g = new THREE.Group();
  const shell = m.charcoal;
  // wedge body: low at the front, tall at the back
  const s = new THREE.Shape(); s.moveTo(-0.11, 0); s.lineTo(0.11, 0); s.lineTo(0.11, 0.022); s.lineTo(-0.09, 0.062); s.lineTo(-0.11, 0.058); s.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 }), shell);
  body.rotation.y = -Math.PI / 2; body.position.set(0.1, 0, 0); g.add(body);        // shape x → world z (front = +z)
  const slope = Math.atan2(0.04, 0.2), top = (z) => 0.042 - z * 0.2;                 // height of the sloped face at z
  // keypad: 12 real buttons
  const keys = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    const z = -0.03 + r * 0.026, b = at(rbox(0.02, 0.008, 0.016, 0.003, m.beigeKey, 2), 0.012 + c * 0.027, top(z) + 0.004, z, slope);
    g.add(b); keys.push(b);
  }
  for (let r = 0; r < 4; r++) g.add(at(rbox(0.014, 0.006, 0.012, 0.002, r === 0 ? m.red : m.grayKey, 2), 0.09 - 0.004, top(-0.03 + r * 0.026) + 0.003, -0.03 + r * 0.026, slope));
  const lcd = at(plane(0.085, 0.022, k.std({ color: '#93a691', roughness: 0.25 })), 0.035, top(-0.068) + 0.0015, -0.068, -Math.PI / 2 + slope); g.add(lcd);
  // message light: blinks. Somebody called.
  const msgLight = at(box(0.016, 0.004, 0.008, m.led('#ff2a1a', 0)), 0.082, top(-0.068) + 0.003, -0.068, slope); g.add(msgLight);
  // speaker grille under the handset
  for (let i = 0; i < 6; i++) g.add(at(box(0.03, 0.001, 0.003, m.rubber), -0.058, top(0.03 + i * 0.008) + 0.0008, 0.03 + i * 0.008, slope));
  // cradle
  g.add(at(rbox(0.06, 0.012, 0.05, 0.004, m.black), -0.058, top(-0.075) + 0.005, -0.075, slope), at(rbox(0.06, 0.012, 0.05, 0.004, m.black), -0.058, top(0.085) + 0.005, 0.085, slope));
  // handset
  const handset = new THREE.Group();
  handset.add(at(rbox(0.04, 0.022, 0.2, 0.01, shell), 0, 0.018, 0));
  handset.add(at(rbox(0.052, 0.034, 0.056, 0.014, shell), 0, 0.006, -0.08), at(rbox(0.052, 0.034, 0.056, 0.014, shell), 0, 0.006, 0.08));
  for (let i = -2; i <= 2; i++) handset.add(at(cyl(0.002, 0.002, 0.002, m.rubber, 6), i * 0.006, -0.0115, -0.08), at(cyl(0.002, 0.002, 0.002, m.rubber, 6), i * 0.006, -0.0115, 0.08));
  const rest = new THREE.Vector3(-0.058, top(0.005) + 0.024, 0.005);
  handset.position.copy(rest); handset.rotation.x = slope; g.add(handset);
  // coiled cord, from the handset's foot around the side
  const coil = []; for (let i = 0; i <= 90; i++) { const t = i / 90; coil.push([-0.105 - 0.035 * Math.sin(t * Math.PI) + 0.01 * Math.cos(t * 56), 0.012 + 0.01 * Math.sin(t * 56) + 0.02 * (1 - t) * (1 - t), 0.1 - 0.19 * t]); }
  g.add(tube(coil, 0.0026, m.black, 260, 4));
  g.add(at(k.tag(0.05, 88), 0, 0.0004, 0.02, Math.PI / 2));
  return { group: g, handset, rest, keys, msgLight, slope };
}

// ------------------------------------------------------------------------------------------------ desk lamp
export function lamp(k) {
  const { m, at, cyl } = k;
  const g = new THREE.Group();
  const metal = k.std({ color: '#2c3a36', roughness: 0.32, metalness: 0.55 });
  g.add(at(cyl(0.078, 0.085, 0.018, metal, 32), 0, 0.009, 0), at(cyl(0.02, 0.026, 0.02, metal, 16), 0, 0.027, 0));
  const sw = at(cyl(0.009, 0.009, 0.01, m.red, 12), 0.045, 0.02, 0.03); g.add(sw);
  // two arms and an elbow, leaning out over the desk toward -X / +Z
  const armMat = m.chrome;
  const a1 = new THREE.Group(); a1.position.set(0, 0.035, 0); a1.rotation.set(0, 0, 0.42); g.add(a1);
  a1.add(at(cyl(0.006, 0.006, 0.3, armMat, 10), 0.012, 0.15, 0), at(cyl(0.006, 0.006, 0.3, armMat, 10), -0.012, 0.15, 0));
  const elbow = new THREE.Group(); elbow.position.set(0, 0.3, 0); a1.add(elbow);
  elbow.add(at(cyl(0.013, 0.013, 0.036, metal, 14), 0, 0, 0, Math.PI / 2));
  const a2 = new THREE.Group(); a2.rotation.z = 0.93; elbow.add(a2);
  a2.add(at(cyl(0.006, 0.006, 0.27, armMat, 10), 0, 0.135, 0.012), at(cyl(0.006, 0.006, 0.27, armMat, 10), 0, 0.135, -0.012));
  const head = new THREE.Group(); head.position.set(0, 0.27, 0); head.rotation.z = -1.6; a2.add(head);
  head.add(at(cyl(0.013, 0.013, 0.036, metal, 14), 0, 0, 0, Math.PI / 2));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.075, 0.1, 28, 1, true), metal.clone()); shade.material.side = THREE.DoubleSide;
  shade.position.y = -0.06; head.add(shade);
  head.add(at(cyl(0.03, 0.03, 0.012, metal, 20), 0, -0.006, 0));
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.0285, 0.073, 0.098, 28, 1, true), new THREE.MeshStandardMaterial({ color: '#e9e6dc', roughness: 0.5, side: THREE.BackSide, emissive: '#ffcf8a', emissiveIntensity: 0 }));
  inner.material.userData.keepEmissive = true; inner.position.y = -0.06; head.add(inner);
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff8e8', emissive: '#ffd9a0', emissiveIntensity: 0, roughness: 0.3 }); bulbMat.userData.keepEmissive = true;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), bulbMat); bulb.position.y = -0.06; bulb.userData.noShadow = true; head.add(bulb);
  const light = new THREE.SpotLight('#ffcf94', 0, 2.6, 0.95, 0.75, 1.6);
  light.position.set(0, -0.05, 0); head.add(light);
  const target = new THREE.Object3D(); target.position.set(0, -1, 0); head.add(target); light.target = target;
  g.add(at(k.tag(0.05, 104), 0, 0.0004, 0, Math.PI / 2));
  return { group: g, light, bulb, inner, sw };
}

// ------------------------------------------------------------------------------------------------ desk fan
export function fan(k) {
  const { m, at, cyl, rbox } = k;
  const g = new THREE.Group();
  g.add(at(rbox(0.15, 0.022, 0.13, 0.01, m.charcoal), 0, 0.011, 0));
  const knob = at(cyl(0.012, 0.012, 0.012, m.grayKey, 14), 0.04, 0.026, 0.035); g.add(knob);
  g.add(at(cyl(0.012, 0.014, 0.12, m.charcoal, 12), 0, 0.08, -0.01));
  const head = new THREE.Group(); head.position.set(0, 0.165, 0); head.rotation.x = -0.12; g.add(head);
  head.add(at(cyl(0.032, 0.036, 0.07, m.charcoal, 20), 0, 0, -0.03, Math.PI / 2));
  const blades = new THREE.Group(); blades.position.z = 0.02; head.add(blades);
  blades.add(at(cyl(0.016, 0.016, 0.022, m.black, 16), 0, 0, 0, Math.PI / 2));
  const bladeMat = k.std({ color: '#7f8b90', roughness: 0.35, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.CircleGeometry(0.05, 14), bladeMat);
    b.scale.set(0.62, 1, 1); b.position.set(Math.cos(i * 2.094) * 0.05, Math.sin(i * 2.094) * 0.05, 0); b.rotation.set(0.35 * Math.cos(i * 2.094), 0.35 * Math.sin(i * 2.094), i * 2.094 + Math.PI / 2);
    blades.add(b);
  }
  // wire cage: rings front and back, spokes between
  const wire = m.steel;
  for (const [z, r] of [[0.045, 0.06], [0.045, 0.1], [0.02, 0.112], [-0.008, 0.1]]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0018, 5, 40), wire); ring.position.z = z; head.add(ring); }
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    head.add(k.tube([[c * 0.02, s * 0.02, 0.05], [c * 0.07, s * 0.07, 0.046], [c * 0.108, s * 0.108, 0.03], [c * 0.112, s * 0.112, 0.012], [c * 0.098, s * 0.098, -0.008]], 0.0011, wire, 8, 3));
  }
  head.add(at(cyl(0.022, 0.022, 0.004, m.grayKey, 18), 0, 0, 0.051, Math.PI / 2));
  g.add(at(k.tag(0.05, 117), 0, 0.0004, 0, Math.PI / 2));
  return { group: g, blades, head, knob };
}

// ------------------------------------------------------------------------------------------------ small desk things
export function mug(k) {
  const { m, at } = k;
  const g = new THREE.Group();
  const pts = [[0, 0], [0.036, 0], [0.039, 0.004], [0.041, 0.094], [0.039, 0.096], [0.0365, 0.094], [0.035, 0.008], [0, 0.007]].map(([x, y]) => new THREE.Vector2(x, y));
  const wall = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), m.yellow.clone()); wall.material.side = THREE.DoubleSide; g.add(wall);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0065, 10, 20, Math.PI * 1.1), wall.material); handle.rotation.z = -Math.PI / 2 - 0.15; handle.position.set(0.041, 0.05, 0); g.add(handle);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.0358, 28), k.std({ color: '#24150c', roughness: 0.08 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 0.074; coffee.userData.noShadow = true; g.add(coffee);
  g.add(at(k.tag(0.045, 114), 0, -0.0003, 0, Math.PI / 2));
  return { group: g, coffee };
}
export function stapler(k) {
  const { m, at, rbox } = k;
  const g = new THREE.Group();
  g.add(at(rbox(0.046, 0.012, 0.165, 0.005, m.black), 0, 0.006, 0), at(rbox(0.03, 0.004, 0.03, 0.001, m.steel), 0, 0.0135, 0.058));
  const top = new THREE.Group(); top.position.set(0, 0.018, -0.075); top.rotation.x = -0.13; g.add(top);      // hinged at the back
  top.add(at(rbox(0.04, 0.024, 0.16, 0.01, m.red), 0, 0.012, 0.078), at(rbox(0.03, 0.012, 0.15, 0.003, m.steel), 0, -0.002, 0.078));
  g.add(at(rbox(0.04, 0.022, 0.03, 0.006, m.black), 0, 0.02, -0.07));
  g.add(at(k.tag(0.04, 98), 0, 0.0002, 0, Math.PI / 2));
  return { group: g, top };
}
export function calculator(k) {
  const g = new THREE.Group();
  g.add(k.at(k.rbox(0.078, 0.012, 0.118, 0.004, k.m.charcoal), 0, 0.006, 0, -0.04));
  g.add(k.at(k.plane(0.07, 0.105, k.std({ map: T.calculatorFace(), roughness: 0.45 })), 0, 0.0125, 0, -Math.PI / 2 - 0.04));
  g.add(k.at(k.tag(0.045, 123), 0, 0.0002, 0, Math.PI / 2));
  return g;
}
export function tapeDispenser(k) {
  const { m, at } = k;
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(-0.07, 0); s.lineTo(0.07, 0); s.lineTo(0.074, 0.02); s.lineTo(0.03, 0.03); s.quadraticCurveTo(-0.01, 0.075, -0.06, 0.05); s.closePath();
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 }), m.black); body.position.z = -0.02; g.add(body);
  const roll = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.011, 10, 28), k.std({ color: '#e8dcae', roughness: 0.2, transparent: true, opacity: 0.85 })); roll.position.set(-0.02, 0.045, 0); g.add(roll);
  g.add(at(k.box(0.002, 0.012, 0.03, m.steel), 0.073, 0.026, 0));
  return g;
}
export function stickyPad(k) {
  const g = new THREE.Group();
  g.add(k.at(k.box(0.076, 0.018, 0.076, k.std({ color: '#e9d35a', roughness: 0.9 })), 0, 0.009, 0));
  g.add(k.at(k.plane(0.076, 0.076, k.std({ map: T.stickyNote(0), roughness: 0.9 })), 0, 0.0183, 0, -Math.PI / 2));
  return g;
}
export function tissueBox(k) {
  const g = new THREE.Group();
  const tx = T.tissueBox();
  g.add(k.at(k.rbox(0.23, 0.08, 0.12, 0.006, k.std({ map: tx, roughness: 0.8 })), 0, 0.04, 0));
  g.add(k.at(k.box(0.12, 0.002, 0.03, k.std({ color: '#141414' })), 0, 0.0802, 0));
  const tissue = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.07, 7, 1, true), k.std({ color: '#f6f6f2', roughness: 1, side: THREE.DoubleSide, flatShading: true }));
  tissue.rotation.x = Math.PI; tissue.scale.z = 0.35; tissue.position.y = 0.105; g.add(tissue);
  return g;
}
// the photo frame, with its fold-out stand. The photo came with the frame.
export function photoFrame(k) {
  const { m, at } = k;
  const g = new THREE.Group();
  const tilt = new THREE.Group(); tilt.rotation.x = -0.2; g.add(tilt);
  const wood = k.std({ color: '#4a3526', roughness: 0.5 });
  const W = 0.19, H = 0.15, b = 0.016;
  tilt.add(at(k.rbox(W, b, 0.014, 0.003, wood), 0, H - b / 2, 0), at(k.rbox(W, b, 0.014, 0.003, wood), 0, b / 2, 0));
  for (const s of [-1, 1]) tilt.add(at(k.rbox(b, H, 0.014, 0.003, wood), s * (W / 2 - b / 2), H / 2, 0));
  tilt.add(at(k.plane(W - b * 1.6, H - b * 1.6, k.std({ map: T.framedPhoto(), roughness: 0.6 })), 0, H / 2, 0.001));
  const glass = at(k.plane(W - b * 1.6, H - b * 1.6, m.glass), 0, H / 2, 0.004); glass.userData.noShadow = true; tilt.add(glass);
  tilt.add(at(k.box(W - 0.01, H - 0.01, 0.003, k.std({ color: '#2a2622', roughness: 0.9 })), 0, H / 2, -0.004));
  tilt.add(at(k.plane(0.1, 0.03, k.std({ map: T.label([['5 × 7 FRAME', 30], ['sample image included', 20, 'normal']], { w: 320, h: 96 }), roughness: 0.8 })), 0, 0.05, -0.0058, 0, Math.PI));
  tilt.add(at(k.tag(0.05, 131), 0, 0.105, -0.0058, 0, Math.PI));
  g.add(at(k.box(0.03, 0.12, 0.003, k.std({ color: '#2a2622', roughness: 0.9 })), 0, 0.058, -0.04, 0.42));
  return g;
}
// a desk nameplate. The slot for the name is empty.
export function nameplate(k) {
  const { m, at } = k;
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(-0.025, 0); s.lineTo(0.025, 0); s.lineTo(0.006, 0.05); s.lineTo(-0.006, 0.05); s.closePath();
  const base = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: false }), k.std({ color: '#3a2b20', roughness: 0.45 }));
  base.rotation.y = Math.PI / 2; base.position.x = -0.11; g.add(base);
  const plate = at(k.plane(0.2, 0.036, m.steel.clone()), 0, 0.027, 0.0162, -0.365); g.add(plate);
  g.add(at(k.plane(0.2, 0.036, k.std({ map: T.label([['INSERT NAME', 26]], { w: 512, h: 92, bg: '#e9e6dc', ink: '#8a8676' }), roughness: 0.8 })), 0, 0.027, -0.0162, 0.365, Math.PI));
  g.add(at(k.tag(0.05, 140), 0, 0.0003, 0, Math.PI / 2));
  return g;
}
// five steel balls on strings
export function cradle(k) {
  const { m, at, cyl } = k;
  const g = new THREE.Group();
  g.add(at(k.rbox(0.17, 0.012, 0.11, 0.004, k.std({ color: '#241c16', roughness: 0.3 })), 0, 0.006, 0));
  const rod = m.chrome;
  for (const z of [-0.042, 0.042]) {
    g.add(at(cyl(0.003, 0.003, 0.125, rod, 8), -0.075, 0.074, z), at(cyl(0.003, 0.003, 0.125, rod, 8), 0.075, 0.074, z), at(cyl(0.003, 0.003, 0.15, rod, 8), 0, 0.1365, z, 0, 0, Math.PI / 2));
  }
  const balls = [];
  const stringMat = k.std({ color: '#c8c8c8', roughness: 0.6 });
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Group(); p.position.set((i - 2) * 0.0222, 0.1365, 0); g.add(p);
    p.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.011, 20, 14), rod), 0, -0.095, 0));
    for (const s of [-1, 1]) { const st = cyl(0.0005, 0.0005, 0.104, stringMat, 4); st.position.set(0, -0.0475, s * 0.021); st.rotation.x = s * 0.415; st.userData.noShadow = true; p.add(st); }
    balls.push(p);
  }
  g.add(at(k.tag(0.05, 152), 0, 0.0003, 0, Math.PI / 2));
  return { group: g, balls };
}
export function binder(k, w, h, color, labelled) {
  const g = new THREE.Group();
  const cover = k.std({ color, roughness: 0.55 });
  g.add(k.at(k.box(w, h, 0.25, [cover, cover, cover, cover, k.std({ map: T.binderSpine(color, labelled), roughness: 0.55 }), cover]), 0, h / 2, 0));
  g.add(k.at(k.box(w - 0.008, 0.003, 0.236, k.m.paper), 0, h - 0.0005, -0.004));     // the pages, seen from above
  return g;
}
export function archiveBox(k, text) {
  const g = new THREE.Group();
  const side = k.std({ map: T.cardboard(text), roughness: 0.95 }), plain = k.std({ map: T.cardboard(''), roughness: 0.95 });
  g.add(k.at(k.box(0.32, 0.25, 0.4, [plain, plain, plain, plain, side, plain]), 0, 0.125, 0));
  g.add(k.at(k.box(0.335, 0.06, 0.415, plain), 0, 0.235, 0));
  return g;
}

// ------------------------------------------------------------------------------------------------ printer
export function printer(k) {
  const { m, at, rbox, box, cyl } = k;
  const g = new THREE.Group();
  g.add(at(rbox(0.42, 0.17, 0.46, 0.02, m.beige), 0, 0.105, 0));
  g.add(at(rbox(0.4, 0.03, 0.44, 0.012, m.beigeDark), 0, 0.02, 0));
  g.add(at(box(0.004, 0.012, 0.25, m.blackGloss), -0.2105, 0.06, 0));                 // the slot pages come out of (faces -X, toward the chair)
  g.add(at(rbox(0.26, 0.012, 0.3, 0.005, m.beige), -0.34, 0.034, 0));                 // output tray
  g.add(at(rbox(0.012, 0.03, 0.3, 0.004, m.beige), -0.465, 0.046, 0));
  // paper feed standing up at the back
  g.add(at(rbox(0.02, 0.2, 0.26, 0.005, m.beigeDark), 0.17, 0.26, 0, 0, 0, 0.22));
  g.add(at(box(0.012, 0.19, 0.22, m.paper), 0.158, 0.265, 0, 0, 0, 0.22));
  // control panel
  g.add(at(rbox(0.09, 0.006, 0.16, 0.002, m.charcoal), -0.12, 0.191, 0.12));
  for (let i = 0; i < 3; i++) g.add(at(cyl(0.008, 0.008, 0.006, m.grayKey, 12), -0.13, 0.196, 0.07 + i * 0.03));
  const led = at(box(0.008, 0.003, 0.012, m.led('#3ddc6a', 1.2)), -0.1, 0.195, 0.17); g.add(led);
  g.add(at(k.badge('TWOFOLD  LASER', 0.11, 0.016, { size: 26 }), -0.2106, 0.13, -0.1, 0, -Math.PI / 2));
  for (let i = -5; i <= 5; i++) g.add(at(box(0.05, 0.002, 0.006, m.rubber), 0.08, 0.1905, i * 0.016));   // vents
  return g;
}

// ------------------------------------------------------------------------------------------------ shredder
export function shredder(k) {
  const { m, at, rbox, box } = k;
  const g = new THREE.Group();
  const bin = k.plastic('#34373a', 0.55);
  g.add(at(rbox(0.3, 0.48, 0.24, 0.015, bin), 0, 0.24, 0));
  const win = at(k.plane(0.16, 0.2, k.std({ color: '#0d0e0f', roughness: 0.15, transparent: true, opacity: 0.85 })), 0, 0.2, 0.1205); win.userData.noShadow = true; g.add(win);
  const head = at(rbox(0.315, 0.1, 0.255, 0.02, m.black), 0, 0.535, 0); g.add(head);
  g.add(at(box(0.225, 0.004, 0.012, m.blackGloss), 0, 0.5855, 0));                    // the slot
  g.add(at(box(0.235, 0.003, 0.03, m.darkSteel), 0, 0.5845, 0));
  g.add(at(rbox(0.03, 0.008, 0.016, 0.003, m.grayKey), 0.11, 0.588, 0.085));          // switch
  const led = at(box(0.006, 0.003, 0.006, m.led('#3ddc6a', 1.2)), 0.08, 0.5865, 0.085); g.add(led);
  g.add(at(k.badge('SHRED-ALL', 0.08, 0.014, { size: 30, bg: '#232426', ink: '#9a9a96' }), -0.07, 0.535, 0.1281));
  return g;
}

// ------------------------------------------------------------------------------------------------ office chair
export function chair(k) {
  const { m, at, rbox, cyl, box } = k;
  const g = new THREE.Group();
  const fabric = k.std({ color: '#34425f', roughness: 1, normalMap: T.fabricNormal(), normalScale: new THREE.Vector2(0.6, 0.6) });
  fabric.normalMap = fabric.normalMap.clone(); fabric.normalMap.repeat.set(3, 3); fabric.normalMap.needsUpdate = true;
  const blk = m.black, shell = k.plastic('#1c1d1f', 0.5);
  // seat: a plastic pan with a fat cushion on it
  g.add(at(rbox(0.5, 0.03, 0.48, 0.012, shell), 0, 0.445, 0));
  g.add(at(rbox(0.48, 0.075, 0.46, 0.035, fabric, 5), 0, 0.49, 0));
  // back: cushion on a shell, on a sprung spine
  const back = new THREE.Group(); back.position.set(0, 0.58, 0.235); back.rotation.x = 0.09; g.add(back);
  back.add(at(rbox(0.44, 0.5, 0.07, 0.035, fabric, 5), 0, 0.3, -0.012), at(rbox(0.455, 0.515, 0.03, 0.014, shell), 0, 0.3, 0.03));
  back.add(at(rbox(0.06, 0.34, 0.022, 0.008, blk), 0, 0.02, 0.05));
  g.add(at(rbox(0.07, 0.03, 0.2, 0.01, blk), 0, 0.435, 0.17));
  // arms
  for (const s of [-1, 1]) {
    g.add(at(rbox(0.055, 0.028, 0.27, 0.012, k.std({ color: '#161718', roughness: 0.85 })), s * 0.265, 0.69, 0.02));
    g.add(at(rbox(0.03, 0.2, 0.045, 0.008, blk), s * 0.265, 0.585, 0.06), at(rbox(0.05, 0.022, 0.05, 0.006, blk), s * 0.25, 0.47, 0.06));
  }
  // gas lift and the five-star base
  g.add(at(cyl(0.028, 0.028, 0.16, m.chrome, 16), 0, 0.36, 0), at(cyl(0.036, 0.04, 0.16, blk, 16), 0, 0.2, 0), at(cyl(0.05, 0.06, 0.03, blk, 18), 0, 0.105, 0));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3, leg = new THREE.Group(); leg.rotation.y = a; g.add(leg);
    leg.add(at(rbox(0.045, 0.028, 0.3, 0.01, blk), 0, 0.085, 0.16, 0.1));
    leg.add(at(cyl(0.008, 0.008, 0.04, m.darkSteel, 8), 0, 0.055, 0.3));
    for (const s of [-1, 1]) leg.add(at(cyl(0.026, 0.026, 0.016, m.rubber, 14), s * 0.013, 0.026, 0.3, 0, 0, Math.PI / 2));
    leg.add(at(box(0.05, 0.02, 0.04, blk), 0, 0.043, 0.3));
  }
  // the recline lever, front-right under the seat
  const lever = new THREE.Group(); lever.position.set(0.3, 0.47, -0.2); g.add(lever);
  lever.add(at(cyl(0.007, 0.007, 0.16, k.std({ color: '#1b1b1d', roughness: 0.4, metalness: 0.5 }), 10), 0, 0, -0.04, Math.PI / 2));
  lever.add(at(rbox(0.05, 0.028, 0.07, 0.01, k.plastic('#8a2f2a', 0.45)), 0, 0.004, -0.14));
  lever.userData.use = 'lever';
  return { group: g, lever, back };
}
