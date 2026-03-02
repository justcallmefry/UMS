# Vehicle Data Model & Fitment Schema

**Project:** UMS — Powersports Online Store  
**Related:** [Technical Architecture](technical-architecture.md)  
**Last updated:** 2025-02-26

This document defines the vehicle hierarchy, product fitment classification, relationship logic, and where this data lives (Lightspeed vs. external service). It supports filtering by vehicle, “My Garage,” and SEO/fitment content.

---

## 1. Vehicle Hierarchy

Vehicles are structured as a four-level tree (optionally five with Trim).

```
VehicleType (segment)
    └── Year
            └── Make (manufacturer)
                    └── Model
                            └── Trim (optional)
```

**Canonical list (examples):**

| Level      | Examples |
|-----------|----------|
| VehicleType | Motorcycle, ATV, UTV, Dirtbike, PWC, Snowmobile |
| Year      | 2020, 2021, 2022, 2023, 2024 |
| Make      | Yamaha, Honda, Kawasaki, Polaris, Can-Am, Suzuki |
| Model     | YZ250F, CRF450R, KX450, RZR 1000, Maverick |
| Trim      | (optional) Base, Sport, Premium, Limited |

**Entity definitions:**

| Entity       | Description | Uniqueness |
|--------------|-------------|------------|
| VehicleType  | Segment (e.g. Dirtbike). Used for “type specific” fitment and nav. | Code or slug (e.g. `dirtbike`) |
| Vehicle      | One concrete vehicle: one combination of Type + Year + Make + Model (+ optional Trim). | Type + Year + Make + Model + Trim |
| VehicleRecord| Single row in your system representing one Vehicle. | Primary key (id or composite) |

---

## 2. Fitment Classification on Products

Every sellable product has a **fitment scope** that determines how it is filtered and displayed.

| Fitment level | Description | Filter behavior | Example |
|---------------|-------------|-----------------|---------|
| **Non-vehicle specific** | Universal; not tied to any vehicle. | Shows in all parts browsing; vehicle filter does not narrow these out (or they’re always included). | Helmets, oil, gloves, casual apparel |
| **Type specific** | Applies to a vehicle type (segment), not a single Y/M/M. | When user picks “Dirtbike,” show all Type-specific for Dirtbike + all Vehicle-specific for Dirtbike. | “Dirtbike tires,” “ATV winches” |
| **Vehicle specific** | Tied to one or more concrete vehicles (Year/Make/Model [+ Trim]). | When user picks a vehicle (e.g. 2023 Yamaha YZ250F), show only products that list that vehicle (and optionally type-specific for that type). | OEM part for 2023 Yamaha YZ250F, model-specific skid plate |

**Single dropdown (or equivalent) on product:**

- `fitment_scope`: `universal` | `type_specific` | `vehicle_specific`

**Additional fields when `fitment_scope` is not `universal`:**

- For **type_specific:** `vehicle_type_ids` or `vehicle_type_codes` (e.g. `["dirtbike","atv"]`).
- For **vehicle_specific:** `vehicle_ids` (list of Vehicle primary keys) or explicit Y/M/M (+ Trim) pairs. Prefer storing **vehicle_ids** for consistency and one source of truth.

---

## 3. Schema Options: Lightspeed-Only vs. External Vehicle Service

Two viable approaches. Choose one and implement consistently.

---

### Option A: Lightspeed-Only (Custom Fields / Metafields)

Store vehicle and fitment data entirely in Lightspeed using custom attributes, metafields, or tags.

**Vehicle list:**

- **Option A1 — Custom resource in Lightspeed:** If Lightspeed supports custom entities (e.g. “Vehicle”), store VehicleType, Year, Make, Model, Trim and give each an ID. Products then reference these via a custom field (e.g. “vehicle_ids” as multi-select or comma-separated).
- **Option A2 — No vehicle table in Lightspeed:** Store vehicles as reference data in a **static file or small JSON** (or in your middleware DB) and only store **on the product**:
  - `fitment_scope`: string
  - `vehicle_type_codes`: string (e.g. `"dirtbike,atv"`) when type_specific
  - `vehicle_fitment`: string (e.g. `"2023|Yamaha|YZ250F;2024|Yamaha|YZ250F"`) when vehicle_specific  

  Filtering is done in the storefront/middleware by reading these fields and matching against a canonical vehicle list (held in code or middleware).

**Product fields in Lightspeed (example):**

| Field (Lightspeed)     | Type   | Use |
|------------------------|--------|-----|
| fitment_scope          | string | `universal`, `type_specific`, `vehicle_specific` |
| vehicle_type_codes    | string | Comma-separated type codes when type_specific |
| vehicle_fitment       | string | Encoded Y/M/M (or vehicle IDs if A1) when vehicle_specific |
| oem_part_number       | string | For ARI-origin parts; also used as external ID for find-or-create |
| oem_manufacturer      | string | Manufacturer name/code from ARI |

**Pros:** No extra service; everything in one platform.  
**Cons:** Complex filtering (e.g. “all products for this vehicle”) may require fetching many products and filtering in app, unless Lightspeed supports filtering by custom field in API.

---

### Option B: External Vehicle & Fitment Service

A small service (API + DB) holds vehicles and product–vehicle relationships; Lightspeed holds only minimal fitment hints for display/SEO if desired.

**Vehicle service data model:**

```text
VehicleType
  id (PK)
  code (unique)   e.g. "dirtbike"
  name            e.g. "Dirtbike"
  sort_order

Vehicle
  id (PK)
  vehicle_type_id (FK)
  year
  make
  model
  trim (nullable)
  slug (unique)    e.g. "2023-yamaha-yz250f"  (for URLs and lookups)
  created_at

ProductFitment (product ↔ vehicle relationship)
  id (PK)
  lightspeed_product_id   (or external SKU)
  vehicle_id (FK)
  source                  "catalog" | "ari"   (for OEM parts created from diagrams)
  created_at
```

**Product-level fitment (in Lightspeed or in Vehicle Service):**

| Location        | Field / Table     | Purpose |
|----------------|-------------------|---------|
| Lightspeed     | fitment_scope     | universal / type_specific / vehicle_specific |
| Lightspeed     | vehicle_type_ids  | When type_specific (optional if duplicated in service) |
| Vehicle Service| ProductFitment    | When vehicle_specific: which vehicles this product fits |

**Flow:**

- Storefront or middleware calls Vehicle Service: “Give me all vehicle IDs for type Dirtbike” or “Give me vehicle ID for 2023 Yamaha YZ250F.”
- “Products for this vehicle”: Vehicle Service returns `lightspeed_product_id`s for that vehicle_id; storefront fetches product details from Lightspeed, or middleware aggregates.
- ARI “add to cart”: When creating the product in Lightspeed, middleware also creates ProductFitment rows in Vehicle Service for the vehicle(s) from ARI context.

**Pros:** Flexible filtering, one place for vehicle hierarchy and “My Garage” (e.g. store user_id + vehicle_id). Clean URLs and schema (e.g. `/parts/dirtbike/2023-yamaha-yz250f`).  
**Cons:** Extra service to build and operate; need to keep Lightspeed product IDs in sync (e.g. when creating on-demand from ARI).

---

## 4. Chosen Approach: Option A (Lightspeed-Only)

**Decision:** Use Option A. Vehicle hierarchy lives in a **static list** (JSON/CSV or in middleware). Product fitment is stored in **Lightspeed custom fields**. Filtering is done in the storefront or middleware by reading those fields and matching against the static list.

**My Garage:** Store in Lightspeed customer metafields (e.g. `garage_vehicle_ids` as JSON array of vehicle slugs).

### Option A implementation notes

**Static vehicle list**

- Hold one canonical list of vehicles (e.g. `data/vehicles.json` or in middleware). Each entry: `type`, `year`, `make`, `model`, `trim` (optional), and a stable **slug** (e.g. `2023-yamaha-yz250f`) for URLs and lookups.
- Vehicle types: keep a small list of codes (e.g. `dirtbike`, `atv`, `utv`, `motorcycle`, `pwc`, `snowmobile`). Use the same codes everywhere.

**Lightspeed product custom fields (exact names TBD per Lightspeed API)**

| Field | Type | Values / format |
|-------|------|------------------|
| `fitment_scope` | string | `universal`, `type_specific`, `vehicle_specific` |
| `vehicle_type_codes` | string | Comma-separated when type_specific, e.g. `dirtbike,atv` |
| `vehicle_fitment` | string | When vehicle_specific: one vehicle slug per line (e.g. `2023-yamaha-yz250f`) so we can parse consistently and migrate to Option B later. |
| `oem_part_number` | string | For ARI-origin parts; also use as external ID for find-or-create |
| `oem_manufacturer` | string | Manufacturer from ARI |

**Encoding rule for `vehicle_fitment`:** Store vehicle **slugs** (one per line), e.g.:

```text
2023-yamaha-yz250f
2024-yamaha-yz250f
```

This keeps Option A simple and makes a future migration to Option B a straight script: parse slugs, resolve to `vehicle_id` in the new DB, insert `ProductFitment` rows.

### Migration path to Option B (later)

If you switch to Option B:

1. Deploy Vehicle Service with `VehicleType`, `Vehicle`, and `ProductFitment` tables.
2. Populate vehicles from the existing static list (slug becomes `Vehicle.slug`).
3. One-time script: for each Lightspeed product with `vehicle_fitment`, split by newline, resolve slug to `vehicle_id`, insert `ProductFitment(lightspeed_product_id, vehicle_id)`.
4. For `type_specific` products, optionally backfill: no ProductFitment rows needed; keep using `vehicle_type_codes` or replicate type in the service.
5. Point storefront/middleware at Vehicle Service for "products for this vehicle" and My Garage; optionally keep Lightspeed fitment fields for display/SEO.

No change to the product data model in Lightspeed is required for the migration; we only add a new system and backfill links.

---

## 5. OEM (ARI) Parts and Fitment

Parts coming from ARI Partstream:

- **Inherit vehicle context from the diagram** (e.g. “2023 Yamaha YZ250F”). When middleware creates the product in Lightspeed, it must set:
  - `fitment_scope` = `vehicle_specific`
  - `vehicle_fitment` = one or more vehicle slugs (one per line), e.g. the slug for that diagram's vehicle.
- **OEM part number and manufacturer** should be stored (e.g. `oem_part_number`, `oem_manufacturer`) for display, search, and idempotent find-or-create.

No separate “vehicle table” is required in ARI’s response if ARI sends Year/Make/Model (and optionally Trim); we map that to our Vehicle id or slug using the canonical list or Vehicle Service.

---

## 6. Filtering Logic (Storefront)

**When user selects a Vehicle (e.g. 2023 Yamaha YZ250F):**

1. Resolve vehicle (and its type) — from Vehicle Service or static list.
2. Fetch products that:
   - have `fitment_scope` = `vehicle_specific` and reference this vehicle, **or**
   - have `fitment_scope` = `type_specific` and reference this vehicle’s type.
3. Optionally include `universal` products in the same result set.

**When user selects only a Vehicle Type (e.g. Dirtbike):**

1. Show products that are `type_specific` for that type or `vehicle_specific` for any vehicle of that type (and optionally `universal`).

**When user has no vehicle selected:**

- Show all products, or only `universal` + prompt to “Select vehicle for better results.”

---

## 7. “My Garage” (Stored Customer Vehicles)

- **My Garage** = list of Vehicle IDs (or slugs) per customer.
- **Where to store:** Lightspeed customer metafields (e.g. `garage_vehicle_ids` as JSON array) or in Vehicle Service (table `customer_vehicles`: customer_id, vehicle_id). Customer ID should come from Lightspeed (logged-in user).
- **Use:** Pre-fill vehicle selector, default diagram context, and filter “Parts for your vehicles” on the parts funnel.

---

## 8. Summary Table: Where Each Piece Lives

| Data | Option A (Lightspeed-only) | Option B (Vehicle Service) |
|------|----------------------------|----------------------------|
| Vehicle hierarchy (Type, Y/M/M) | Static list in code or middleware | VehicleType + Vehicle tables |
| Fitment scope + type/vehicle refs on product | Lightspeed custom fields | Lightspeed (scope) + ProductFitment (vehicle-specific) in service |
| “Products for this vehicle” query | Fetch products from Lightspeed, filter by custom field in app | Vehicle Service returns product IDs; details from Lightspeed |
| My Garage | Lightspeed customer metafield | CustomerVehicles in Vehicle Service |
| ARI part → fitment | Write vehicle_fitment (or vehicle_ids) on product in Lightspeed | Create ProductFitment rows + product in Lightspeed |

---

*Option A is the chosen approach. Next: implement static vehicle list, Lightspeed custom fields, and filtering in storefront/middleware. The [Technical Architecture](technical-architecture.md) doc’s “first slice” can include creating an ARI-origin product with fitment using this schema.*
