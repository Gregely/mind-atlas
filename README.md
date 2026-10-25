# Mind Atlas

A quiet, catalogued notebook. Write one entry a day; each becomes a numbered **plate**
with its own instrument-like glyph, plotted on a star chart that keeps growing outward.

Everything stays in your browser (localStorage). There is no backend and no network
use except for loading Google Fonts.

## Run it

Requires Node 18+.

```bash
npm install
npm run dev        # open http://localhost:5173
```

Production build (static files in `dist/`, can be opened from any static host):

```bash
npm run build
npm run preview
```

## Sections

| Key | Section | What it is |
|-----|---------|------------|
| 1 | Catalogue | Accession ledger of plates, grouped by month; filter by register or tag |
| 2 | Atlas | Pannable, zoomable star chart. Shared tags form constellations; distance from the centre follows the order of plates |
| 3 | Cabinet | Figures of your tags, registers and words over time (periodic table, spectrum, strata, lexicon) |
| 4 | Questions | Unresolved questions, each linkable to plates |
| 5 | Reading Back | Walk through plates in order, add margin notes, arrive at Further Study |
| 6 | Archive | Theme, JSON / Markdown export, JSON import (merge or replace), glyph key |

## Keyboard

`/` or `Ctrl K` search · `N` new plate · `1–6` sections · `T` Ink/Paper theme · `?` reference card
On a plate: `← →` neighbours, `E` edit. Writing: `Ctrl ↵` save. Reading: `← →`, `A` margin note, `Esc` leave.
Atlas: drag / arrows / WASD to pan, wheel or `+ −` to zoom, `0` fit, `L` labels, `M` minimap.

## Your data

- Stored under the key `mind-atlas:v1` in localStorage; an unsaved new-plate draft lives under `mind-atlas:draft`.
- **Export JSON** regularly if the notebook matters to you: clearing browser data erases localStorage.
- Plate numbers are never reused, even after a plate is removed.

## Code map

```
src/
  types.ts              data model (Entry, Question, StudyNote, AtlasData)
  App.tsx               shell: navigation, global shortcuts, routes
  lib/store.tsx         the store: reducer, actions, persistence, import validation
  lib/atlasLayout.ts    deterministic spiral + force layout for the Atlas
  lib/stats.ts          counts for the Cabinet of Themes
  lib/io.ts             JSON / Markdown export, import & merge
  lib/registers.ts      the five registers (edit labels here)
  lib/text.ts           word counts, stopwords for the lexicon, tag normalisation
  components/Glyph.tsx  the procedural glyph (seeded from tags + word count)
  views/                one file per section
  styles/base.css       colour tokens for both themes, type, buttons, fields
```

Colours for both themes are CSS variables at the top of `src/styles/base.css`.
All motion respects `prefers-reduced-motion`.
