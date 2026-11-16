# Hearthvale

A cozy village-builder in the browser: a little settlement grows from a campfire to a town, season by season. No combat, no rivals.

## Play it

It's a static web page: no build step and no server code.

- **On your computer:** from this folder, run `python3 -m http.server 8000`, then open http://localhost:8000. (Opening `index.html` straight from disk won't work, because browsers block JavaScript modules on `file://`.)
- **On GitHub Pages:** go to Settings → Pages, and under "Build and deployment" choose "Deploy from a branch", then the `main` branch and the `/ (root)` folder. The game will be at `https://<your-username>.github.io/<repository>/`.

## What's where

| Folder | What it holds |
|---|---|
| `index.html` | The page: the layout, styles and the canvas |
| `js/main.js` | Starts the game: loading, saving, the game loop |
| `js/core/` | The simulation: villagers, buildings, the economy, the directors that run the village, festivals, saves. It never draws anything, so it can be tested on its own. |
| `js/ui/` | Everything on screen: drawing the village, menus, bubbles, input |
| `js/ui/render/` | Drawing pieces: buildings, art slots (`sprites.js`), seasonal decorations, work badges |
| `art/` | The game's pictures and `manifest.json`, which says which picture fills which art slot. Anything without a picture is drawn in code. |
| `tools/models/` | The 3D models, in Python: `kit.py` (shapes, palette, file writer), then one file per group (homes, workshops, farms, civic, decor, resources). `catalogue.py` says which model fills which slot. |
| `tools/render3d.py` | Renders the 3D models into the game's art, in headless Chrome, using `tools/render3d/render.html` |
| `tools/trim.py` | Cuts the background off a picture and installs it as art |
| `tools/slots.mjs` | Lists every art slot and its size (`art/SLOTS.md`) |
| `test/` | Checks and simulations (see below) |

## Checks

These need Node 18 or newer.

```
node test/run.mjs              the game's checks
node test/render-smoke.mjs     draws every building, at every level and in every festival, to catch drawing errors
node test/sim.mjs 8 24 1       simulates village 8 for 24 days with Free build on, and reports how it grows
python3 test/trim-check.py     checks the background trimmer
```

## Remaking the 3D art

These need Python 3 with numpy and Pillow, the Python `playwright` package, and Google Chrome.

```
python3 tools/models/catalogue.py          writes every model to tools/models/out/
python3 tools/render3d.py                  renders them all into art/ and updates art/manifest.json
python3 tools/render3d.py homes            just one group
python3 tools/render3d.py --preview-only   pictures in tools/previews/; art/ is left alone
```

The renderer expects Chrome at `/usr/bin/google-chrome`. Change `CHROME` at the top of `tools/render3d.py` if yours is elsewhere. On a Mac, that's `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.
