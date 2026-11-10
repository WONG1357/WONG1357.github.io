# Thomas Wong · The Engineer's Bench

My CV as a workbench drawn like a patent sheet. Each object on the bench is one part of my CV: my degree, my internships and my projects. Click an object to open it.
Live at **https://wong1357.github.io**.

- **Bench** (`index.html`): the 3D desk. Click an object, or use the figure index at the bottom. Arrow keys step through the figures and Escape goes back.
- **Intro** (`intro.html`): a scrolling page with the same content: about me, a map from skills to jobs, and an index card for each item.
- **CV**: the plain CV, available from the top bar on both pages.

Built with three.js and GSAP (loaded from jsdelivr) and plain HTML, CSS and JavaScript. There is no build step.

## Editing

- `js/content.js` holds all the CV content. Both pages read from it.
- `js/objects.js` models the eight objects and the room. `js/ink.js` is the patent-drawing renderer.
- `js/main.js` runs the bench and `js/intro.js` runs the intro page.
