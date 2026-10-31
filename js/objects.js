import * as THREE from 'three';
import { gsap } from 'gsap';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { inkMat, INK } from './ink.js';
import { CV } from './content.js';

// Everything on the bench is built here from simple solids. Units are roughly 10 cm.
// The bench top is y = 0, x from -8.5 to 8.5, z from -3.8 to 3.8; the wall stands at z = -4.

const UP = new THREE.Vector3(0, 1, 0);
const inkCss = '#1d2333';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const SERIF = '"Instrument Serif", Georgia, serif';
const SANS = '"IBM Plex Sans", system-ui, sans-serif';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.NoColorSpace;
  const redraw = (...a) => { ctx.clearRect(0, 0, w, h); draw(ctx, w, h, ...a); tex.needsUpdate = true; };
  redraw();
  return { tex, ctx, redraw };
}

// A tool kit bound to one figure: every part it makes colours in with that figure.
function kit(fill) {
  const mats = {};
  const mat = (color, opts = {}) => {
    if (opts.map || opts.tone || opts.side || opts.mapColour) return inkMat(color, { fill, ...opts });
    return (mats[color] ||= inkMat(color, { fill }));
  };
  const at = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); return o; };
  const mesh = (geo, color, opts) => new THREE.Mesh(geo, typeof color === 'string' ? mat(color, opts) : color);
  return {
    mat,
    box: (w, h, d, c, x, y, z, r = 0, o) => at(mesh(r ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d), c, o), x, y, z),
    cyl: (rt, rb, h, seg, c, x, y, z, o) => at(mesh(new THREE.CylinderGeometry(rt, rb, h, seg), c, o), x, y, z),
    ball: (r, c, x, y, z, o) => at(mesh(new THREE.SphereGeometry(r, 24, 16), c, o), x, y, z),
    tube: (pts, r, c, seg = 64, o) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, r, 8), c, o),
    lathe: (pts, seg, c, o) => mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), c, o),
    plane: (w, h, c, o) => mesh(new THREE.PlaneGeometry(w, h), c, o),
    rod(a, b, r, c) {
      const d = new THREE.Vector3().subVectors(b, a);
      const m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), c);
      m.position.copy(a).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(UP, d.normalize());
      return m;
    },
    at,
  };
}

// ---------- Fig. 1 · PolyU: a student ID badge on a lanyard ----------
function badge(K) {
  const g = new THREE.Group();
  const p = CV.profile;
  const front = canvasTex(420, 600, (x, w, h) => {
    x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#b8322b'; x.fillRect(0, 0, w, 120);
    x.fillStyle = '#fbf8f0'; x.font = `600 30px ${SANS}`; x.fillText('STUDENT', 34, 58);
    x.font = `400 21px ${MONO}`; x.fillText('Faculty of Engineering', 34, 92);
    x.strokeStyle = inkCss; x.lineWidth = 3; x.strokeRect(34, 160, 150, 190);
    x.beginPath(); x.arc(109, 230, 38, 0, Math.PI * 2); x.moveTo(52, 350); x.quadraticCurveTo(109, 260, 166, 350); x.stroke();
    x.fillStyle = inkCss; x.font = `400 64px ${SERIF}`; x.fillText('Thomas', 34, 430); x.fillText('Wong', 34, 490);
    x.font = `400 20px ${MONO}`; x.fillText('Biomedical Engineering', 34, 532); x.fillText('Class of 2027', 34, 562);
  });
  const back = canvasTex(420, 600, (x, w, h) => {
    x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, w, h);
    x.fillStyle = inkCss; x.font = `400 22px ${MONO}`; x.fillText('ACADEMIC RECORD', 34, 70);
    x.fillRect(34, 86, w - 68, 2);
    x.font = `400 120px ${SERIF}`; x.fillText(p.wgpa, 34, 230);
    x.font = `400 24px ${MONO}`; x.fillText('WGPA', 40, 270);
    x.strokeStyle = '#b8322b'; x.lineWidth = 5; x.save(); x.translate(250, 400); x.rotate(-0.18);
    x.strokeRect(-130, -62, 260, 124); x.fillStyle = '#b8322b'; x.font = `600 26px ${SANS}`;
    x.textAlign = 'center'; x.fillText("DEAN'S", 0, -14); x.fillText('HONOURS LIST', 0, 20); x.font = `400 18px ${MONO}`; x.fillText('2025 / 26', 0, 48); x.restore();
    x.fillStyle = inkCss; x.font = `400 19px ${MONO}`; x.fillText('Secondary major: AI and', 34, 528); x.fillText('Data Analytics (AIDA)', 34, 556);
  });
  const card = new THREE.Group();
  card.add(K.box(1.5, 0.05, 2.1, '#efe7d6', 0, 0, 0, 0.02));
  const f = K.plane(1.42, 2.02, '#ffffff', { map: front.tex, mapColour: 0.25 });
  f.rotation.x = -Math.PI / 2; f.position.y = 0.03;
  const b = K.plane(1.42, 2.02, '#ffffff', { map: back.tex, mapColour: 0.25 });
  b.rotation.x = Math.PI / 2; b.rotation.z = Math.PI; b.position.y = -0.03;
  card.add(f, b);
  card.add(K.box(0.42, 0.06, 0.16, '#9aa3ad', 0, 0.02, -1.12, 0.02));
  const holder = new THREE.Group();
  holder.position.set(0, 0.04, 0);
  holder.add(card);
  g.add(holder);
  // The lanyard loops off behind the card.
  const strap = [[0, 0.05, -1.2], [-0.5, 0.05, -1.9], [-1.4, 0.05, -2.3], [-2.2, 0.05, -1.6], [-2.1, 0.05, -0.4], [-1.3, 0.05, 0.3], [-0.6, 0.05, -0.5], [0, 0.05, -1.2]].map(v => new THREE.Vector3(...v));
  const lan = K.tube(strap, 0.06, '#3f6fb0', 120);
  lan.scale.y = 0.5;
  g.add(lan);
  return {
    group: g, view: { dir: new THREE.Vector3(0.1, 1.5, 0.75), dist: 6.2, lift: 0.6 },
    play() {
      return gsap.timeline({ paused: true })
        .to(holder.position, { y: 0.9, duration: 0.45, ease: 'power2.out' })
        .to(holder.rotation, { z: Math.PI, duration: 0.9, ease: 'power2.inOut' }, '-=0.1')
        .to(holder.position, { y: 0.07, duration: 0.45, ease: 'bounce.out' });
    },
  };
}

// ---------- Fig. 2 · CLAIRE: ultrasound probe and scan monitor ----------
function scanner(K) {
  const g = new THREE.Group();
  // Scan monitor
  let scan = 0, outline = 0;
  const speck = [];
  for (let i = 0; i < 1400; i++) speck.push([Math.random(), Math.random(), Math.random()]);
  const screen = canvasTex(640, 400, (x, w, h) => {
    x.fillStyle = '#f7f2e6'; x.fillRect(0, 0, w, h);
    const cx = w / 2, cy = 30, R0 = 40, R1 = 350, a0 = Math.PI / 2 - 0.62, a1 = Math.PI / 2 + 0.62;
    x.save();
    x.beginPath(); x.arc(cx, cy, R1, a0, a1); x.arc(cx, cy, R0, a1, a0, true); x.closePath();
    x.lineWidth = 2.5; x.strokeStyle = inkCss; x.stroke(); x.clip();
    if (scan > 0) {
      // Grey speckle filled in sweep by sweep, with two muscle bellies brighter than the fat above.
      const lim = a0 + (a1 - a0) * scan;
      x.fillStyle = '#26282c'; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R1, a0, lim); x.closePath(); x.fill();
      for (const [u, v, s] of speck) {
        const a = a0 + (a1 - a0) * u, r = R0 + (R1 - R0) * v;
        if (a > lim) continue;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        const band = Math.abs(py - 150) < 50 || Math.abs(py - 265) < 45 ? 0.75 : 0.35;
        x.fillStyle = `rgba(235,235,230,${band * s})`;
        x.fillRect(px, py, 3 + s * 4, 1.6);
      }
    } else {
      x.strokeStyle = inkCss; x.lineWidth = 1.2;
      for (let k = 0; k < 9; k++) { const r = R0 + (R1 - R0) * k / 8; x.beginPath(); x.arc(cx, cy, r, a0, a1); x.stroke(); }
    }
    x.restore();
    if (outline > 0) {
      // Segmentation: rectus femoris (red) above vastus medialis (teal), traced as the model would.
      const ell = (ex, ey, rx, ry, col, t) => { x.beginPath(); x.ellipse(ex, ey, rx, ry, 0.05, 0, Math.PI * 2 * t); x.strokeStyle = col; x.lineWidth = 5; x.stroke(); };
      ell(cx - 10, 150, 120, 38, '#e0483c', Math.min(outline * 2, 1));
      ell(cx + 20, 262, 140, 40, '#29a39a', Math.max(0, outline * 2 - 1));
      x.font = `500 17px ${MONO}`;
      if (outline > 0.5) { x.fillStyle = '#e0483c'; x.fillText('RF', cx + 120, 128); }
      if (outline > 0.98) { x.fillStyle = '#29a39a'; x.fillText('VM', cx + 170, 240); }
    }
    x.fillStyle = inkCss; x.font = `400 16px ${MONO}`; x.fillText('ATTENTION U-NET', 18, 380);
    x.textAlign = 'right'; x.fillText(outline > 0.98 ? 'SEGMENTED' : scan > 0 ? 'SCANNING' : 'STANDBY', w - 18, 380); x.textAlign = 'left';
  });
  const mon = new THREE.Group();
  mon.position.set(0, 0, 0);
  mon.add(K.box(1.8, 0.12, 1.1, '#3b4250', 0, 0.06, 0, 0.05));
  mon.add(K.box(0.3, 1.5, 0.2, '#3b4250', 0, 0.85, -0.2));
  const head = new THREE.Group();
  head.position.set(0, 2.35, -0.1);
  head.rotation.x = -0.08;
  head.add(K.box(4.3, 2.75, 0.22, '#2f3542', 0, 0, 0, 0.08));
  const disp = K.plane(4.0, 2.5, '#ffffff', { map: screen.tex, mapColour: 1 });
  disp.position.z = 0.12;
  head.add(disp);
  mon.add(head);
  g.add(mon);
  // Probe lying in front of the monitor, its cable running back.
  const probe = new THREE.Group();
  const body = K.lathe([[0, -0.9], [0.17, -0.85], [0.2, -0.3], [0.26, 0.2], [0.34, 0.5], [0.34, 0.62], [0, 0.66]], 24, '#e9eef2');
  probe.add(body);
  probe.add(K.box(0.62, 0.12, 0.2, '#2f3542', 0, 0.7, 0, 0.04));
  probe.rotation.set(0, 0, Math.PI / 2 - 0.15);
  probe.position.set(1.6, 0.33, 1.7);
  probe.rotation.y = -0.5;
  g.add(probe);
  const cable = K.tube([new THREE.Vector3(0.8, 0.1, 2.1), new THREE.Vector3(-0.2, 0.06, 1.8), new THREE.Vector3(-0.9, 0.06, 0.9), new THREE.Vector3(-0.6, 0.06, 0.2)], 0.05, '#2f3542');
  g.add(cable);
  const st = { s: 0, o: 0 };
  return {
    group: g, view: { dir: new THREE.Vector3(0.05, 0.35, 1), dist: 8.6, lift: 1.4 },
    play() {
      return gsap.timeline({ paused: true, onStart: () => { scan = outline = 0; screen.redraw(); } })
        .to(probe.position, { y: 1.0, duration: 0.5, ease: 'power2.out' })
        .to(probe.rotation, { z: 0.1, duration: 0.5, ease: 'power2.inOut' }, '<')
        .to(probe.rotation, { y: -0.2, duration: 0.6, yoyo: true, repeat: 3, ease: 'sine.inOut' })
        .fromTo(st, { s: 0 }, { s: 1, duration: 2.4, ease: 'none', onUpdate: () => { scan = st.s; screen.redraw(); } }, '<')
        .fromTo(st, { o: 0 }, { o: 1, duration: 1.6, ease: 'power1.inOut', onUpdate: () => { outline = st.o; screen.redraw(); } })
        .to(probe.position, { y: 0.33, duration: 0.5, ease: 'power2.in' }, '<')
        .to(probe.rotation, { z: Math.PI / 2 - 0.15, y: -0.5, duration: 0.5 }, '<');
    },
  };
}

// ---------- Fig. 3 · Wen Lab: an open lab notebook ----------
function notebook(K) {
  const g = new THREE.Group();
  const lined = (x, w, h) => {
    x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(80,120,170,0.35)'; x.lineWidth = 1;
    for (let y = 60; y < h; y += 28) { x.beginPath(); x.moveTo(20, y); x.lineTo(w - 20, y); x.stroke(); }
    x.strokeStyle = 'rgba(200,70,60,0.4)'; x.beginPath(); x.moveTo(48, 0); x.lineTo(48, h); x.stroke();
    x.fillStyle = inkCss; x.strokeStyle = inkCss;
  };
  const hand = s => `400 ${s}px "Caveat", ${SERIF}`;
  const scans = canvasTex(400, 560, (x, w, h) => {
    lined(x, w, h);
    x.font = hand(30); x.fillText('Quadriceps US, 3 views', 62, 44);
    for (let k = 0; k < 3; k++) {
      const y0 = 80 + k * 155;
      x.lineWidth = 2; x.strokeRect(62, y0, 150, 120);
      x.beginPath(); x.ellipse(137, y0 + 50, 55, 20, 0.1, 0, Math.PI * 2); x.stroke();
      x.beginPath(); x.ellipse(140, y0 + 92, 60, 16, -0.05, 0, Math.PI * 2); x.stroke();
      x.font = hand(24); x.fillText(['thickness', 'echo intensity', 'texture (GLCM)'][k], 228, y0 + 50);
      x.beginPath(); x.moveTo(215, y0 + 45); x.lineTo(190, y0 + 50); x.stroke();
    }
  });
  const features = canvasTex(400, 560, (x, w, h) => {
    lined(x, w, h);
    x.font = hand(30); x.fillText('Features → model', 62, 44);
    x.font = hand(27);
    ['muscle thickness', 'cross-section area', 'echo intensity', 'texture features', 'feature selection'].forEach((r, k) => { x.fillText('✓  ' + r, 62, 104 + k * 42); });
    x.fillText('-> deep model', 62, 340); x.fillText('-> evaluate', 62, 382);
  });
  const chart = canvasTex(400, 560, (x, w, h) => {
    lined(x, w, h);
    x.font = hand(30); x.fillText('Knee OA prediction', 62, 44);
    x.lineWidth = 2; x.beginPath(); x.moveTo(70, 90); x.lineTo(70, 330); x.lineTo(350, 330); x.stroke();
    x.strokeStyle = '#d0453a'; x.lineWidth = 3; x.beginPath(); x.moveTo(70, 330);
    for (let k = 0; k <= 20; k++) { const t = k / 20; x.lineTo(70 + t * 280, 330 - 240 * Math.pow(t, 0.35)); }
    x.stroke();
    x.strokeStyle = inkCss; x.setLineDash([6, 6]); x.lineWidth = 1.5; x.beginPath(); x.moveTo(70, 330); x.lineTo(350, 90); x.stroke(); x.setLineDash([]);
    x.font = hand(24); x.fillText('ROC', 300, 120); x.fillText('early diagnosis :)', 62, 400);
  });
  const cover = '#2f5d8a';
  g.add(K.box(4.9, 0.08, 3.4, cover, 0, 0.04, 0, 0.03));
  const left = K.box(2.3, 0.14, 3.2, '#f6f1e5', -1.2, 0.15, 0);
  const right = K.box(2.3, 0.14, 3.2, '#f6f1e5', 1.2, 0.15, 0);
  g.add(left, right);
  const lp = K.plane(2.25, 3.15, '#ffffff', { map: scans.tex, mapColour: 0.2 }); lp.rotation.x = -Math.PI / 2; lp.position.set(-1.2, 0.225, 0);
  const rp = K.plane(2.25, 3.15, '#ffffff', { map: chart.tex, mapColour: 0.2 }); rp.rotation.x = -Math.PI / 2; rp.position.set(1.2, 0.225, 0);
  g.add(lp, rp);
  // The page that turns: features on its front, a blank back.
  const hinge = new THREE.Group();
  hinge.position.set(0, 0.235, 0);
  const pf = K.plane(2.25, 3.15, '#ffffff', { map: features.tex, mapColour: 0.2 });
  pf.rotation.x = -Math.PI / 2; pf.position.x = 1.2;
  const pb = K.plane(2.25, 3.15, '#f6f1e5');
  pb.rotation.x = Math.PI / 2; pb.position.set(1.2, -0.004, 0);
  hinge.add(pf, pb);
  g.add(hinge);
  g.add(K.cyl(0.05, 0.05, 2.2, 8, '#3a3f49', 2.72, 0.05, 0.2).rotateX(Math.PI / 2).rotateZ(0.08));
  g.rotation.y = 0.12;
  return {
    group: g, view: { dir: new THREE.Vector3(0, 1.8, 0.8), dist: 6.4, lift: 0 },
    play() {
      return gsap.timeline({ paused: true, onStart: () => { hinge.rotation.z = 0; } })
        .to(hinge.rotation, { z: Math.PI * 0.55, duration: 0.7, ease: 'power2.in' }, 0.4)
        .to(hinge.rotation, { z: Math.PI - 0.02, duration: 0.6, ease: 'power2.out' })
        .to(left.position, { y: 0.17, duration: 0.2, yoyo: true, repeat: 1 }, '<');
    },
  };
}

// ---------- Fig. 4 · Mindplus AI: an eye model that opens into OCT layers ----------
function eye(K) {
  const g = new THREE.Group();
  g.add(K.cyl(0.9, 1.0, 0.18, 32, '#3b4250', 0, 0.09, 0));
  g.add(K.cyl(0.07, 0.07, 1.4, 12, '#9aa3ad', 0, 0.85, 0));
  const ball = new THREE.Group();
  ball.position.set(0, 2.35, 0);
  const R = 0.95;
  const back = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), K.mat('#f3ece0'));
  back.rotation.x = Math.PI / 2;
  const frontG = new THREE.Group();
  const front = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), K.mat('#f3ece0'));
  front.rotation.x = Math.PI / 2;
  frontG.add(front);
  const iris = K.cyl(0.42, 0.42, 0.04, 32, '#4f86b8', 0, 0, R - 0.06); iris.rotation.x = Math.PI / 2;
  const pupil = K.cyl(0.18, 0.18, 0.05, 24, '#1d2333', 0, 0, R - 0.03); pupil.rotation.x = Math.PI / 2;
  frontG.add(iris, pupil);
  ball.add(back, frontG);
  // Inner retina: a red cup only seen once the eye opens.
  const ret = new THREE.Mesh(new THREE.SphereGeometry(R * 0.96, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), K.mat('#d8735f', { side: THREE.BackSide }));
  ret.rotation.x = Math.PI / 2;
  ball.add(ret);
  g.add(ball);
  // OCT layers: thin wavy sheets that fan out beside the eye.
  const layerCols = ['#f1d27a', '#e8a07c', '#d8735f', '#b9587a', '#7d6bb0', '#5b8fd1'];
  const layers = layerCols.map((c, k) => {
    const geo = new THREE.PlaneGeometry(1.8, 1.1, 24, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 2.2 + k * 0.6) * 0.08 + (Math.abs(pos.getX(i)) < 0.25 ? -0.12 : 0));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, K.mat(c, { side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2 + 0.2;
    m.position.set(0, 2.35, 0);
    m.scale.setScalar(0.01);
    g.add(m);
    return m;
  });
  return {
    group: g, view: { dir: new THREE.Vector3(-0.35, 0.45, 1), dist: 7.2, lift: 1.8 },
    play() {
      const tl = gsap.timeline({ paused: true, onStart: () => { frontG.position.set(0, 0, 0); frontG.rotation.set(0, 0, 0); layers.forEach(l => { l.scale.setScalar(0.01); l.position.set(0, 2.35, 0); }); } });
      tl.to(ball.rotation, { y: -0.6, duration: 0.6, ease: 'power2.inOut' })
        .to(frontG.position, { z: 0.9, x: 0.5, duration: 0.8, ease: 'power2.out' })
        .to(frontG.rotation, { y: 0.9, duration: 0.8, ease: 'power2.out' }, '<');
      layers.forEach((l, k) => {
        tl.to(l.scale, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'back.out(1.6)' }, 1.3 + k * 0.12)
          .to(l.position, { x: -1.7, y: 3.5 - k * 0.26, z: 0.5, duration: 0.6, ease: 'power2.out' }, 1.3 + k * 0.12);
      });
      return tl;
    },
  };
}

// ---------- Fig. 5 · MediConcepts intern: a regulatory binder and a review stamp ----------
function binder(K) {
  const g = new THREE.Group();
  const label = canvasTex(300, 420, (x, w, h) => {
    x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, w, h);
    x.strokeStyle = inkCss; x.lineWidth = 3; x.strokeRect(20, 20, w - 40, h - 40);
    x.fillStyle = inkCss; x.font = `500 22px ${MONO}`;
    ['POST-MARKET', 'SURVEILLANCE'].forEach((t, k) => x.fillText(t, 40, 80 + k * 30));
    x.font = `400 17px ${MONO}`;
    ['FDA MAUDE', 'TGA DAEN', 'Health Canada MDI', '+ 3 more sources', '', 'QMS · QA/RA'].forEach((t, k) => x.fillText(t, 40, 170 + k * 30));
  });
  const binderG = new THREE.Group();
  binderG.add(K.box(0.7, 3.0, 2.4, '#5a7f5e', 0, 1.5, 0, 0.05));
  const lab = K.plane(1.5, 2.1, '#ffffff', { map: label.tex, mapColour: 0.3 });
  lab.rotation.y = Math.PI / 2; lab.position.set(0.36, 1.6, 0);
  binderG.add(lab);
  const tabCols = ['#d0453a', '#f1c24c', '#4f86b8', '#7bb37f'];
  const tabs = tabCols.map((c, k) => {
    const t = K.box(0.08, 0.36, 0.34, c, -0.1, 0.6 + k * 0.62, -1.3);
    binderG.add(t);
    return t;
  });
  binderG.rotation.y = -Math.PI / 2 + 0.35;
  g.add(binderG);
  // A sheet and a rubber stamp on the bench beside it.
  const mark = canvasTex(360, 460, (x, w, h, stamped = false) => {
    x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, w, h);
    x.fillStyle = inkCss; x.font = `500 18px ${MONO}`; x.fillText('AMENDMENT No. 07', 30, 50);
    x.fillStyle = 'rgba(29,35,51,0.55)';
    for (let k = 0; k < 9; k++) x.fillRect(30, 90 + k * 26, 180 + ((k * 53) % 110), 6);
    if (stamped) {
      x.save(); x.translate(200, 360); x.rotate(-0.2);
      x.strokeStyle = '#c23a30'; x.lineWidth = 6; x.strokeRect(-120, -44, 240, 88);
      x.fillStyle = '#c23a30'; x.font = `700 34px ${SANS}`; x.textAlign = 'center'; x.fillText('REVIEWED', 0, 12);
      x.restore();
    }
  });
  const sheet = K.plane(1.7, 2.2, '#ffffff', { map: mark.tex, mapColour: 0.5 });
  sheet.rotation.x = -Math.PI / 2; sheet.rotation.z = 0.25; sheet.position.set(-1.65, 0.02, 1.45);
  g.add(sheet);
  const stamp = new THREE.Group();
  stamp.add(K.box(0.9, 0.25, 0.55, '#7a5a3c', 0, 0.12, 0, 0.04));
  stamp.add(K.cyl(0.12, 0.16, 0.6, 16, '#7a5a3c', 0, 0.55, 0));
  stamp.add(K.ball(0.24, '#2f3542', 0, 0.95, 0));
  stamp.position.set(-0.2, 0, 2.2);
  g.add(stamp);
  return {
    group: g, view: { dir: new THREE.Vector3(-0.35, 0.9, 1), dist: 6.6, lift: 1.1 },
    play() {
      const tl = gsap.timeline({ paused: true, onStart: () => { mark.redraw(false); stamp.position.set(-0.2, 0, 2.2); } });
      tabs.forEach((t, k) => tl.to(t.position, { x: -0.35, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, k * 0.15));
      tl.to(stamp.position, { x: -1.4, z: 1.4, y: 1.2, duration: 0.55, ease: 'power2.inOut' }, 0.6)
        .to(stamp.position, { y: 0.03, duration: 0.18, ease: 'power3.in' })
        .call(() => mark.redraw(true))
        .to(stamp.position, { y: 1.0, duration: 0.3, ease: 'power2.out' }, '+=0.15')
        .to(stamp.position, { x: -0.2, z: 2.2, y: 0, duration: 0.5, ease: 'power2.inOut' });
      return tl;
    },
  };
}

// ---------- Fig. 6 · MediConcepts AI analyst: a laptop running a QMS workflow board ----------
function laptop(K) {
  const g = new THREE.Group();
  let grow = 0;
  const screen = canvasTex(560, 360, (x, w, h) => {
    x.fillStyle = '#f7f2e6'; x.fillRect(0, 0, w, h);
    x.fillStyle = inkCss; x.font = `500 18px ${MONO}`; x.fillText('QMS WORKFLOW · AI TOOLS', 22, 36);
    x.fillRect(22, 46, w - 44, 2);
    const rows = ['QMS document workflow', 'Quality records', 'Admin requests', 'Meeting notes'];
    rows.forEach((r, k) => {
      const y = 92 + k * 58, done = grow * rows.length > k + 0.5;
      x.strokeStyle = inkCss; x.lineWidth = 2; x.strokeRect(22, y - 20, 26, 26);
      if (done) { x.strokeStyle = '#2f7d5b'; x.lineWidth = 4; x.beginPath(); x.moveTo(27, y - 7); x.lineTo(34, y + 1); x.lineTo(46, y - 16); x.stroke(); }
      x.fillStyle = inkCss; x.font = `400 18px ${MONO}`; x.fillText(r, 64, y);
      x.fillStyle = done ? '#5b8fd1' : 'rgba(29,35,51,0.35)'; x.font = `400 14px ${MONO}`; x.fillText(done ? 'AI tool chosen' : 'evaluating', 400, y);
    });
  });
  g.add(K.box(3.4, 0.14, 2.3, '#b9c0c8', 0, 0.07, 0, 0.05));
  g.add(K.box(3.0, 0.02, 1.0, '#8d96a0', 0, 0.15, -0.35));
  g.add(K.box(1.0, 0.02, 0.6, '#a7afb8', 0, 0.15, 0.65));
  const lid = new THREE.Group();
  lid.position.set(0, 0.14, -1.12);
  lid.rotation.x = -1.85 + Math.PI / 2;
  const lidBody = K.box(3.4, 2.2, 0.1, '#b9c0c8', 0, 1.1, 0, 0.05);
  const disp = K.plane(3.1, 1.95, '#ffffff', { map: screen.tex, mapColour: 1 });
  disp.position.set(0, 1.1, 0.06);
  lid.add(lidBody, disp);
  g.add(lid);
  g.rotation.y = 0.35;
  const st = { v: 0 };
  return {
    group: g, view: { dir: new THREE.Vector3(-0.45, 1.1, 1), dist: 6.2, lift: 0.9 },
    play() {
      return gsap.timeline({ paused: true, onStart: () => { grow = 0; screen.redraw(); } })
        .to(lid.rotation, { x: -1.2, duration: 0.35, ease: 'power2.in' })
        .to(lid.rotation, { x: -1.85 + Math.PI / 2, duration: 0.6, ease: 'back.out(2)' })
        .fromTo(st, { v: 0 }, { v: 1, duration: 1.6, ease: 'power2.inOut', onUpdate: () => { grow = st.v; screen.redraw(); } });
    },
  };
}

// ---------- Fig. 7 · Cognitive device: EEG headset, bus stop bell and card reader ----------
function eeg(K) {
  const g = new THREE.Group();
  // Headset on a small stand: a band with electrode pads.
  const stand = new THREE.Group();
  stand.add(K.cyl(0.55, 0.65, 0.12, 24, '#3b4250', 0, 0.06, 0));
  stand.add(K.cyl(0.06, 0.06, 1.0, 10, '#9aa3ad', 0, 0.6, 0));
  const head = K.lathe([[0, 0], [0.55, 0.05], [0.75, 0.4], [0.78, 0.8], [0.6, 1.15], [0.3, 1.3], [0, 1.33]], 24, '#efe6d6');
  head.position.y = 1.05;
  stand.add(head);
  // The band runs over the top from ear to ear, with electrode pads along it.
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.05, 8, 40, Math.PI), K.mat('#2f3542'));
  band.position.y = 1.75;
  stand.add(band);
  const pads = [];
  for (let k = 0; k < 5; k++) {
    const a = 0.3 + k * 0.635;
    const p = K.box(0.2, 0.08, 0.26, '#d0453a', Math.cos(a) * 0.86, 1.75 + Math.sin(a) * 0.86, 0, 0.03);
    p.rotation.z = a - Math.PI / 2;
    stand.add(p);
    pads.push(p);
  }
  stand.position.set(-1.3, 0, -0.4);
  g.add(stand);
  // Bus stop bell button: a yellow box with a red push button.
  const bell = new THREE.Group();
  bell.add(K.box(0.9, 0.5, 0.9, '#f1c24c', 0, 0.25, 0, 0.06));
  const btn = K.cyl(0.26, 0.28, 0.16, 24, '#d0453a', 0, 0.56, 0);
  bell.add(btn);
  const stopLab = canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#f1c24c'; x.fillRect(0, 0, w, h); x.fillStyle = inkCss; x.font = `700 40px ${SANS}`; x.textAlign = 'center'; x.fillText('STOP', w / 2, 46); });
  const sl = K.plane(0.8, 0.2, '#ffffff', { map: stopLab.tex, mapColour: 1 }); sl.position.set(0, 0.25, 0.46);
  bell.add(sl);
  bell.position.set(0.2, 0, 0.7);
  g.add(bell);
  // Card reader with a transport card.
  const reader = new THREE.Group();
  reader.add(K.box(0.9, 0.3, 0.9, '#3b4250', 0, 0.15, 0, 0.06));
  const light = inkMat('#7bb37f', { fill: { value: 1 } });
  const lamp = K.box(0.5, 0.04, 0.12, light, 0, 0.32, -0.3);
  reader.add(lamp);
  const card = K.box(0.85, 0.03, 0.55, '#e2a24c', 0.1, 0.33, 0.05, 0.03);
  card.rotation.y = 0.3;
  reader.add(card);
  reader.position.set(1.4, 0, 0.4);
  g.add(reader);
  // ERP strip: a paper tape that draws the brain response.
  let drawn = 0;
  const tape = canvasTex(800, 140, (x, w, h) => {
    x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(29,35,51,0.25)'; x.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 20) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, h); x.stroke(); }
    x.fillStyle = inkCss; x.font = `400 15px ${MONO}`; x.fillText('ERP · Pz', 10, 22); x.fillText('stop pressed', 300, 22); x.fillText('P300', 520, 22);
    x.strokeStyle = '#d0453a'; x.lineWidth = 2.5; x.beginPath();
    for (let px = 0; px < w * drawn; px += 2) {
      const t = px / w;
      const y = 80 + Math.sin(px * 0.21) * 5 + Math.sin(px * 0.057) * 7 - 46 * Math.exp(-((t - 0.67) ** 2) / 0.002) + 20 * Math.exp(-((t - 0.52) ** 2) / 0.0008);
      px === 0 ? x.moveTo(px, y) : x.lineTo(px, y);
    }
    x.stroke();
  });
  const strip = K.plane(3.2, 0.56, '#ffffff', { map: tape.tex, mapColour: 1 });
  strip.rotation.x = -Math.PI / 2; strip.position.set(0.3, 0.02, 1.75); strip.rotation.z = -0.04;
  g.add(strip);
  const st = { d: 0 };
  return {
    group: g, view: { dir: new THREE.Vector3(0.1, 1.1, 1), dist: 7.4, lift: 0.7 },
    play() {
      return gsap.timeline({ paused: true, onStart: () => { drawn = 0; tape.redraw(); light.uniforms.uGlow.value = 0; } })
        .to(btn.position, { y: 0.47, duration: 0.12, ease: 'power2.in' }, 0.3)
        .to(btn.position, { y: 0.56, duration: 0.25, ease: 'back.out(3)' })
        .to(bell.rotation, { z: 0.06, duration: 0.05, yoyo: true, repeat: 5 }, '<')
        .to(card.position, { y: 0.9, duration: 0.3, ease: 'power2.out' }, 0.8)
        .to(card.position, { y: 0.33, duration: 0.25, ease: 'power3.in' })
        .to(light.uniforms.uGlow, { value: 0.6, duration: 0.15, yoyo: true, repeat: 1 })
        .to(pads.map(p => p.scale), { x: 1.3, z: 1.3, duration: 0.2, yoyo: true, repeat: 1, stagger: 0.06 }, 0.6)
        .fromTo(st, { d: 0 }, { d: 1, duration: 2.2, ease: 'none', onUpdate: () => { drawn = st.d; tape.redraw(); } }, 0.5);
    },
  };
}

// ---------- Fig. 8 · Walker: a paediatric walker prototype and its CAD sheet ----------
function walker(K) {
  const g = new THREE.Group();
  const w = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const frame = '#9aa3ad';
  // Two side frames joined at the back, open at the front for the child.
  for (const s of [-1, 1]) {
    w.add(K.rod(V(0.8 * s, 0.25, 0.6), V(0.75 * s, 1.5, 0.35), 0.05, frame));
    w.add(K.rod(V(0.8 * s, 0.25, -0.6), V(0.75 * s, 1.5, -0.35), 0.05, frame));
    w.add(K.rod(V(0.75 * s, 1.5, 0.35), V(0.75 * s, 1.5, -0.35), 0.05, frame));
    w.add(K.rod(V(0.8 * s, 0.35, 0.6), V(0.8 * s, 0.35, -0.6), 0.04, frame));
    w.add(K.box(0.14, 0.12, 0.5, '#d0453a', 0.75 * s, 1.56, 0, 0.04));
  }
  w.add(K.rod(V(-0.8, 0.35, -0.6), V(0.8, 0.35, -0.6), 0.04, frame));
  w.add(K.rod(V(-0.75, 1.3, -0.4), V(0.75, 1.3, -0.4), 0.04, frame));
  // A seat sling for support.
  const sling = K.box(1.2, 0.06, 0.55, '#5b8fd1', 0, 0.95, -0.15, 0.03);
  w.add(sling);
  const wheels = [];
  for (const s of [-1, 1]) for (const z of [0.6, -0.6]) {
    const wh = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 8, 20), K.mat('#2f3542'));
    tyre.rotation.y = Math.PI / 2;
    const hub = K.cyl(0.07, 0.07, 0.1, 10, '#c9ced4', 0, 0, 0); hub.rotation.z = Math.PI / 2;
    wh.add(tyre, hub);
    wh.position.set(0.8 * s, 0.22, z);
    w.add(wh);
    wheels.push(wh);
  }
  w.rotation.y = -0.6;
  g.add(w);
  // CAD sheet pinned on the wall above, drawn as an orthographic view.
  const cad = canvasTex(520, 380, (x, cw, ch) => {
    x.fillStyle = '#eef3f8'; x.fillRect(0, 0, cw, ch);
    x.strokeStyle = 'rgba(60,100,150,0.25)'; x.lineWidth = 1;
    for (let gx = 0; gx < cw; gx += 20) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, ch); x.stroke(); }
    for (let gy = 0; gy < ch; gy += 20) { x.beginPath(); x.moveTo(0, gy); x.lineTo(cw, gy); x.stroke(); }
    x.strokeStyle = '#2b4c7e'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(90, 300); x.lineTo(120, 90); x.lineTo(260, 90); x.lineTo(290, 300); x.stroke();
    x.beginPath(); x.moveTo(105, 200); x.lineTo(275, 200); x.stroke();
    for (const cx of [90, 290]) { x.beginPath(); x.arc(cx, 312, 14, 0, Math.PI * 2); x.stroke(); }
    x.setLineDash([5, 5]); x.beginPath(); x.moveTo(60, 330); x.lineTo(320, 330); x.stroke(); x.setLineDash([]);
    x.fillStyle = '#2b4c7e'; x.font = `400 15px ${MONO}`; x.fillText('SIDE ELEVATION', 360, 60);
    x.fillText('handle h. adjustable', 330, 100); x.fillText('seat sling', 330, 200); x.fillText('anti-tip wheels', 330, 300);
    x.strokeRect(330, 330, 170, 36); x.fillText('ASSISTIVE WALKER', 338, 354);
  });
  const sheet = new THREE.Group();
  sheet.position.set(0.5, 5.2, -1.85);
  const paper = K.plane(2.8, 2.05, '#ffffff', { map: cad.tex, mapColour: 1 });
  paper.position.y = -1.02;
  sheet.add(paper);
  sheet.add(K.ball(0.07, '#d0453a', -1.25, 0, 0.04), K.ball(0.07, '#d0453a', 1.25, 0, 0.04));
  sheet.rotation.x = -0.02;
  g.add(sheet);
  return {
    group: g, view: { dir: new THREE.Vector3(-0.4, 0.75, 1), dist: 7.6, lift: 1.0 },
    play() {
      const tl = gsap.timeline({ paused: true, onStart: () => { w.position.set(0, 0, 0); sheet.scale.y = 1; } });
      tl.to(sheet.scale, { y: 0.05, duration: 0.25, ease: 'power2.in' }, 0)
        .to(sheet.scale, { y: 1, duration: 0.7, ease: 'bounce.out' })
        .to(w.position, { z: 0.55, duration: 1.4, ease: 'power1.inOut' }, 0.3)
        .to(wheels.map(wh => wh.rotation), { x: -6, duration: 1.4, ease: 'power1.inOut' }, 0.3)
        .to(w.position, { z: 0, duration: 1.2, ease: 'power1.inOut' }, '+=0.4')
        .to(wheels.map(wh => wh.rotation), { x: 0, duration: 1.2, ease: 'power1.inOut' }, '<');
      return tl;
    },
  };
}

// Where each figure stands on the bench (x, z, turn).
const LAYOUT = [
  [badge, -6.4, 2.1, 0.35],
  [scanner, -0.6, -2.6, 0],
  [notebook, 1.6, 1.7, 0],
  [eye, 6.2, -2.5, -0.3],
  [binder, 7.0, 1.0, 0],
  [laptop, -4.5, -1.6, 0],
  [eeg, -3.0, 1.6, 0.1],
  [walker, 3.6, -2.2, 0],
];

export function buildFigures() {
  return LAYOUT.map(([build, x, z, turn], i) => {
    const fill = { value: 0 };
    const f = build(kit(fill));
    f.group.position.set(x, 0, z);
    f.group.rotation.y += turn;
    f.fill = fill;
    f.index = i;
    f.item = CV.items[i];
    f.group.traverse(o => { o.userData.fig = i; });
    return f;
  });
}

// The bench, the wall and the pinboard (the "about me" figure).
export function buildRoom() {
  const fill = { value: 0 };
  const K = kit(fill);
  const room = new THREE.Group();
  const wood = '#c9a27a';
  room.add(K.box(17.6, 0.5, 8.0, wood, 0, -0.25, 0, 0.08));
  room.add(K.box(17.0, 0.9, 0.2, wood, 0, -0.95, 3.6));
  for (const x of [-8.3, 8.3]) for (const z of [-3.5, 3.4]) room.add(K.box(0.4, 9, 0.4, wood, x, -5.0, z));
  const wall = K.plane(60, 30, '#f4efe2');
  wall.position.set(0, 6, -4.2);
  room.add(wall);
  // Pinboard with a name card.
  const P = CV.profile;
  const board = new THREE.Group();
  const nameCard = canvasTex(720, 440, (x, w, h) => {
    x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, w, h);
    x.fillStyle = inkCss; x.font = `400 22px ${MONO}`; x.fillText('SHEET 1 OF 9 · ABOUT', 36, 52);
    x.font = `400 104px ${SERIF}`; x.fillText(P.short, 34, 170);
    x.font = `400 30px ${SANS}`; x.fillText('Biomedical Engineering × AI · PolyU', 38, 228);
    x.font = `italic 400 40px ${SERIF}`; x.fillText(P.headline, 38, 300);
    x.font = `400 22px ${MONO}`; x.fillText(`${P.email}   ·   github.com/WONG1357`, 38, 380);
  });
  const cork = K.box(6.4, 3.6, 0.18, '#c69a6a', 0, 0, 0, 0.05);
  const card = K.plane(4.6, 2.8, '#ffffff', { map: nameCard.tex, mapColour: 0.6 });
  card.position.set(-0.4, 0, 0.1);
  card.rotation.z = 0.015;
  board.add(cork, card, K.ball(0.09, '#d0453a', -2.5, 1.25, 0.15), K.ball(0.09, '#4f86b8', 1.7, 1.2, 0.15));
  board.position.set(-3.8, 5.0, -4.05);
  board.traverse(o => { o.userData.fig = 'about'; });
  room.add(board);
  return { room, board, fill };
}

export { INK };
