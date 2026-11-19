# Neon Tide Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/zammili/gta6-cover-art-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/zammili/gta6-cover-art-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

A small, fully offline web app that turns a photo into GTA-style cover art.
You load a picture, the studio arranges it into the multi-panel poster
layout of a game cover, grades it with a hand-drawn sunset-neon look, stamps
your caption across it in poster lettering, and exports the result as a PNG.
Everything happens in the browser on your own machine — no uploads, no
network calls, no build step.

## What it does

- **Poster renderer** (`app/src/poster.js`) — draws the cover on a canvas:
  a panelled layout over a painted dusk scene (sun, sea, pier, palms),
  with your photo composited into the panels under a warm neon grade,
  plus the caption lettering and a subtle paper grain.
- **Editor** (`app/src/main.js`, `app/index.html`, `app/style.css`) — the
  studio page around the renderer:
  1. **Photo** — load one or more images from disk, or start from the two
     bundled samples (`app/samples/pier.jpg`, `app/samples/boulevard.jpg`).
     One photo can fill a single selected panel, or every panel at once.
  2. **Panel & framing** — click a panel in the poster (or pick it from the
     list) and frame it with zoom and focus sliders; a panel can also be
     cleared back to the drawn scene.
  3. **Caption** — the title text lettered onto the cover.
  4. **Export** — render the finished cover as a PNG at square
     (1080 × 1080), portrait (1080 × 1350) or wide (1920 × 1080) size.

## Running it

The app is plain static files under `app/` — HTML, CSS and ES modules, no
dependencies. Two ways to open it:

- **With the bundled server** (recommended, because module scripts can be
  picky about `file://`):

  ```sh
  node serve.ts          # then open http://localhost:8080
  ```

  `serve.ts` is a tiny Node static server for the `app/` folder; set
  `PORT` to change the port. Node 22 or later runs the `.ts` files
  directly.

- **Directly** — open `app/index.html` in a browser that allows module
  scripts from `file://`.

### Screenshot mode

For automated captures the editor accepts a query string:
`?shot=cover` renders just the finished cover, `?shot=editor` shows the
whole studio, and `photo` / `caption` pick the sample and title — e.g.
`?shot=cover&photo=pier&caption=Neon%20Tide%20Run`. Once the scene on
screen is final the page sets `window.__shotReady`, so a screenshot tool
knows when to fire. The four captures in `screenshots/` were taken this
way, at the sizes listed in `shots.json`.

## How the hand-in works

`main.ts` is the entry's hand-in program (Node 22, standard library only):

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

It copies `app/` and `screenshots/` into the output directory
(`MAKEFUN_OUTPUT_DIR`, defaulting to `/output`) and writes a
`dossier.json` there using `buildDossier` from the vendored kit library
(`vendor/makefun-app.ts`). The dossier is built under the scorer's caps —
at most 4 screenshots of 256 KiB each, file and byte budgets for `app/`,
and a cap on the source text it embeds — so the dossier on disk is exactly
the one the gate rebuilds and compares.

---

<sub>Entered on [make.fun](https://make.fun/?ref=nj55s4jw&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
