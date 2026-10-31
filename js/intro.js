import { CV } from './content.js';
import { renderCV } from './cv.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SHORT = ['PolyU', 'CLAIRE', 'Wen Lab', 'Mindplus AI', 'MediConcepts', 'AI analyst', 'Cognitive device', 'Walker'];
const items = CV.items;

renderCV();
if (reduced) document.documentElement.classList.add('still');

// Barcode on the badge: fixed pseudo-random bars so it looks the same on every visit.
{
  const svg = $('barcode');
  let x = 0, seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  let bars = '';
  while (x < 296) {
    const w = 1 + Math.floor(rnd() * 4);
    bars += `<rect x="${x}" y="0" width="${w}" height="40" fill="currentColor"/>`;
    x += w + 1 + Math.floor(rnd() * 3);
  }
  svg.innerHTML = bars;
}

// 1 · Peel. The badge folds back along a diagonal that sweeps from its bottom-right corner.
// The fold line is x + y = c. The badge keeps the part with x + y < c; the flap is the same
// rectangle reflected across the line, clipped to the part that has already lifted.
const under = document.querySelector('.under');
const peel = $('peel'), badge = $('badge'), flap = $('flap'), wrap = $('badge-wrap'), hint = $('scroll-hint');
function halfPlane(W, H, c, keepBelow) {
  const pts = [[0, 0], [W, 0], [W, H], [0, H]], out = [];
  const inside = ([x, y]) => keepBelow ? x + y <= c : x + y >= c;
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) {
      const t = (c - a[0] - a[1]) / (b[0] + b[1] - a[0] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out.length ? `polygon(${out.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})` : 'polygon(0 0,0 0,0 0)';
}
function drawPeel() {
  const r = peel.getBoundingClientRect();
  const p = clamp(-r.top / (r.height - innerHeight));
  hint.style.opacity = p > 0.04 ? 0 : 1;
  if (reduced) return;
  const W = wrap.offsetWidth, H = wrap.offsetHeight;
  // A little lift at the start, then the fold runs across; the last part fades the sticker away.
  const k = clamp((p - 0.05) / 0.7);
  const eased = k * k * (3 - 2 * k);
  const c = W + H - eased * (W + H) * 1.08;
  badge.style.clipPath = halfPlane(W, H, c, true);
  flap.style.clipPath = halfPlane(W, H, c, false);
  flap.style.transform = `matrix(0,-1,-1,0,${c.toFixed(1)},${c.toFixed(1)})`;
  flap.style.visibility = k > 0 ? 'visible' : 'hidden';
  // The line underneath only shows once the badge starts to lift.
  under.style.opacity = clamp(k * 3);
  wrap.style.opacity = 1 - clamp((p - 0.72) / 0.12);
  wrap.style.translate = `0 ${(-clamp((p - 0.7) / 0.3) * 60).toFixed(1)}px`;
}

// 2 · The headline lights up one word at a time as it rises through the screen.
const head = $('headline');
const words = head.textContent.trim().split(/\s+/);
head.textContent = '';
words.forEach((w, i) => { head.append(el('span', 'w', w)); if (i < words.length - 1) head.append(' '); });
const ws = [...head.querySelectorAll('.w')];
function drawWords() {
  const r = head.getBoundingClientRect();
  const k = reduced ? 1 : clamp((innerHeight * 0.88 - r.top) / (innerHeight * 0.4));
  const n = Math.round(k * ws.length);
  ws.forEach((w, i) => w.classList.toggle('on', i < n));
}

// Sections fade in once, the first time they are mostly on screen.
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.22 });
document.querySelectorAll('.reveal').forEach(s => io.observe(s));

// 4 · Skills on the left, jobs on the right, a wire for every place a skill was used.
// Indexes into items: 0 PolyU, 1 CLAIRE, 2 Wen Lab, 3 Mindplus, 4 MediConcepts intern, 5 AI analyst, 6 EEG device, 7 walker.
const SKILLS = [
  ['Deep learning', 'model training', [0, 1, 2, 3]],
  ['Segmentation', 'Attention U-Net, UNet++', [1]],
  ['Computer vision', 'image processing', [1, 2, 3]],
  ['Feature engineering', 'hand-built image features', [2]],
  ['Ultrasound and OCT', 'medical imaging', [1, 2, 3]],
  ['Python and Streamlit', 'dashboards', [4]],
  ['QA/RA and QMS', 'post-market surveillance', [4, 5]],
  ['AI tool evaluation', 'process improvement', [5]],
  ['EEG and hardware', 'event-related potentials', [6]],
  ['CAD and biomechanics', 'SolidWorks', [0, 7]],
];
const skillList = $('skill-list'), jobList = $('job-list'), wires = $('wires'), diagram = $('diagram');
const skillBtns = SKILLS.map(([name, sub], i) => {
  const li = el('li'), b = el('button');
  b.type = 'button';
  const t = el('span');
  t.append(el('span', 'nm', name), el('span', 'sub2', sub));
  b.append(t, el('span', 'num', String(10 + i * 2)));
  li.append(b);
  skillList.append(li);
  return b;
});
const jobBtns = items.map((it, j) => {
  const li = el('li'), b = el('button');
  b.type = 'button';
  const t = el('span');
  t.append(el('span', 'nm', SHORT[j]), el('span', 'sub2', `${it.kind} · ${it.dates.split(' – ')[0]}`));
  b.append(el('span', 'num', `Fig. ${it.fig}`), t);
  b.addEventListener('click', () => openSheet(j));
  li.append(b);
  jobList.append(li);
  return b;
});
let paths = [];
function drawWires() {
  if (getComputedStyle(wires).display === 'none') return;
  const d = diagram.getBoundingClientRect();
  wires.setAttribute('viewBox', `0 0 ${d.width} ${d.height}`);
  wires.innerHTML = '';
  paths = [];
  const NS = 'http://www.w3.org/2000/svg';
  SKILLS.forEach(([, , jobs], i) => {
    const a = skillBtns[i].getBoundingClientRect();
    const x1 = a.right - d.left, y1 = a.top + a.height / 2 - d.top;
    jobs.forEach(j => {
      const b = jobBtns[j].getBoundingClientRect();
      const x2 = b.left - d.left, y2 = b.top + b.height / 2 - d.top, mx = (x1 + x2) / 2;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`);
      wires.append(p);
      p.style.setProperty('--len', p.getTotalLength().toFixed(1));
      p.style.transitionDelay = `${(i * 0.07).toFixed(2)}s`;
      paths.push({ p, s: i, j });
    });
  });
  // Solder dots where the wires meet the boxes.
  const dot = (x, y) => { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 3); wires.append(c); };
  skillBtns.forEach(b => { const r = b.getBoundingClientRect(); dot(r.right - d.left, r.top + r.height / 2 - d.top); });
  jobBtns.forEach(b => { const r = b.getBoundingClientRect(); dot(r.left - d.left, r.top + r.height / 2 - d.top); });
}
// Pointing at a skill traces its jobs, and pointing at a job traces its skills.
function trace(skill, job) {
  const on = skill != null || job != null;
  const hotS = new Set(), hotJ = new Set();
  SKILLS.forEach(([, , jobs], i) => jobs.forEach(j => {
    if (i === skill || j === job) { hotS.add(i); hotJ.add(j); }
  }));
  paths.forEach(({ p, s, j }) => {
    const hot = s === skill || j === job;
    p.classList.toggle('hot', hot);
    p.classList.toggle('dim', on && !hot);
  });
  skillBtns.forEach((b, i) => { b.classList.toggle('hot', hotS.has(i)); b.parentNode.classList.toggle('dim', on && !hotS.has(i)); });
  jobBtns.forEach((b, j) => { b.classList.toggle('hot', hotJ.has(j)); b.parentNode.classList.toggle('dim', on && !hotJ.has(j)); });
}
skillBtns.forEach((b, i) => {
  b.addEventListener('pointerenter', () => trace(i, null));
  b.addEventListener('focus', () => trace(i, null));
  b.addEventListener('click', () => trace(i, null));
});
jobBtns.forEach((b, j) => {
  b.addEventListener('pointerenter', () => trace(null, j));
  b.addEventListener('focus', () => trace(null, j));
});
diagram.addEventListener('pointerleave', () => trace(null, null));
diagram.addEventListener('focusout', e => { if (!diagram.contains(e.relatedTarget)) trace(null, null); });

// 5 · One index card per item. A card opens its full sheet.
const TILT = [-1.4, 0.9, -0.5, 1.3, -1, 0.6, -1.2, 0.8];
items.forEach((it, j) => {
  const li = el('li'), b = el('button');
  b.type = 'button';
  b.style.setProperty('--tilt', `${TILT[j]}deg`);
  b.append(el('span', 'c-fig', `Fig. ${it.fig} · ${it.kind}`), el('span', 'c-title', it.title), el('span', 'c-org', it.org), el('span', 'c-date', it.dates));
  b.addEventListener('click', () => openSheet(j));
  li.append(b);
  $('cards').append(li);
});

const sheet = $('sheet');
function openSheet(j) {
  const it = items[j];
  $('sheet-kicker').textContent = `Fig. ${it.fig} · ${it.kind} · ${it.object}`;
  $('sheet-title').textContent = it.title;
  $('sheet-org').textContent = it.org;
  $('sheet-dates').textContent = it.dates;
  $('sheet-bullets').replaceChildren(...it.bullets.map(t => el('li', '', t)));
  $('sheet-tags').replaceChildren(...it.tags.map(t => el('li', '', t)));
  $('sheet-bench').href = `./#fig-${it.fig}`;
  sheet.showModal();
}
$('sheet-close').addEventListener('click', () => sheet.close());
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.close(); });

// 6 · Copy the email address.
$('copy').addEventListener('click', async () => {
  const text = CV.profile.email, btn = $('copy');
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = el('textarea'); t.value = text; document.body.append(t); t.select();
    document.execCommand('copy'); t.remove();
  }
  btn.textContent = 'Copied';
  setTimeout(() => { btn.textContent = 'Copy'; }, 1600);
});

let ticking = false;
function frame() { ticking = false; drawPeel(); drawWords(); }
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
addEventListener('resize', () => { frame(); drawWires(); });
document.fonts.ready.then(() => { frame(); drawWires(); });
frame();
drawWires();
