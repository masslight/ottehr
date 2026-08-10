# Synthetic Quick Picks

A small pipeline for populating an Oystehr project's **admin Quick Picks** with realistic, schema-validated examples across all seven admin-managed categories: procedure, medical-condition, radiology, allergy, medication-history, immunization, and in-house-medication.

Mirrors the architecture of `scripts/synthetic-patient-data/` (env-cmd targeting, M2M auth via the local zambda server, idempotent runner driven by JSON examples) — but quick picks are project-level admin config, not per-visit data.

## Layout

```
scripts/synthetic-quick-picks/
├── schema.ts                                       # Zod schemas, one per category
├── synthesize-quick-picks.ts                       # generic runner; --type <category>
├── bootstrap-allergy-examples.ts                   # eRx-lookup bootstraps (write the JSONs
├── bootstrap-medication-history-examples.ts        # below from external coding systems +
├── bootstrap-immunization-examples.ts              # project-local Medication FHIR ids;
├── bootstrap-in-house-medication-examples.ts       # one per category that needs lookups)
├── examples/
│   ├── procedures/                                 # 32 picks; idempotent on name
│   ├── medical-conditions/                         # 47 picks; idempotent on display
│   ├── radiology/                                  # 22 picks; idempotent on name
│   ├── allergies/                                  # 26 picks; needs allergyId from eRx
│   ├── medication-history/                         # 31 picks; needs medicationId from eRx
│   ├── immunizations/                              # 3 picks; needs vaccine.id from project FHIR
│   └── in-house-medications/                       # 12 picks; needs medicationId from project FHIR
└── README.md
```

The runner has a per-category `REGISTRY` at the top of `synthesize-quick-picks.ts` mapping each `--type <category>` to its schema, examples directory, the three zambda names (`admin-{get,create,update}-<type>-quick-pick`), and the field that's the human-readable label (procedure / radiology / allergy / medication-history / immunization / in-house-medication → `name`, medical-condition → `display`).

Each JSON file is the **exact** payload shape for its category (see `packages/utils/lib/types/api/quick-picks.types.ts`). Encounter-specific fields (e.g., procedure `consentObtained`, `performerType`, `documentedBy`; immunization `lot` / `expDate` / `ndc`) are intentionally omitted — the EHR's `QUICK_PICK_APPLY_KEYS` skips them when applying a pick, and per-shipment fields can't be baked into a reusable pick.

## Two flavors of category

- **Static-content categories** (procedure, medical-condition, radiology). The JSON examples are hand-authored from public coding systems (CPT / ICD-10) and ValueSets in `config/oystehr/*.json`. Apply directly with `synthesize-quick-picks.ts`.
- **Lookup-driven categories** (allergy, medication-history, immunization, in-house-medication). These reference integer or FHIR-id values that come from external systems or per-project resources, so they need a one-time **bootstrap** to resolve names → ids before the standard runner can apply them. The bootstrap script writes the resolved ids into the JSON examples; the standard runner then applies them like any other category.

## Prerequisites

Same as the synthetic-patient-data pipeline:

1. **Local zambda server running, pointed at the target project.** The runner talks to `http://localhost:3000/local`. Start with the corresponding env:
   ```bash
   cd packages/zambdas && ENV=local npm run start:iac
   cd packages/zambdas && ENV=demo npm run start:iac
   cd packages/zambdas && ENV=synth npm run start:iac
   ```

2. **M2M client with `profile: Practitioner/<existing-id>`.** The admin-create / admin-update zambdas don't directly use `m2m.me()`, so a `Device/...` profile may work for these specific calls — but the synth pipeline as a whole assumes the Practitioner-profile setup. If a fresh project doesn't have one, see `../synthetic-patient-data/create-synth-m2m.ts` and the M2M IAM callout in that pipeline's README.

3. **Env file with `AUTH0_*` and `PROJECT_ID` / `PROJECT_API`** at `packages/zambdas/.env/<env>.json`. Same file the visit synthesizer reads.

## Running

All commands take `--type <category>`. Supported categories live in `REGISTRY` in `synthesize-quick-picks.ts`.

### Apply every pick in a category (most common usage)

```bash
npx env-cmd -f packages/zambdas/.env/synth.json \
  npx tsx scripts/synthetic-quick-picks/synthesize-quick-picks.ts \
  --type procedure --all-examples --execute
```

Repeat for each category you want populated:

```bash
for t in procedure medical-condition radiology allergy medication-history immunization in-house-medication; do
  npx env-cmd -f packages/zambdas/.env/synth.json \
    npx tsx scripts/synthetic-quick-picks/synthesize-quick-picks.ts \
    --type "$t" --all-examples --execute
done
```

Re-running is safe. Each category's natural label is the dedup key; matching titles route to UPDATE, new ones to CREATE.

### Dry-run a single pick

Validates the JSON against the schema, fetches existing picks via the category's `admin-get-...` zambda, and reports CREATE vs UPDATE — but writes nothing.

```bash
npx env-cmd -f packages/zambdas/.env/synth.json \
  npx tsx scripts/synthetic-quick-picks/synthesize-quick-picks.ts \
  --type medical-condition \
  scripts/synthetic-quick-picks/examples/medical-conditions/hypertension.json
```

### Bootstrapping the lookup-driven categories

Allergy, medication-history, immunization, and in-house-medication ship with already-bootstrapped JSON examples (resolved against the synth project at the time of authoring). If you target a different project — or eRx data drifts — re-run the bootstrap to regenerate the JSONs with project-correct ids:

```bash
# Allergy: resolves names → eRx allergen ids via oystehr.erx.searchAllergens
npx env-cmd -f packages/zambdas/.env/<env>.json \
  npx tsx scripts/synthetic-quick-picks/bootstrap-allergy-examples.ts        # dry run
npx env-cmd -f packages/zambdas/.env/<env>.json \
  npx tsx scripts/synthetic-quick-picks/bootstrap-allergy-examples.ts --execute

# Medication history: resolves names+strengths → eRx medication ids via oystehr.erx.searchMedications
npx env-cmd -f packages/zambdas/.env/<env>.json \
  npx tsx scripts/synthetic-quick-picks/bootstrap-medication-history-examples.ts --execute

# Immunization: resolves vaccine names → project-local Medication FHIR ids
# (Medications tagged virtual-medication-type|virtual-vaccine-inventory)
npx env-cmd -f packages/zambdas/.env/<env>.json \
  npx tsx scripts/synthetic-quick-picks/bootstrap-immunization-examples.ts --execute

# In-house medication: resolves med names → project-local Medication FHIR ids
# (Medications tagged virtual-medication-type|virtual-medication-inventory)
npx env-cmd -f packages/zambdas/.env/<env>.json \
  npx tsx scripts/synthetic-quick-picks/bootstrap-in-house-medication-examples.ts --execute
```

Each bootstrap prints its resolution table and refuses to write JSON for entries it can't match cleanly (better than picking the wrong id silently).

### Project-local catalog dependencies

Two categories are bounded by what the target project already has:

- **Immunization**: needs vaccine `Medication` resources tagged `virtual-medication-type|virtual-vaccine-inventory`. The Ottehr IaC ships only 3 (Tdap / DTaP / Td — see `config/oystehr/vaccines.json`). To get more picks, expand that config and redeploy first.
- **In-house medication**: needs in-house `Medication` resources tagged `virtual-medication-type|virtual-medication-inventory`. Synth has 12; bootstrap script targets all 12.

The bootstraps reuse the project-local Medication FHIR ids that are already there. To add picks, add Medications first.

## Where the picks land in the EHR

- **Storage:** FHIR `ActivityDefinition` resources, tagged `https://fhir.ottehr.com/CodeSystem/quick-pick-category|<category>-quick-pick`. Each category's payload is JSON-serialized into a `valueString` extension on the resource.
- **Admin UI:** EHR → Admin → Quick Picks → **(per-category sub-tab)** in `apps/ehr/src/features/visits/telemed/components/admin/QuickPicksAdminPage.tsx`. Each pick is editable / deletable from the detail page (procedure / immunization / radiology / in-house-medication have dedicated detail pages; allergy / medical-condition / medication-history use inline editors).
- **Provider use:** When a provider opens the matching tab in a visit (procedures, plan, MAR, etc.), the picks appear as one-click pre-fills.

## Adding a new pick to an existing category

1. Drop a new file in `examples/<category>/<short-kebab-name>.json` matching the category's payload shape. The Zod schema in `schema.ts` lists the valid enum values for every constrained field.
2. For static-content categories: if the JSON references a code not in the corresponding `config/oystehr/*-*.json` ValueSet, either add the entry to the ValueSet (and deploy via IaC) or use the category's free-text override field (e.g., procedure's `otherSuppliesUsed`).
3. For lookup-driven categories: add the spec to the corresponding `bootstrap-*-examples.ts` MEDS / VACCINES / ALLERGENS list and re-run the bootstrap to (re)write the JSON.
4. Dry-run to verify schema validation, then execute against the target project.

## Adding a new category

The seven admin-managed quick-pick categories all share the same `QuickPickCreateInput<T>` / `admin-{create,update,get,remove}-<type>-quick-pick` zambda pattern. To wire a new one into this runner:

1. Add a Zod schema for the category's `*QuickPickData` interface to `schema.ts`.
2. Add an entry to `REGISTRY` in `synthesize-quick-picks.ts` mapping the new `--type <category>` to its schema, examples directory, three zambda names, and `getLabel` function (the field that's the human-readable label — `name`, `display`, etc.).
3. Add an `examples/<category>/` directory with JSON files (or a bootstrap script if the payload references external/project ids).

## Common failure modes

| Symptom | Cause |
| --- | --- |
| `Schema validation failed for <path>:` then enum mismatch | The JSON references a ValueSet code not in the schema's enum. Check `config/oystehr/*-*.json` for what's allowed. |
| `admin-create-<type>-quick-pick failed: 403 Forbidden` | M2M client doesn't have invoke permission for that zambda on the target project. Same workarounds as the visit-synth pipeline (widen the M2M scopes via Console, or provision a new M2M with `create-synth-m2m.ts`). |
| `admin-create-<type>-quick-pick failed: 500` with `Failed to get Practitioner` | M2M's `profile` is `Device/...` instead of `Practitioner/...`. See the M2M callout in `../synthetic-patient-data/README.md`. |
| `Cannot POST /zambda/.../execute` (404) | Local zambda server isn't running (`lsof -i :3000`), or the `ZAMBDA_API` env var was overridden away from `http://localhost:3000/local`. |
| Bootstrap reports `<NO MATCH>` for an entry | The eRx / project-local FHIR catalog doesn't contain something matching the spec's name + form/strength filter. Either widen the spec, expand the upstream catalog, or remove the entry. |
