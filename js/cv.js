import { CV } from './content.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// The plain CV in a dialog, opened by any [data-open-cv] control. Shared by both pages.
export function renderCV() {
  const p = CV.profile, body = $('cv-body');
  const h = el('h1', '', p.short); h.id = 'cv-name';
  body.append(h, el('p', 'cv-sub', `${p.degree}. Class of ${p.classOf}.`));
  const contact = el('p', 'cv-contact');
  const mail = el('a', '', p.email); mail.href = `mailto:${p.email}`;
  const gh = el('a', '', 'github.com/WONG1357'); gh.href = p.github; gh.target = '_blank'; gh.rel = 'noopener';
  contact.append(mail, ' · ', gh, ' · ', p.languages.join(', '));
  body.append(contact);
  for (const [label, kind] of [['Experience', 'Experience'], ['Education', 'Education'], ['Projects', 'Project']]) {
    const items = CV.items.filter(i => i.kind === kind);
    if (!items.length) continue;
    body.append(el('h2', '', label));
    for (const it of items) {
      const a = el('article'), head = el('div', 'cv-head');
      head.append(el('h3', '', it.title), el('p', 'meta', it.dates));
      const ul = el('ul');
      it.bullets.forEach(b => ul.append(el('li', '', b)));
      a.append(head, el('p', 'org', it.org), ul);
      body.append(a);
    }
  }
  const d = $('cv');
  document.querySelectorAll('[data-open-cv]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); d.showModal(); }));
  $('cv-close').addEventListener('click', () => d.close());
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
  return d;
}
