// The "dull" look: drains color, softens contrast, adds film grain and a vignette.
// `saturation` goes from 0 (fully gray) to 1 (full color). The game will raise it very slowly.
export const GrayFilterShader = {
  uniforms: {
    tDiffuse: { value: null },
    saturation: { value: 0.06 },
    time: { value: 0 },
    vignette: { value: 0.32 },
    inspect: { value: 0 },
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
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      vec3 col = mix(vec3(l), c.rgb, saturation);
      // flat, tired contrast that perks up a little as color returns
      float flatness = mix(0.86, 1.0, saturation);
      col = mix(vec3(0.46), col, flatness);
      // faint cool office tint when gray
      col *= mix(vec3(0.97, 0.99, 1.02), vec3(1.0), saturation);
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * (vignette + inspect * 1.4);
      col *= clamp(v, 0.0, 1.0);
      col += (rand(vUv * 731.0 + time) - 0.5) * 0.035;
      gl_FragColor = vec4(col, c.a);
    }
  `,
};
