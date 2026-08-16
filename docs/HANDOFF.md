# UMS Parts Finder — Project Handoff

**For a new agent or teammate picking this up.** Read this top-to-bottom and you'll have
the full picture. Last updated ~2026-06-25.

---

## TL;DR

A Rocky-Mountain-ATV-style **"Find Parts For Your Machine"** vehicle-fitment finder for
**unitedmotorsports.com**. Customer picks Type → Year → Make → Model and sees the parts
that fit. It is **live on the store** and **hosted on GitHub Pages**. Built with plain
HTML/CSS/JS + small Node scripts — no framework, no database, no server. The catalog is
the source of truth.

- **Live finder:** https://justcallmefry.github.io/UMS/finder/
- **Repo:** https://github.com/justcallmefry/UMS  (branch `main`)
- **Local clone:** `C:\Users\ChrisFry\UMS Part Search\UMS`
- **Store:** Ecwid / Lightspeed eCom **E-Series** (Ecwid under the hood), store ID `131197020`
- **People:** Chris (cfry@kizik.com) building it; **Ray / Raymond Butts** = owner, holds API secrets.

---

## What it does & how it works

**Two catalog fields drive everything** (Ecwid product *Attributes*):
- **`Riding Style`** → machine type: `Dirtbike` / `ATV` / `UTV` / `Street` / `ADV/Dualsport` / `Cruiser`
- **`Vehicle`** → specific fitment, e.g. `Honda CRF110F (19-25')` (make + model + year range)

**Pipeline:** catalog CSV export → `fitment/build-data.js` → generates
`data/ums/vehicles.json` (the Year/Make/Model dropdown registry) and
`data/ums/fitment-index.json` (per-product fitment for matching). Those two files are
copied into `docs/finder/` (what GitHub Pages serves).

**Matching** (`fitment/match.js`, mirrored in `docs/finder/index.html`): a product is
bucketed as
- **exact** — a clause with a real MODEL matching the picked model + year window (headline "N parts fit", blue FITS badge)
- **broadMake** — only a make-level clause matches (catalog tagged it "fits all <make>"); shown in a separate "Fits many <make> models" section, NOT counted as exact
- **typeMatch** — clause-less, matches the riding-style type
- **universal** — fits everything

**Year ranges work fully:** `19-25'` → 2019–2025; a 2022 pick matches, 2018/2026 don't.
Handles 2- and 4-digit years, open-ended (`19-Up`, `2022+`), slashed models
(`CRF250R/450R`), and multi-make tags.

---

## File map

| Path | What |
|------|------|
| `fitment/parse.js` | Free-text fitment → structured clauses (the hard part) |
| `fitment/normalize.js` | Helpers (year expansion, model-family expansion) + tests |
| `fitment/match.js` | Vehicle → matching products, bucketed |
| `fitment/build-data.js` | CSV → `data/ums/*.json` |
| `fitment/report-examples.js` | Coverage report + good/broad/missing examples |
| `fitment/*.test.js` | 41 tests (parse, normalize, match) — all passing |
| `data/ums/*.json` | Generated registry + index + coverage |
| `docs/finder/bar.html` | The header bar (site-wide); navigates to results page |
| `docs/finder/index.html` | The results page (bar + product grid); auto-runs from URL params |
| `docs/finder/*.json` | Copies of the data files GitHub Pages serves |
| `refresh-finder.js` | One command: rebuild data + copy to docs/finder + commit + push |
| `serve-finder.js` + `.claude/launch.json` | Local preview server (port 4321) |
| `docs/how-the-finder-works.md` | Plain-language overview (for leadership) |
| `docs/how-to-tag-parts.md` | Exact tagging format (for catalog staff) |
| `docs/fitment-cleanup-examples.md` | Real good/broad/missing examples (for Ray) |

**Ignore / out of scope:** the `middleware/` folder and ARI/Partstream files are from an
earlier direction (OEM-diagram-to-cart) and are NOT part of this finder. `lightspeed.js`
there targets the wrong platform (C-Series). Don't build on them.

---

## Common commands (run from the repo root)

```bash
# Rebuild the data from a fresh catalog CSV export
node fitment/build-data.js "C:\path\to\catalog_export.csv"

# One-shot: rebuild + copy into docs/finder + commit + push (updates the live site)
node refresh-finder.js "C:\path\to\catalog_export.csv"

# Run the tests
node --test fitment/parse.test.js fitment/normalize.test.js fitment/match.test.js

# Coverage + examples report
node fitment/report-examples.js "C:\path\to\catalog_export.csv"
```

Most recent export used: `C:\Users\ChrisFry\Downloads\catalog_2026-06-12_18-50.csv`.

---

## Deploy & the git-push gotcha (READ THIS)

- **Hosting:** GitHub Pages is enabled, source = `main` branch `/docs` folder. The finder
  serves at `https://justcallmefry.github.io/UMS/finder/`. Changes to `docs/finder/*` go
  live ~1 min after a push — **no Ecwid change needed** (the store embeds the Pages URL in an iframe).
- **Pushing:** requires approving the **Git Credential Manager "Select an account"** popup
  on Chris's Windows desktop → choose **`justcallmefry`** (NOT `x-access-token`). The
  cached token expires between sessions, so a fresh push usually needs that dialog. An
  agent cannot approve it non-interactively.
- **CDN cache:** after a push, the plain URL may serve the old copy briefly. Verify with a
  cache-bust: `curl "https://justcallmefry.github.io/UMS/finder/index.html?cb=$(date +%s)"`.

## Ecwid embed (two snippets)

Both go in Ecwid *Website → Edit Site → Add Section → Advanced Solutions → Embed & Custom Code*.
Each carries a `message` listener handling `umsFinderHeight` (auto-resize) and
`umsNavigate` (product/results navigation, since Ecwid sandboxes the iframe).

- **Header bar** (site-wide): iframe → `.../finder/bar.html?results=<find-parts page URL>`
- **Results page** (a dedicated Instant Site page): iframe → `.../finder/` + `location.hash`

Exact snippets are in the conversation and in `docs/how-the-finder-works.md`.

---

## Current coverage (2,559 products, last export)

- ✅ 22% precise `Vehicle` tags · ◐ 25% type-only · ❌ **50% no fitment** (~990 of those in "OEM Parts / Parts")
- Registry: 14 makes, 468 models, years 1950–2026
- The finder is correct; accuracy is now limited by **data coverage**, not logic.

---

## Status: done vs pending

**Done & live:** parser, matcher (incl. the over-match fix for broad tags), data pipeline,
finder UI (motorsport redesign + mobile 2×2 selects), GitHub Pages hosting, blue branding,
sandbox-safe clicks, RMATV-style header-bar→results-page split, 41 tests, all docs.

**Pending — Chris's Ecwid setup:**
1. Create a dedicated "Find Parts" Instant Site page; paste the **results** embed there.
2. Put the **bar** embed in the header with `?results=<that page URL>`.
3. Set the homepage finder **section background to white** (the gray strip is Ecwid's section bg, not the finder).
4. Publish.

**Pending — data & automation:**
- Ray to clean up tags (see `docs/how-to-tag-parts.md`), especially the ~990 untagged OEM parts.
- **Open question raised to Ray:** does OEM fitment data already exist (supplier feed / old
  Oracle export / ARI-PartStream) so we can bulk-import instead of hand-tagging?
- Monday: Ray + Ecwid **REST API token** → automate a nightly data refresh (GitHub Actions,
  token stored in encrypted repo secrets — NEVER in the finder, which needs no token).

**Optional code task (offered, not done):** model-spelling normalization so `SX65` and
`65SX` (same machine, two spellings) merge into one dropdown entry.

---

## Gotchas / notes for the next agent

- Some earlier notes were mis-dated `2026-06-12`; the work is actually ~`2026-06-25`.
- The public finder needs **no API token** — that was a deliberate design choice.
- When editing `docs/finder/index.html`, keep the element IDs and the `match()` bucket
  logic in sync with `fitment/match.js`; they're intentionally the same algorithm.
- Persistent project memory also exists (auto-loads in a new session in this project) and
  mirrors this file.
