import * as THREE from 'three';

// Patent-drawing renderer. Pass 1 draws every surface as cream paper with screen-space
// hatching where it turns from the lamp (or in full colour once its figure is opened).
// Pass 2 draws normals and part ids. A final pass inks the edges between parts, folds
// and depth steps, then lays paper grain over everything.

export const PAPER = new THREE.Color('#f4efe2');
export const INK = new THREE.Color('#1d2333');
export const LAMP = new THREE.Vector3(-5.5, 7.5, 3);

const shared = {
  uLight: { value: LAMP },
  uPixel: { value: 1 },
  uTime: { value: 0 },
};

const surfaceVert = /* glsl */`
  varying vec3 vN; varying vec3 vW; varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const surfaceFrag = /* glsl */`
  uniform vec3 uColor; uniform vec3 uPaper; uniform vec3 uInk;
  uniform float uFill; uniform float uTone; uniform float uGlow;
  uniform sampler2D uMap; uniform float uHasMap; uniform float uMapColour;
  uniform vec3 uLight; uniform float uPixel;
  varying vec3 vN; varying vec3 vW; varying vec2 vUv;
  float hatch(vec2 p, float a, float s) {
    vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
    float d = abs(fract(q.y / s) - 0.5) * s;
    return 1.0 - smoothstep(0.35, 1.05, d);
  }
  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    vec3 L = normalize(uLight - vW);
    float diff = max(dot(n, L), 0.0);
    float t = clamp(0.18 + 0.72 * diff + 0.18 * (0.5 + 0.5 * n.y) - uTone, 0.0, 1.0);
    vec3 base = uColor;
    float mapInk = 0.0;
    if (uHasMap > 0.5) {
      vec4 m = texture2D(uMap, vUv);
      float lum = dot(m.rgb, vec3(0.299, 0.587, 0.114));
      mapInk = smoothstep(0.62, 0.3, lum) * m.a;
      base = mix(base, m.rgb, m.a * mix(uMapColour, 1.0, uFill));
    }
    vec2 p = gl_FragCoord.xy / uPixel;
    float dark = 1.0 - t;
    float ink = hatch(p, 0.785, 5.0) * smoothstep(0.42, 0.52, dark);
    ink = max(ink, hatch(p, -0.785, 5.0) * smoothstep(0.62, 0.72, dark));
    ink = max(ink, hatch(p, 0.0, 3.5) * smoothstep(0.8, 0.88, dark));
    vec3 paper = uPaper * (0.965 + 0.035 * t);
    vec3 colour = base * (0.66 + 0.42 * t);
    vec3 c = mix(mix(paper, paper * mix(vec3(1.0), base, 0.12), uMapColour), colour, uFill);
    ink *= 1.0 - 0.6 * uFill;
    c = mix(c, uInk, clamp(max(ink * 0.8, mapInk * (1.0 - uFill)), 0.0, 1.0));
    c += uGlow * base;
    gl_FragColor = vec4(c, 1.0);
  }`;

// One material per part. Parts of a figure share a "fill" uniform so the whole figure colours in together.
export function inkMat(color, { map = null, side = THREE.FrontSide, fill = null, tone = 0, mapColour = 0 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uColor: { value: new THREE.Color(color) },
      uPaper: { value: PAPER },
      uInk: { value: INK },
      uFill: fill || { value: 0 },
      uTone: { value: tone },
      uGlow: { value: 0 },
      uMap: { value: map },
      uHasMap: { value: map ? 1 : 0 },
      uMapColour: { value: mapColour },
    },
    vertexShader: surfaceVert,
    fragmentShader: surfaceFrag,
    side,
  });
}

// Normal + id pass. Ids are written per mesh in onBeforeRender.
const idMat = new THREE.ShaderMaterial({
  uniforms: { uId: { value: 0 }, uGroup: { value: 0 } },
  vertexShader: /* glsl */`
    varying vec3 vN;
    void main() {
      vN = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform float uId; uniform float uGroup; varying vec3 vN;
    void main() {
      vec3 n = normalize(vN);
      if (!gl_FrontFacing) n = -n;
      gl_FragColor = vec4(n.xy * 0.5 + 0.5, uId / 255.0, uGroup / 255.0);
    }`,
  side: THREE.DoubleSide,
});

const postFrag = /* glsl */`
  uniform sampler2D tColor; uniform sampler2D tId; uniform sampler2D tDepth;
  uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform float uPixel;
  uniform float uHover; uniform float uFocus; uniform float uTime;
  uniform vec3 uInk; uniform vec3 uPaper;
  varying vec2 vUv;
  float lin(float d) { float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
  float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(rnd(i), rnd(i + vec2(1, 0)), f.x), mix(rnd(i + vec2(0, 1)), rnd(i + vec2(1, 1)), f.x), f.y);
  }
  float edgeAt(vec2 uv, float r) {
    vec4 c = texture2D(tId, uv);
    float dc = lin(texture2D(tDepth, uv).r);
    float e = 0.0;
    vec2 px = r * uPixel / uRes;
    for (int k = 0; k < 8; k++) {
      float a = float(k) * 0.785398;
      vec2 o = vec2(cos(a), sin(a)) * px;
      vec4 s = texture2D(tId, uv + o);
      float ds = lin(texture2D(tDepth, uv + o).r);
      float idEdge = step(0.5 / 255.0, abs(s.b - c.b)) + step(0.5 / 255.0, abs(s.a - c.a));
      float nEdge = smoothstep(0.18, 0.3, length(s.rg - c.rg));
      float dEdge = smoothstep(0.035, 0.07, abs(ds - dc) / max(dc, 0.001));
      e = max(e, max(min(idEdge, 1.0), max(nEdge, dEdge)));
    }
    return e;
  }
  void main() {
    // A slow wobble in the sample position makes the lines read as drawn by hand.
    vec2 w = (vec2(noise(vUv * 90.0 + uTime * 0.0), noise(vUv * 90.0 + 7.3)) - 0.5) * 1.4 * uPixel / uRes;
    vec2 uv = vUv + w;
    vec4 id = texture2D(tId, uv);
    float g = floor(id.a * 255.0 + 0.5);
    float thick = (g > 0.5 && (abs(g - uHover) < 0.5 || abs(g - uFocus) < 0.5)) ? 1.9 : 1.0;
    float e = edgeAt(uv, thick);
    vec3 col = texture2D(tColor, vUv).rgb;
    col = mix(col, uInk, e * 0.92);
    float grain = rnd(floor(vUv * uRes / uPixel)) - 0.5;
    float fibre = noise(vUv * uRes / uPixel * vec2(0.02, 0.25)) - 0.5;
    col += grain * 0.03 + fibre * 0.008;
    vec2 v = vUv - 0.5;
    col *= 1.0 - dot(v, v) * 0.22;
    gl_FragColor = vec4(col, 1.0);
  }`;

export function createInk(renderer, scene, camera) {
  const pr = renderer.getPixelRatio();
  shared.uPixel.value = pr;
  const make = (depth) => {
    const rt = new THREE.WebGLRenderTarget(1, 1, { samples: depth ? 0 : 4 });
    if (depth) {
      rt.depthTexture = new THREE.DepthTexture(1, 1);
      rt.depthTexture.type = THREE.UnsignedIntType;
    }
    return rt;
  };
  const colorRT = make(false), idRT = make(true);
  const post = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: colorRT.texture }, tId: { value: idRT.texture }, tDepth: { value: idRT.depthTexture },
      uRes: { value: new THREE.Vector2() }, uNear: { value: camera.near }, uFar: { value: camera.far },
      uPixel: { value: pr }, uHover: { value: -1 }, uFocus: { value: -1 }, uTime: shared.uTime,
      uInk: { value: INK }, uPaper: { value: PAPER },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: postFrag,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  const postScene = new THREE.Scene();
  postScene.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Give every mesh an id, and every figure a group number for thick outlines on hover.
  let next = 1;
  function tag(root, group = 0) {
    root.traverse(o => {
      if (!o.isMesh) return;
      o.userData.inkId = (next++ * 37) % 251 + 1;
      o.userData.inkGroup = group;
      const prev = o.onBeforeRender;
      o.onBeforeRender = (r, s, c, g, m) => {
        if (m === idMat) {
          idMat.uniforms.uId.value = o.userData.inkId;
          idMat.uniforms.uGroup.value = o.userData.inkGroup;
          idMat.uniformsNeedUpdate = true;
        }
        prev.call(o, r, s, c, g, m);
      };
    });
  }

  const clear = new THREE.Color();
  return {
    tag,
    setSize(w, h) {
      const pw = Math.floor(w * pr), ph = Math.floor(h * pr);
      colorRT.setSize(pw, ph);
      idRT.setSize(pw, ph);
      post.uniforms.uRes.value.set(pw, ph);
    },
    set hover(g) { post.uniforms.uHover.value = g; },
    set focus(g) { post.uniforms.uFocus.value = g; },
    render(t) {
      shared.uTime.value = t;
      renderer.getClearColor(clear);
      renderer.setRenderTarget(colorRT);
      renderer.setClearColor(PAPER, 1);
      renderer.render(scene, camera);
      scene.overrideMaterial = idMat;
      renderer.setRenderTarget(idRT);
      renderer.setClearColor(0x808000, 0);
      renderer.render(scene, camera);
      scene.overrideMaterial = null;
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    },
  };
}
