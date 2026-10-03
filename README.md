# Wong Yi Chun Thomas · CV House

A walkable 3D house where every object opens one part of my CV: internships, projects, my degree and a summer camp.
Live at **https://wong1357.github.io**.

- Walk with WASD or the arrow keys, open an object with E, or just click it. Drag to turn the house.
- Prefer a plain list? Scroll down to the Index, which has the same content.
- Built with three.js (r128) and plain HTML, CSS and JavaScript. No build tools needed to host it.

## Editing

The page is generated from `src/`:

- `src/page.html` holds the markup and styles.
- `src/app.js` holds the CV content (the `ITEMS` list at the top) and the 3D house.
- `python3 src/build.py pages .` rebuilds `index.html` in this folder.
