# How the "Find Parts For Your Machine" tool works

A plain-language overview of where the finder gets its data, how it filters, and
what makes it accurate.

## Where the data comes from

Every product in our Lightspeed / Ecwid catalog can carry two fitment fields:

- **Riding Style** — the machine *type* the part is for: Dirtbike, ATV, UTV, Street, ADV/Dualsport, Cruiser.
- **Vehicle** — the specific machines it fits, e.g. `KTM SX65 (1998-2010)`.

The finder reads these straight from a catalog export. **The catalog is the source
of truth** — there is no separate parts database to maintain. Add a part and tag it,
and the finder can show it.

## How a customer search works

The customer picks **Type → Year → Make → Model**. A product appears for that machine
only if its **Vehicle** tag includes that make, that model, and a year range that
covers the chosen year.

Results are grouped, strongest first:

1. **"X parts fit"** — parts whose tag names that exact model + year (these carry a blue **FITS** badge).
2. **"Fits many [make] models"** — parts tagged broadly for the brand (no specific model/year), so they likely fit but the listing isn't model-specific.
3. **"Also fits [type]"** — parts tagged only by machine type (e.g. a dirt-bike chain lube).
4. **"Universal"** — parts that fit everything (oil, apparel, whip lights).

## Why some results can look wrong — and how we handle it

A part is only as precise as its tag. We have two kinds:

| Tag style | Example | Result |
|-----------|---------|--------|
| **Precise** | `KTM SX65 (1998-2010)` | Matches the exact machine ✅ |
| **Broad** | `KTM, Husqvarna, GasGas – Most Years and Models` | "Fits most KTMs" — no specific model/year |

The tool used to treat broad tags as exact matches, which flooded a specific-vehicle
search with every same-brand part. It now separates them: precise tags drive the
confident **"X parts fit"** list; broad tags go in their own **"Fits many [make] models"**
section, so customers still see them but aren't misled.

## The one lever that improves accuracy: tag quality

The tool can only be as exact as our product tags. The more parts we tag with a
specific **Make + Model + Year** (instead of "most models"), the more land in the
confident "parts fit" list. See **[how-to-tag-parts.md](how-to-tag-parts.md)** for the
exact format staff should use when adding or editing products.

## Where coverage stands today

- ~**25%** of the catalog has vehicle-specific fitment (mostly aftermarket parts).
- ~**50%** has at least a machine type.
- The large **OEM Parts** group is mostly **untagged** — see the data-gaps note below.

The finder improves automatically as we tag more — no code changes needed.

## Known data gaps to close (biggest lever first)

1. **OEM Parts are untagged (~1,000 products).** These are vehicle-specific by nature
   but currently carry no fitment, so they don't appear in any vehicle search. Decision
   needed: tag them, or serve OEM parts through the separate OEM-diagram (ARI) tool.
2. **Inconsistent model spelling.** The same machine tagged two ways (e.g. `SX65` vs
   `65SX`) splits its parts across two dropdown entries. Fixed best by a consistent
   model name per machine (see the tagging guide) plus a normalization pass in code.
3. **Free-text tags.** The Vehicle field is free text, which is flexible but invites
   the inconsistencies above. A consistent format (the tagging guide) keeps it clean.
