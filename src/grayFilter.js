// The "dull" look: drains color, softens contrast, adds film grain and a vignette.
// `saturation` goes from 0 (fully gray) to 1 (full color). The game will raise it very slowly.
export const GrayFilterShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 0.06 },
    time: { value: 0 },
    vignette: { value: 0.32 },
    inspect: { value: 0 },
    cctv: { value: 0 },
    glitch: { value: 0 },      // 0..1: the picture tears sideways        // 1 = the security-camera look (replays)
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float saturation;
    uniform float time;
    uniform float vignette;
    uniform float inspect;
    uniform float cctv;
    uniform float glitch;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      if (glitch > 0.0) {
        float band = floor(uv.y * 26.0);
        uv.x += (rand(vec2(band, floor(time * 40.0))) - 0.5) * 0.22 * glitch;
      }
      if (cctv > 0.5) {
        // cheap camera: chunky pixels and a little barrel bulge
        vec2 q = uv - 0.5;
        uv = 0.5 + q * (1.0 + 0.12 * dot(q, q));
        uv = (floor(uv * vec2(400.0, 250.0)) + 0.5) / vec2(400.0, 250.0);
      }
      vec4 c = texture2D(tDiffuse, uv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      vec3 col = mix(vec3(l), c.rgb, saturation);
      // flat, tired contrast that perks up a little as color returns
      float flatness = mix(0.93, 1.0, saturation);
      col = mix(vec3(0.42), col, flatness);
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.3);     // a gentle film curve: deeper shadows, cleaner whites
      // faint cool office tint when gray
      col *= mix(vec3(0.97, 0.99, 1.02), vec3(1.0), saturation);
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * (vignette + inspect * 1.4);
      col *= clamp(v, 0.0, 1.0);
      col += (rand(vUv * 731.0 + time) - 0.5) * 0.035;
      if (cctv > 0.5) {
        float g2 = dot(col, vec3(0.299, 0.587, 0.114));
        col = vec3(g2) * vec3(0.92, 1.0, 0.95);
        col = (col - 0.4) * 1.25 + 0.42;
        col *= 0.86 + 0.14 * sin(vUv.y * 520.0);
        col += (rand(uv * 311.0 + time * 3.0) - 0.5) * 0.16;
        col *= 1.0 - smoothstep(0.35, 0.75, length(vUv - 0.5)) * 0.6;
      }
      if (glitch > 0.0) {
        float r2 = texture2D(tDiffuse, uv + vec2(0.012 * glitch, 0.0)).r;
        col.r = mix(col.r, r2, 0.8); col.b = mix(col.b, 1.0 - col.b, 0.25 * glitch);
        col += (rand(uv * 97.0 + time * 7.0) - 0.5) * 0.25 * glitch;
      }
      gl_FragColor = vec4(col, c.a);
    }
  `,
};
