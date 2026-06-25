# Find Parts filter — the fields it reads + real examples to clean up

For whoever manages the catalog. The vehicle finder reads **two product attributes**
straight from our Lightspeed/Ecwid catalog. Clean these up and the finder gets better
automatically — no code changes.

## The two fields the filter is tied to

In a product's **Attributes**:

| Attribute name | What it controls | Example value |
|----------------|------------------|---------------|
| **Riding Style** | The machine *type* | `Dirtbike` (or `Dirtbike/ATV/UTV` for multi) |
| **Vehicle** | The specific make + model + years it fits | `KTM SX65 (1998-2010)` |

(A handful of products also use a **Machine** variation option; same idea.)

Allowed Riding Style values: `Dirtbike` · `ATV` · `UTV` · `Street` · `ADV/Dualsport` · `Cruiser`.

## Where the catalog stands (2,559 products)

| Status | Count | Notes |
|--------|------:|-------|
| ✅ Precise Vehicle tag (make+model+year) | 562 (22%) | These work great |
| ⚠️ Broad / brand-only tag | 38 (1%) | Tighten to a model + year |
| ◐ Type only (no Vehicle) | 648 (25%) | Shows under "Also fits [type]" |
| Universal | 10 | Fine |
| ❌ **No fitment at all** | **1,285 (50%)** | **Biggest gap — see below** |

## ✅ GOOD examples — precise `Vehicle` tags (do more of this)

| SKU | Product | Vehicle tag |
|-----|---------|-------------|
| 2861937118 | Acerbis Full Plastic Kit Honda CRF110F | `Honda CRF110F (19-25')` |
| 2314413914 | Acerbis Full Plastic Kit | `Honda CRF250R (14-17') / CRF450R (13-16')` |
| 2858920227 | Acerbis Full Plastic Kit | `Honda CRF250R (22-24') CRF450R (21-24')` |
| 2733430011 | Acerbis Full Plastic Kit Husqvarna | `Husqvarna FE250 / FE350 / FE450 / FE501 / TE250I / TE300 (17-19')` |

## ⚠️ BROAD examples — brand-only, no model/year (tighten these)

These say only the *brand*, so they get pushed to a weaker "Fits many [make] models" list
instead of the confident "parts fit" list. Add the specific model(s) + years.

| SKU | Product | Vehicle tag today | Should look like |
|-----|---------|-------------------|------------------|
| 18-9038 | All Balls Brake Caliper Piston Kit | `Polaris Models` | `Polaris RZR XP 1000 (14-25)` etc. |
| AB6-BT-23C | All Balls HD Axle CV Boot Kit | `Arctic Cat Machines` | `Arctic Cat Wildcat XX (18-24)` etc. |
| 25-1692 | All Balls Rear Wheel Bearing Kit | `Harley Davidson` | `Harley Davidson Touring (08-24)` etc. |

## ❌ MISSING examples — no Riding Style, no Vehicle (mostly OEM parts)

These don't appear in any vehicle search because they carry no fitment at all.

| SKU | Product |
|-----|---------|
| 1WD-E4613-00-00 | YAMAHA GASKET, EXHAUST PIPE |
| 1WD-E8111-00-00 | YAMAHA PEDAL, SHIFT |
| 14093-1057 | OEM KAWASAKI COVE SIDE LWR RH |
| 27000-40851 | Suzuki OEM Drive Chain Kit - GSX-R1000 |
| 0SV06-HL6-A00 | MIRROR, REARVIEW |
| 10-0115 | KFI ROLLER FAIRLEAD |

### Where the 1,285 missing live (focus cleanup here)

| Count | Category |
|------:|----------|
| 812 | Parts / OEM Parts |
| 179 | Parts |
| 55 | (no category) |
| 16 | Apparel |
| 13 | Accessories / Dirtbike / Body |
| 13 | Accessories / ATV / Controls |

**~990 of the 1,285 are OEM Parts / generic Parts.** That one bucket is the single
biggest opportunity — and a good place to ask whether OEM fitment already exists in a
supplier feed or the old system before hand-tagging.

## How to tag correctly

See **[how-to-tag-parts.md](how-to-tag-parts.md)** for the exact format and rules.

*Regenerate this report any time after a new export: `node fitment/report-examples.js "<catalog.csv>"`.*
