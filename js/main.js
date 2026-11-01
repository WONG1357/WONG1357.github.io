import * as THREE from 'three';
import { gsap } from 'gsap';
import { createInk } from './ink.js';
import { buildFigures, buildRoom } from './objects.js';
import { CV } from './content.js';
import { renderCV } from './cv.js';

THREE.ColorManagement.enabled = false;
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const pad = n => String(n).padStart(2, '0');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (matchMedia('(max-width: 720px), (max-width: 1100px) and (orientation: portrait)').matches) document.querySelector('.count').lastChild.textContent = ' / 8 figures opened · drag sideways, tap an object';
const SHORT = ['PolyU', 'CLAIRE', 'Wen Lab', 'Mindplus AI', 'MediConcepts', 'AI analyst', 'Cognitive device', 'Walker'];
if (location.search.includes('test')) gsap.ticker.lagSmoothing(0);

// Plain CV (also the fallback when 3D is unavailable).
const cvDialog = renderCV();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  document.documentElement.classList.remove('pre');
  $('title-block').hidden = true;
  $('loading').hidden = true;
  cvDialog.showModal();
  throw err;
}
// Phones and portrait tablets share the narrow layout: card at the bottom, drag to pan.
const phone = matchMedia('(max-width: 720px), (max-width: 1100px) and (orientation: portrait)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio, phone ? 2 : 1.75));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

// Canvas lettering on the objects needs the fonts first.
await Promise.race([
  Promise.all(['400 20px "IBM Plex Mono"', '400 20px "Instrument Serif"', 'italic 400 20px "Instrument Serif"', '400 20px "IBM Plex Sans"', '700 20px "IBM Plex Sans"', '400 20px "Caveat"'].map(f => document.fonts.load(f))),
  new Promise(r => setTimeout(r, 2500)),
]);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(phone ? 40 : 30, 1, 1, 120);
const ink = createInk(renderer, scene, camera);
const { room, board, fill: boardFill } = buildRoom();
scene.add(room);
ink.tag(room, 0);
ink.tag(board, 9);
const figures = buildFigures();
figures.forEach(f => { scene.add(f.group); ink.tag(f.group, f.index + 1); });
// Boxes at rest, for the pen sweep on arrival, the hover dimensions and the FIG. tags.
scene.updateMatrixWorld(true);
const boardBox = new THREE.Box3().setFromObject(board);
figures.forEach(f => { f.box = new THREE.Box3().setFromObject(f.group); f.idleAmt = 0; });

// ---- Camera director ----
const cam = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
const state = { focus: null, panX: 0, opened: new Set(), busy: false };
function overview(out = cam) {
  if (phone) {
    out.pos.set(state.panX, 17, 17.5);
    out.look.set(state.panX, 2.6, 0.2);
  } else {
    // Narrower windows step back so the whole bench still fits.
    const k = Math.max(1, 1.6 / (innerWidth / innerHeight));
    out.look.set(0, 1.4, -0.9);
    out.pos.set(0, 14.5, 21.5).sub(out.look).multiplyScalar(k).add(out.look);
  }
  return out;
}
overview();
const box = new THREE.Box3(), centre = new THREE.Vector3();
function framing(f) {
  box.setFromObject(f.group).getCenter(centre);
  const look = new THREE.Vector3(centre.x, f.view.lift, centre.z);
  // Far enough back that the exploded parts and their reference numerals fit round the figure.
  const pos = look.clone().addScaledVector(f.view.dir.clone().normalize(), f.view.dist * (phone ? 1.7 : 1.5));
  return { pos, look };
}
function flyTo(target, dur = reduced ? 0 : 1.15) {
  gsap.to(cam.pos, { x: target.pos.x, y: target.pos.y, z: target.pos.z, duration: dur, ease: 'power3.inOut', overwrite: true });
  gsap.to(cam.look, { x: target.look.x, y: target.look.y, z: target.look.z, duration: dur, ease: 'power3.inOut', overwrite: true });
}

// ---- Figure index and card ----
const index = $('index');
figures.forEach((f, i) => {
  const li = el('li'), b = el('button', '', `${pad(i + 1)} ${SHORT[i]}`);
  b.type = 'button';
  b.addEventListener('click', () => open(f));
  b.addEventListener('mouseenter', () => setHover(f));
  b.addEventListener('mouseleave', () => setHover(null));
  li.append(b);
  index.append(li);
});

function showCard(f) {
  const it = f.item;
  $('spec-fig').textContent = `Fig. ${f.index + 1}`;
  $('spec-sheet').textContent = `Sheet ${f.index + 2} of 9`;
  $('card-kicker').textContent = `${it.kind} · ${it.object}`;
  $('card-legend').replaceChildren(...f.labels.map(l => { const li = el('li'); li.append(el('b', '', l.n), l.text); return li; }));
  $('card-title').textContent = it.title;
  $('card-org').textContent = it.org;
  $('card-dates').textContent = it.dates;
  $('card-bullets').replaceChildren(...it.bullets.map(b => el('li', '', b)));
  $('card-tags').replaceChildren(...it.tags.map(t => el('li', '', t)));
  const last = f.index === figures.length - 1;
  $('card-next').textContent = last ? 'Open the full CV →' : `Next: Fig. ${f.index + 2} ${SHORT[f.index + 1]} →`;
  const c = $('card');
  if (phone) c.classList.add('numbered');
  c.hidden = false;
  c.classList.remove('in'); void c.offsetWidth; c.classList.add('in');
  c.scrollTop = 0;
  placeCard();
}

// The card can be dragged aside by its top strip; a double-click puts it back.
// Its offset is kept from figure to figure, and at least its strip always stays on screen.
const card = $('card'), grip = $('card-grip');
const drag = { x: 0, y: 0 };
function placeCard() {
  card.style.translate = '';
  const r = card.getBoundingClientRect();
  drag.x = Math.min(Math.max(drag.x, 90 - r.right), innerWidth - 90 - r.left);
  drag.y = Math.min(Math.max(drag.y, 12 - r.top), innerHeight - 44 - r.top);
  card.style.translate = `${drag.x}px ${drag.y}px`;
}
grip.addEventListener('pointerdown', e => {
  e.preventDefault();
  grip.setPointerCapture(e.pointerId);
  const sx = e.clientX - drag.x, sy = e.clientY - drag.y;
  card.classList.add('dragging');
  const move = ev => { drag.x = ev.clientX - sx; drag.y = ev.clientY - sy; placeCard(); };
  const end = () => {
    card.classList.remove('dragging');
    grip.removeEventListener('pointermove', move);
    grip.removeEventListener('pointerup', end);
    grip.removeEventListener('pointercancel', end);
  };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
});
grip.addEventListener('dblclick', () => { drag.x = drag.y = 0; placeCard(); });

// Opening a figure pulls its parts apart a little, like the exploded view on a patent sheet.
function explode(f, on) {
  f.explode.forEach(({ wrap, offset }, k) => gsap.to(wrap.position, {
    x: on ? offset.x : 0, y: on ? offset.y : 0, z: on ? offset.z : 0,
    duration: reduced ? 0 : on ? 0.8 : 0.45, delay: on && !reduced ? k * 0.1 : 0,
    ease: on ? 'power3.out' : 'power2.inOut', overwrite: true,
  }));
}

// Leaving a figure plays its moment backwards and closes it up, so the bench always returns to its rest state.
function rest(f) {
  if (!f) return;
  if (f.tl) f.tl.timeScale(reduced ? 100 : 2.5).reverse();
  explode(f, false);
  hideCallouts();
}

function open(f) {
  if (state.focus === f) return;
  setHover(null);
  rest(state.focus);
  state.focus = f;
  ink.focus = f.index + 1;
  $('card').hidden = true;
  ftags.classList.add('off');
  flyTo(framing(f));
  gsap.to(f.fill, { value: 1, duration: reduced ? 0 : 0.9, delay: reduced ? 0 : 0.5, ease: 'power1.out' });
  f.tl ||= f.play();
  const later = (s, fn) => gsap.delayedCall(reduced ? 0 : s, () => { if (state.focus === f) fn(); });
  later(0.8, () => explode(f, true));
  later(0.9, () => f.tl.timeScale(1).restart());
  later(1.0, () => showCard(f));
  later(1.9, () => showCallouts(f));
  if (!state.opened.has(f.index)) {
    state.opened.add(f.index);
    $('count').textContent = state.opened.size;
    index.children[f.index].classList.add('done');
  }
}

function back() {
  if (!state.focus) return;
  rest(state.focus);
  state.focus = null;
  ink.focus = -1;
  $('card').hidden = true;
  ftags.classList.remove('off');
  flyTo(overview({ pos: new THREE.Vector3(), look: new THREE.Vector3() }));
}

$('card-back').addEventListener('click', back);
$('card-next').addEventListener('click', () => {
  const i = state.focus ? state.focus.index : -1;
  if (i === figures.length - 1) { cvDialog.showModal(); return; }
  open(figures[i + 1]);
});
addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.focus && !cvDialog.open) back();
  if (e.key === 'ArrowRight' && state.focus && state.focus.index < figures.length - 1) open(figures[state.focus.index + 1]);
  if (e.key === 'ArrowLeft' && state.focus && state.focus.index > 0) open(figures[state.focus.index - 1]);
});
document.querySelectorAll('[data-home]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); back(); }));

// ---- Pointer: hover, click, parallax, and drag to pan on phones ----
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const pickables = [...figures.map(f => f.group), board];
let hover = null;
const mouse = { x: 0, y: 0 };
function pick(cx, cy) {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, true)[0];
  if (!hit) return null;
  const k = hit.object.userData.fig;
  return k === 'about' ? 'about' : figures[k];
}
function setHover(h) {
  if (h === hover) return;
  if (hover && hover !== 'about') gsap.to(hover.group.position, { y: 0, duration: 0.3 });
  hover = h;
  // The rest of the bench fades back to construction lines; the dim fades out before the outline goes.
  if (h) ink.hover = h === 'about' ? 9 : h.index + 1;
  gsap.to(ink.dim, { value: h ? 1 : 0, duration: 0.35, overwrite: true, onComplete: () => { if (!hover) ink.hover = -1; } });
  $('scene').classList.toggle('pointing', !!h);
  [...index.children].forEach((li, i) => li.firstChild.classList.toggle('hot', h && h !== 'about' && h.index === i));
  tags.forEach((t, i) => t.classList.toggle('hide', !!h && h !== 'about' && h.index === i));
  if (h && h !== 'about') gsap.to(h.group.position, { y: 0.12, duration: 0.3 });
  showDims(h);
}
const canvas = $('scene');
let down = null;
canvas.addEventListener('pointermove', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = (e.clientY / innerHeight) * 2 - 1;
  if (down && e.pointerType !== 'mouse') {
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 6) down.moved = true;
    if (!state.focus) { state.panX = THREE.MathUtils.clamp(down.pan - dx * 0.03, -5.5, 5.5); const o = overview({ pos: new THREE.Vector3(), look: new THREE.Vector3() }); cam.pos.copy(o.pos); cam.look.copy(o.look); }
    return;
  }
  if (e.pointerType === 'mouse' && !state.focus) setHover(pick(e.clientX, e.clientY));
});
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, pan: state.panX, moved: false }; });
canvas.addEventListener('pointerup', e => {
  const tap = down && !down.moved;
  down = null;
  if (!tap) return;
  const h = pick(e.clientX, e.clientY);
  if (h === 'about') cvDialog.showModal();
  else if (h) open(h);
  else if (state.focus) back();
});
canvas.addEventListener('pointerleave', () => { if (!state.focus) setHover(null); });

// ---- Drawn overlays: FIG. tags, hover dimensions, reference numerals ----
const V = new THREE.Vector3(), hb = new THREE.Box3();
const toScreen = v => { v.project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
function screenBox(b) {
  const r = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
  for (let i = 0; i < 8; i++) {
    const [x, y] = toScreen(V.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
    r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x); r.y0 = Math.min(r.y0, y); r.y1 = Math.max(r.y1, y);
  }
  return r;
}
const NS = 'http://www.w3.org/2000/svg', ov = $('ov');
const svg = (tag, attrs, parent = ov) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.append(n); return n; };
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
let footH = 0;

// A red "FIG. N" beside each object, as on a patent sheet, set on a clear patch of bench (figure x, z).
const TAG_AT = [[-1.26, 1.19], [1.37, -0.73], [-0.09, 2.04], [-0.48, 1.54], [1.18, 1.55], [-2.78, -1.8], [0.69, -1.23], [0.25, 1.59]];
const ftags = $('ftags');
const tags = figures.map(f => ftags.appendChild(el('span', 'ftag', `FIG. ${f.index + 1}`)));
const tagW = tags.map(t => t.offsetWidth), tagH = tags[0].offsetHeight;
function drawTags() {
  figures.forEach((f, i) => {
    const [x, y] = toScreen(f.group.localToWorld(V.set(TAG_AT[i][0], 0, TAG_AT[i][1])));
    tags[i].style.translate = `${(x - tagW[i] / 2).toFixed(1)}px ${(y - tagH / 2).toFixed(1)}px`;
  });
}

// Pointing at an object rules its dimensions round it: dates along the bottom, kind up the side,
// and a leader up to its name.
let dim = null;
function showDims(h) {
  if (dim) { const g = dim.g; g.classList.remove('on'); setTimeout(() => g.remove(), 450); dim = null; }
  if (!h) return;
  const it = h === 'about' ? null : h.item;
  const g = svg('g', {});
  const P = cls => svg('path', { pathLength: 1, class: cls }, g);
  dim = { g, h, ext: P('ext'), line: P('dl'), lead: P('lead'), arr: svg('path', { class: 'arr' }, g),
    ht: svg('text', { class: 'dt', 'text-anchor': 'middle' }, g), vt: svg('text', { class: 'dt', 'text-anchor': 'middle' }, g), nm: svg('text', {}, g) };
  dim.ht.textContent = it ? it.dates.toUpperCase() : 'BIOMEDICAL ENGINEERING × AI';
  dim.vt.textContent = it ? it.kind.toUpperCase() : 'ABOUT';
  svg('tspan', { class: 'fg', x: 0 }, dim.nm).textContent = it ? `FIG. ${h.index + 1} · ${SHORT[h.index].toUpperCase()}` : 'SHEET 1 · ABOUT';
  svg('tspan', { class: 'nm', x: 0, dy: 25 }, dim.nm).textContent = it ? it.title : 'Open the full CV';
  dim.nw = dim.nm.getBBox().width;
  drawDims();
  void getComputedStyle(dim.line).strokeDashoffset;
  g.classList.add('on');
}
function drawDims() {
  const { h } = dim, w = innerWidth, H = innerHeight - footH;
  const b = h === 'about' ? boardBox : hb.copy(h.box);
  if (h !== 'about') { b.min.y += h.group.position.y; b.max.y += h.group.position.y; }
  const r = screenBox(b), gap = 16, a = 6;
  const below = r.y1 + gap + 26 < H, y = below ? r.y1 + gap : r.y0 - gap, s = below ? 1 : -1;
  const right = r.x1 + gap + 24 < w - 16, x = right ? r.x1 + gap : r.x0 - gap, t = right ? 1 : -1;
  dim.ext.setAttribute('d', `M${r.x0} ${y - s * (gap - 3)}V${y + s * 5}M${r.x1} ${y - s * (gap - 3)}V${y + s * 5}M${x - t * (gap - 3)} ${r.y0}H${x + t * 5}M${x - t * (gap - 3)} ${r.y1}H${x + t * 5}`);
  dim.line.setAttribute('d', `M${r.x0} ${y}H${r.x1}M${x} ${r.y0}V${r.y1}`);
  dim.ht.setAttribute('x', (r.x0 + r.x1) / 2);
  dim.ht.setAttribute('y', y + (below ? 15 : -7));
  dim.vt.setAttribute('transform', `translate(${right ? x + 13 : x - 5} ${(r.y0 + r.y1) / 2}) rotate(-90)`);
  // The name sits above the object, or beside it past the side dimension when the header is in the way.
  const [px, py] = toScreen(V.set((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2));
  const nw = dim.nw, above = r.y0 - 48 > 92;
  const nx = above ? clamp(r.x0, 24, w - nw - 24) : right ? x + 30 : x - 30 - nw;
  const ny = above ? r.y0 - 50 : clamp(r.y0 + 24, 104, H - 60), uy = ny + 36;
  const ex = above ? clamp(px, nx, nx + nw) : right ? nx : nx + nw;
  dim.nm.setAttribute('transform', `translate(${nx} ${ny})`);
  dim.lead.setAttribute('d', above ? `M${px} ${py}Q${px} ${uy} ${ex} ${uy}M${nx} ${uy}H${nx + nw}` : `M${right ? r.x1 - 8 : r.x0 + 8} ${uy}H${nx + (right ? nw : 0)}`);
  dim.arr.setAttribute('d', `M${r.x0} ${y}l${a} -2.5v5zM${r.x1} ${y}l${-a} -2.5v5zM${x} ${r.y0}l-2.5 ${a}h5zM${x} ${r.y1}l-2.5 ${-a}h5zM${above ? px - 2.2 : (right ? r.x1 - 10.2 : r.x0 + 5.8)} ${above ? py : uy}a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0z`);
}

// An open figure gets reference numerals on leader lines, kept clear of the card. On phones only
// the numerals go on the drawing and the card lists what they mean.
const calls = $('callouts');
let co = null;
function showCallouts(f) {
  hideCallouts();
  const g = svg('g', {});
  const items = f.labels.map((l, k) => {
    const e = el('p', 'co');
    e.append(el('b', '', String(l.n)), el('span', '', l.text));
    calls.append(e);
    const it = { l, e, path: svg('path', { pathLength: 1, class: 'lead' }, g), dot: svg('circle', { r: 2.2, class: 'dot' }, g) };
    [e, it.path, it.dot].forEach(n => { n.style.transitionDelay = `${(k * 0.09).toFixed(2)}s`; });
    return it;
  });
  co = { f, g, items, first: true };
  layoutCallouts();
  void getComputedStyle(items[0].path).strokeDashoffset;
  items.forEach(it => [it.e, it.path, it.dot].forEach(n => n.classList.add('on')));
}
function hideCallouts() {
  if (!co) return;
  const { g, items } = co;
  co = null;
  items.forEach(it => [it.e, it.path, it.dot].forEach(n => { n.style.transitionDelay = '0s'; n.classList.remove('on'); }));
  setTimeout(() => { g.remove(); items.forEach(it => it.e.remove()); }, 450);
}
function layoutCallouts() {
  const { f, items } = co, w = innerWidth;
  const r = screenBox(hb.setFromObject(f.group));
  const cr = card.hidden ? null : card.getBoundingClientRect();
  const cx = (r.x0 + r.x1) / 2;
  let lo = 16, hi = w - 16;
  if (cr && !phone) { if (cr.left + cr.width / 2 > cx) hi = Math.min(hi, cr.left - 16); else lo = Math.max(lo, cr.right + 16); }
  const top = 92, bottom = (phone && cr ? cr.top : innerHeight - footH) - 12;
  const Lx = r.x0 - 24, Rx = r.x1 + 24, W = 190;
  items.forEach(it => { [it.ax, it.ay] = toScreen(it.l.obj.localToWorld(V.set(...it.l.at))); });
  if (co.first) {
    // Sides and order are chosen once, so labels never swap places while the figure moves.
    // Where the free space is too narrow for two columns of text, only the numerals go on.
    co.first = false;
    const num = phone || hi - lo < 2 * W + 160;
    calls.classList.toggle('num', num);
    card.classList.toggle('numbered', num);
    items.forEach(it => {
      it.side = it.ax < cx ? 'L' : 'R';
      it.e.classList.add(it.side);
      if (!num) it.e.style.width = `${W}px`;
      it.w = it.e.offsetWidth; it.h = it.e.offsetHeight;
    });
    co.cols = ['L', 'R'].map(sd => items.filter(it => it.side === sd).sort((a, b) => a.ay - b.ay));
  }
  // Each column keeps its labels near their parts, 10px apart, between the header and the footer or card.
  for (const col of co.cols) {
    let prev = -1e9;
    col.forEach(it => { it.ty = Math.max(clamp(it.ay - 9, top, bottom - it.h), prev + 10); prev = it.ty + it.h; });
    let lim = bottom;
    for (let i = col.length - 1; i >= 0; i--) { col[i].ty = Math.min(col[i].ty, lim - col[i].h); lim = col[i].ty - 10; }
  }
  items.forEach(it => {
    const tx = clamp(it.side === 'L' ? Lx - it.w : Rx, lo, hi - it.w);
    it.x = it.x == null ? tx : it.x + (tx - it.x) * 0.2;
    it.y = it.y == null ? it.ty : it.y + (it.ty - it.y) * 0.2;
    it.e.style.translate = `${it.x.toFixed(1)}px ${it.y.toFixed(1)}px`;
    const ex = it.side === 'L' ? it.x + it.w + 6 : it.x - 6, ey = it.y + 9;
    it.path.setAttribute('d', `M${it.ax} ${it.ay}Q${(it.ax + ex) / 2} ${it.ay} ${ex} ${ey}`);
    it.dot.setAttribute('cx', it.ax);
    it.dot.setAttribute('cy', it.ay);
  });
}

// ---- Frame loop ----
let shift = 0;
const off = { x: 0, y: 0 };
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  ink.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!state.focus) overview();
  if (!card.hidden) placeCard();
}
addEventListener('resize', resize);
resize();

// ---- Arrival: the sheet border is ruled, the pen draws the bench, then each figure in number order,
// then the title block is lettered in. About 3.6 s the first time, a quarter of that afterwards. ----
const html = document.documentElement;
const prog = Array.from({ length: 10 }, () => ({ l: 0, s: 0 }));
let arriving = !reduced, arrived = false;
if (arriving) { ink.line.fill(0); ink.shade.fill(0); ink.arrive.value = 1; }
const uvBox = (b, out) => {
  const r = screenBox(b), m = 14;
  out.set((r.x0 - m) / innerWidth, 1 - (r.y1 + m) / innerHeight, (r.x1 + m) / innerWidth, 1 - (r.y0 - m) / innerHeight);
};
function landed() {
  arriving = false;
  arrived = true;
  ink.arrive.value = 0;
  ink.line.fill(1);
  ink.shade.fill(1);
  try { localStorage.setItem('bench-drawn', '1'); } catch {}
  hashFig();
}
let arrival = null;
function arrive() {
  html.classList.remove('pre');
  if (reduced) { landed(); return; }
  const tl = arrival = gsap.timeline({ onComplete: landed });
  tl.fromTo('#frame rect', { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, 0)
    .from('.brand, .nav', { opacity: 0, y: -10, duration: 0.6, stagger: 0.12, ease: 'power2.out', clearProps: 'all' }, 0.2)
    .to(prog[0], { l: 1, duration: 1.2, ease: 'power1.inOut' }, 0.25)
    .to(prog[0], { s: 1, duration: 0.9, ease: 'power1.out' }, 0.9)
    .to(prog[9], { l: 1, duration: 0.7, ease: 'power1.inOut' }, 0.8)
    .to(prog[9], { s: 1, duration: 0.6, ease: 'power1.out' }, 1.3);
  figures.forEach((f, i) => {
    const at = 1.0 + i * 0.22;
    tl.to(prog[i + 1], { l: 1, duration: 0.75, ease: 'power1.inOut' }, at)
      .to(prog[i + 1], { s: 1, duration: 0.6, ease: 'power1.out' }, at + 0.45)
      .fromTo(tags[i], { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', clearProps: 'all' }, at + 0.55);
  });
  tl.fromTo('#foot-rule', { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'power2.inOut' }, 2.2)
    .from('.title-block > *', { opacity: 0, y: 12, duration: 0.5, stagger: 0.1, ease: 'power2.out', clearProps: 'all' }, 2.5)
    .from('.count', { opacity: 0, duration: 0.4, clearProps: 'all' }, 2.9)
    .from('#index li', { opacity: 0, y: 6, duration: 0.3, stagger: 0.06, ease: 'power2.out', clearProps: 'all' }, 2.9);
  let seen = false;
  try { seen = localStorage.getItem('bench-drawn') === '1'; } catch {}
  if (seen || /^#fig-\d$/.test(location.hash)) tl.timeScale(4);
  if (location.search.includes('hold')) tl.pause();  // test hook: step the arrival by hand
  // Any input finishes the drawing at once.
  const skip = () => tl.progress(1);
  ['pointerdown', 'wheel', 'keydown'].forEach(t => addEventListener(t, skip, { once: true, passive: true }));
}

// Links from the intro (./#fig-3) open that figure once the bench has drawn in.
function hashFig() { const m = location.hash.match(/^#fig-(\d)$/); if (m && figures[m[1] - 1]) open(figures[m[1] - 1]); }
addEventListener('hashchange', hashFig);

const loading = $('loading');
const clock = new THREE.Clock();
const par = { x: 0, y: 0 };
let began = false;
renderer.setAnimationLoop(() => {
  if (document.hidden) { clock.getDelta(); return; }
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  const k = 1 - Math.exp(-dt * 4.5);
  // A little parallax in the overview so the bench feels like an object, not a picture.
  const pw = state.focus || phone ? 0 : 1;
  par.x += (mouse.x * pw - par.x) * k;
  par.y += (mouse.y * pw - par.y) * k;
  camera.position.copy(cam.pos).add(new THREE.Vector3(par.x * 0.9, -par.y * 0.5, 0));
  camera.lookAt(cam.look);
  // Slide the view so the open figure sits in the space the card leaves free, wherever it was dragged.
  const want = state.focus && !card.hidden;
  const ease = Math.min(dt * 4, 1);
  shift += ((want ? 1 : 0) - shift) * ease;
  const w = innerWidth, h = innerHeight;
  let tx = 0, ty = 0;
  if (want) {
    const r = card.getBoundingClientRect();
    if (phone) ty = Math.min(Math.max(0, h - r.top) * 0.45, h * 0.4);
    else tx = 1.1 * (r.left + r.width / 2 > w / 2 ? w / 2 - Math.max(r.left, 0) / 2 : w / 2 - (Math.min(r.right, w) + w) / 2);
  }
  off.x += (tx - off.x) * ease;
  off.y += (ty - off.y) * ease;
  // In the overview, lift the bench clear of the footer strip.
  footH = document.querySelector('.bottom').offsetHeight;
  const up = phone ? 0 : (1 - shift) * footH * 0.45;
  camera.setViewOffset(w, h, off.x, off.y + up, w, h);
  camera.updateMatrixWorld();

  if (arriving) {
    for (let g = 0; g < 10; g++) { ink.line[g] = prog[g].l; ink.shade[g] = prog[g].s; }
    figures.forEach(f => uvBox(f.box, ink.box[f.index + 1]));
    uvBox(boardBox, ink.box[9]);
  }
  if (!state.focus) drawTags();
  if (dim) drawDims();
  if (co) layoutCallouts();
  // Idle life: each object at rest keeps a small loop going. It eases in, eases out when the
  // object is opened, and is off while its own moment plays.
  figures.forEach(f => {
    const still = !f.tl || (!f.tl.isActive() && f.tl.progress() === 0);
    const was = f.idleAmt;
    if (!arrived || reduced || !still) f.idleAmt = 0;
    else if (state.focus === f) f.idleAmt = Math.max(0, was - dt * 3);
    else f.idleAmt = Math.min(1, was + dt * 0.8);
    if (f.idleAmt > 0 || was > 0) f.idle(t, f.idleAmt, mouse);
  });
  ink.render(t);
  if (!began) { began = true; loading.classList.add('done'); arrive(); }
});

window.__bench = { figures, open, back, camera, cam, state, ink, explode, get arrival() { return arrival; } };
