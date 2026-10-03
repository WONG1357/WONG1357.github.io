"""Assemble index.html from page.html + app.js.
`python3 build.py` writes ../index.html for the Artifact preview, `python3 build.py pages <dir>` writes a full document
for GitHub Pages, and `python3 build.py test <dir>` writes a local-library copy for testing."""
import sys, os
here = os.path.dirname(os.path.abspath(__file__))
page = open(os.path.join(here, 'page.html')).read()
app = open(os.path.join(here, 'app.js')).read()
CDN = {
  'three': 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'rbox': 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/geometries/RoundedBoxGeometry.js',
  'room': 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/environments/RoomEnvironment.js',
}
LOCAL = {
  'three': 'node_modules/three/build/three.min.js',
  'rbox': 'node_modules/three/examples/js/geometries/RoundedBoxGeometry.js',
  'room': 'node_modules/three/examples/js/environments/RoomEnvironment.js',
}
def assemble(src):
    tags = '\n'.join(f'<script src="{src[k]}"></script>' for k in ('three', 'rbox', 'room'))
    return page + '\n' + tags + '\n<script>\n' + app + '\n</script>\n'
SITE = 'https://wong1357.github.io/'
FAVICON = ("data:image/svg+xml," + "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3E%3Crect width='30' height='30' rx='7' fill='%230f141d'/%3E"
           "%3Cpath d='M15 5 24 10.5v9L15 25l-9-5.5v-9z' fill='none' stroke='%23edf1ff' stroke-width='1.6'/%3E%3Ccircle cx='15' cy='16' r='2.6' fill='%23ffb81f'/%3E%3C/svg%3E")
def standalone(src):
    # a full HTML document for static hosting: head gets the meta, styles and social cards; body gets the markup
    cut = page.index('</style>') + len('</style>')
    head, body = page[:cut], page[cut:]
    tags = '\n'.join(f'<script src="{src[k]}"></script>' for k in ('three', 'rbox', 'room'))
    meta = (f'<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            f'<meta name="color-scheme" content="light dark">\n<link rel="icon" href="{FAVICON}">\n'
            f'<link rel="canonical" href="{SITE}">\n<meta property="og:type" content="website">\n<meta property="og:url" content="{SITE}">\n'
            f'<meta property="og:title" content="Wong Yi Chun Thomas · CV House">\n'
            f'<meta property="og:description" content="Biomedical Engineering at PolyU. Walk through a small 3D house where every object opens one internship or project.">\n'
            f'<meta property="og:image" content="{SITE}og.jpg">\n<meta name="twitter:card" content="summary_large_image">\n')
    return f'<!doctype html>\n<html lang="en">\n<head>\n{meta}{head}\n</head>\n<body>\n{body}\n{tags}\n<script>\n{app}\n</script>\n</body>\n</html>\n'
if len(sys.argv) > 2 and sys.argv[1] == 'pages':
    open(os.path.join(sys.argv[2], 'index.html'), 'w').write(standalone(CDN))
    print('pages build ok')
elif len(sys.argv) > 2 and sys.argv[1] == 'test':
    out = assemble(LOCAL)
    html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="stylesheet" href="fonts.css"><style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + out + '</body></html>'
    open(os.path.join(sys.argv[2], 't.html'), 'w').write(html)
    print('test build ok')
else:
    open(os.path.join(here, '..', 'index.html'), 'w').write(assemble(CDN))
    print('index.html built')
