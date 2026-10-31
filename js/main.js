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
  const pos = look.clone().addScaledVector(f.view.dir.clone().normalize(), f.view.dist * (phone ? 1.7 : 1.3));
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
  $('card-kicker').textContent = `Fig. ${f.index + 1} · ${it.kind} · ${f.item.object}`;
  $('card-title').textContent = it.title;
  $('card-org').textContent = it.org;
  $('card-dates').textContent = it.dates;
  $('card-bullets').replaceChildren(...it.bullets.map(b => el('li', '', b)));
  $('card-tags').replaceChildren(...it.tags.map(t => el('li', '', t)));
  const last = f.index === figures.length - 1;
  $('card-next').textContent = last ? 'Open the full CV →' : `Next: Fig. ${f.index + 2} ${SHORT[f.index + 1]} →`;
  const c = $('card');
  c.hidden = false;
  c.classList.remove('in'); void c.offsetWidth; c.classList.add('in');
  c.scrollTop = 0;
}

// Leaving a figure plays its moment backwards, so the bench always returns to its rest state.
function rest(f) { if (f && f.tl) f.tl.timeScale(reduced ? 100 : 2.5).reverse(); }

function open(f) {
  if (state.focus === f) return;
  setHover(null);
  rest(state.focus);
  state.focus = f;
  ink.focus = f.index + 1;
  $('card').hidden = true;
  flyTo(framing(f));
  gsap.to(f.fill, { value: 1, duration: reduced ? 0 : 0.9, delay: reduced ? 0 : 0.5, ease: 'power1.out' });
  f.tl ||= f.play();
  gsap.delayedCall(reduced ? 0 : 0.9, () => { if (state.focus === f) f.tl.timeScale(1).restart(); });
  gsap.delayedCall(reduced ? 0 : 1.0, () => { if (state.focus === f) showCard(f); });
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
  ink.hover = h === 'about' ? 9 : h ? h.index + 1 : -1;
  $('scene').classList.toggle('pointing', !!h);
  [...index.children].forEach((li, i) => li.firstChild.classList.toggle('hot', h && h !== 'about' && h.index === i));
  if (h && h !== 'about') gsap.to(h.group.position, { y: 0.12, duration: 0.3 });
  const lab = $('label');
  lab.hidden = !h;
  if (h) {
    lab.querySelector('.fig').textContent = h === 'about' ? 'SHEET 1 · ABOUT' : `FIG. ${h.index + 1} · ${h.item.kind.toUpperCase()}`;
    lab.querySelector('.name').textContent = h === 'about' ? 'Open the full CV' : `${SHORT[h.index]}: ${h.item.title}`;
  }
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

// ---- Frame loop ----
const label = $('label');
const top = new THREE.Vector3();
let shift = 0;
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  ink.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (!state.focus) overview();
}
addEventListener('resize', resize);
resize();

// The bench draws itself in on arrival: the figures rise from the paper one by one.
if (!reduced) {
  figures.forEach((f, i) => gsap.from(f.group.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.7, delay: 0.3 + i * 0.09, ease: 'back.out(1.8)' }));
  gsap.from('.bottom', { y: 30, opacity: 0, duration: 0.8, delay: 0.4, ease: 'power2.out', clearProps: 'all' });
}

const loading = $('loading');
const clock = new THREE.Clock();
const par = { x: 0, y: 0 };
renderer.setAnimationLoop(() => {
  if (document.hidden) { clock.getDelta(); return; }
  const dt = Math.min(clock.getDelta(), 0.05);
  const k = 1 - Math.exp(-dt * 4.5);
  // A little parallax in the overview so the bench feels like an object, not a picture.
  const pw = state.focus || phone ? 0 : 1;
  par.x += (mouse.x * pw - par.x) * k;
  par.y += (mouse.y * pw - par.y) * k;
  camera.position.copy(cam.pos).add(new THREE.Vector3(par.x * 0.9, -par.y * 0.5, 0));
  camera.lookAt(cam.look);
  // Slide the view so the open figure sits beside the card.
  const want = state.focus && !$('card').hidden ? 1 : 0;
  shift += (want - shift) * Math.min(dt * 4, 1);
  const w = innerWidth, h = innerHeight;
  // In the overview, lift the bench clear of the footer strip.
  const foot = document.querySelector('.bottom').offsetHeight;
  const up = phone ? 0 : (1 - shift) * foot * 0.45;
  if (phone) camera.setViewOffset(w, h, 0, h * 0.26 * shift + up, w, h);
  else camera.setViewOffset(w, h, w * 0.18 * shift, up, w, h);
  if (hover) {
    box.setFromObject(hover === 'about' ? board : hover.group);
    top.set((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2).project(camera);
    label.style.transform = `translate(${Math.min((top.x + 1) / 2 * w + 10, w - 300)}px, ${Math.max((1 - top.y) / 2 * h - 64, 70)}px)`;
  }
  ink.render(clock.elapsedTime);
  loading.classList.add('done');
});

// Links from the intro (./#fig-3) open that figure once the bench has drawn in.
const hashFig = () => { const m = location.hash.match(/^#fig-(\d)$/); if (m && figures[m[1] - 1]) open(figures[m[1] - 1]); };
gsap.delayedCall(reduced ? 0 : 1.1, hashFig);
addEventListener('hashchange', hashFig);

window.__bench = { figures, open, back, camera, cam, state };
