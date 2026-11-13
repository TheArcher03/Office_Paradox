// The dream you have when you nap: a place that is not Earth, in full color.
// Its own little scene and camera; the game swaps to it while your eyes are closed.
import * as THREE from 'three';

export function createDream() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#b0508f', 40, 190);
  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 600);

  // --- sky: deep violet overhead, burning orange at the horizon
  const c = document.createElement('canvas'); c.width = 8; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  [[0, '#140a40'], [0.3, '#4a1c8c'], [0.46, '#c0409a'], [0.5, '#ff9a5c'], [0.54, '#7a2a7a'], [1, '#1c0c3a']].forEach(([s, col]) => grd.addColorStop(s, col));
  g.fillStyle = grd; g.fillRect(0, 0, 8, 256);
  const skyTex = new THREE.CanvasTexture(c); skyTex.colorSpace = THREE.SRGBColorSpace;
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 32, 24), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })));
  // stars up high
  const starPos = [];
  for (let i = 0; i < 500; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.25 + Math.random() * 1.2, r = 280;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false })));

  // --- light
  scene.add(new THREE.HemisphereLight('#ffb0e0', '#0a5a50', 1.5));
  const sunLight = new THREE.DirectionalLight('#ffe2a0', 1.6); sunLight.position.set(60, 40, -150); scene.add(sunLight);

  // --- two suns and a ringed world hanging in the sky
  const basic = (color) => new THREE.MeshBasicMaterial({ color, fog: false });
  const sun1 = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), basic('#fff1b0')); sun1.position.set(70, 34, -220); scene.add(sun1);
  const sun2 = new THREE.Mesh(new THREE.SphereGeometry(4.5, 20, 12), basic('#ff8ae0')); sun2.position.set(34, 22, -230); scene.add(sun2);
  const world = new THREE.Group(); world.position.set(-95, 80, -210); world.rotation.set(0.5, 0, 0.35); scene.add(world);
  world.add(new THREE.Mesh(new THREE.SphereGeometry(34, 32, 24), new THREE.MeshStandardMaterial({ color: '#6a5ad8', roughness: 0.9, emissive: '#1a1450', fog: false })));
  const ring = new THREE.Mesh(new THREE.RingGeometry(44, 66, 72), new THREE.MeshBasicMaterial({ color: '#d8c8ff', transparent: true, opacity: 0.75, side: THREE.DoubleSide, fog: false }));
  ring.rotation.x = Math.PI / 2; world.add(ring);

  // --- ground: soft teal hills
  const groundGeo = new THREE.PlaneGeometry(500, 500, 80, 80);
  groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position;
  const hill = (x, z) => Math.sin(x * 0.06) * 1.6 + Math.cos(z * 0.045) * 2.0 + Math.sin((x + z) * 0.11) * 0.7;
  const ground = (x, z) => hill(x, z) * Math.min(1, Math.abs(x) / 9);          // flat along the path you drift down
  for (let i = 0; i < gp.count; i++) gp.setY(i, ground(gp.getX(i), gp.getZ(i)));
  groundGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: '#16907c', roughness: 1, emissive: '#06403a' })));

  // --- crystals: tall, glowing, in colors the office has never had
  const crystalColors = ['#5ef0ff', '#ff6ad5', '#b48aff', '#8affc0', '#ffd86a'];
  const rnd = (() => { let s = 4242; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  for (let i = 0; i < 90; i++) {
    const col = crystalColors[i % crystalColors.length];
    const h = 1.5 + rnd() * 7;
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5 + rnd() * 0.7, 0),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.25, flatShading: true }));
    const side = rnd() < 0.5 ? -1 : 1, x = side * (3.5 + rnd() * 42), z = 8 - rnd() * 170;
    m.scale.y = h; m.position.set(x, ground(x, z) + h * 0.45, z);
    m.rotation.set((rnd() - 0.5) * 0.3, rnd() * 3, (rnd() - 0.5) * 0.3);
    scene.add(m);
  }

  // --- drifting motes of light
  const N = 320, motePos = new Float32Array(N * 3), moteSeed = new Float32Array(N);
  for (let i = 0; i < N; i++) { motePos[i * 3] = (rnd() - 0.5) * 50; motePos[i * 3 + 1] = rnd() * 9; motePos[i * 3 + 2] = 6 - rnd() * 120; moteSeed[i] = rnd() * 10; }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  scene.add(new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: '#e8ffb8', size: 3, sizeAttenuation: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));

  // --- the tall quiet people, far down the path. One antenna each. One of them waves.
  const skin = new THREE.MeshStandardMaterial({ color: '#8fd98a', emissive: '#1e5a2a', roughness: 0.8 });
  const robe = new THREE.MeshStandardMaterial({ color: '#2a3470', emissive: '#10163a', roughness: 0.9 });
  const glow = new THREE.MeshBasicMaterial({ color: '#f6ffb0' });
  const people = [];
  [[-4.2, -78, 1.0], [3.6, -82, 1.12], [-1.2, -90, 0.92], [7.5, -94, 1.05], [-8.5, -97, 1.0]].forEach(([x, z, s], i) => {
    const p = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.42, 2.3, 10), robe); body.position.y = 1.15; p.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), skin); head.scale.set(0.85, 1.2, 0.85); head.position.y = 2.65; p.add(head);
    for (const ex of [-0.11, 0.11]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: '#0a0c10' })); eye.scale.y = 1.6; eye.position.set(ex, 2.68, 0.23); p.add(eye); }
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 5), skin); stalk.position.set(0.05, 3.2, 0); stalk.rotation.z = -0.2; p.add(stalk);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glow); tip.position.set(0.1, 3.43, 0); p.add(tip);
    const arm = new THREE.Group(); arm.position.set(0.2, 2.1, 0);
    const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.0, 6), skin); armMesh.position.y = -0.5; arm.add(armMesh);
    arm.rotation.z = 0.15; p.add(arm);
    p.scale.setScalar(s); p.position.set(x, ground(x, z), z);
    scene.add(p);
    people.push({ group: p, arm, waves: i === 1 });
  });

  return {
    scene, camera,
    // t: seconds into the dream, dur: how long it lasts
    update(t, dur) {
      const k = Math.min(1, t / dur), e = k * k * (3 - 2 * k);
      camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
      camera.position.set(Math.sin(t * 0.35) * 0.8, 1.9 + e * 1.3 + Math.sin(t * 0.9) * 0.12, 6 - e * 62);
      camera.rotation.set(0.1 + Math.sin(t * 0.5) * 0.03, Math.sin(t * 0.27) * 0.16, Math.sin(t * 0.4) * 0.035, 'YXZ');
      for (let i = 0; i < N; i++) {
        motePos[i * 3 + 1] = (motePos[i * 3 + 1] + 0.006 + Math.sin(t + moteSeed[i]) * 0.002) % 9;
        motePos[i * 3] += Math.sin(t * 0.6 + moteSeed[i]) * 0.003;
      }
      moteGeo.attributes.position.needsUpdate = true;
      world.rotation.y = t * 0.02;
      for (const p of people) {
        p.group.lookAt(camera.position.x, p.group.position.y, camera.position.z);
        if (p.waves) p.arm.rotation.z = 2.5 + Math.sin(t * 3.2) * 0.35;     // a slow wave, as if it knows you
      }
    },
  };
}
