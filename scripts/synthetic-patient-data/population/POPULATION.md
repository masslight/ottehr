# Synthetic population build

Generates a realistic, year-long urgent-care population on the synth project:
**~2,000 unique patients / ~2,600 signed-completed visits** over the trailing 12
months, every age and sex, common UC complaints with a tail of acute/unusual
cases, evenly split across the two in-person locations (Los Angeles, New York),
each visit handled by a real-looking provider + intake MA.

Built on the single-visit harness (`../synthesize-visit.ts`) and the 24
synthetic staff (`../SYNTH-STAFF.md`). In practice it's **run → verify**:
`run-population` regenerates the plan itself (from a per-project manifest) before
seeding, so you don't run the planner separately — `plan-population` stays
runnable standalone only to eyeball a plan. Resume/idempotency state lives in the
target project as FHIR (a manifest + per-visit tags), **not** a local file or CI
cache, so re-running (locally or via a re-dispatched GitHub Action) just continues
where it left off.

> **When to run this.** Fresh environments are populated by the [daily census](../DAILY-CENSUS.md) by
> default. Run this full population build **only when specifically requested** — i.e. when an
> environment needs ~12 months of *backdated history* (so reports, trends, and time-range dashboards
> have data), not just a live-looking board going forward. It's an on-demand seed, not part of
> standing up a new env.

## Prerequisites

1. **Synth staff created** — run `../link-synth-staff-users.ts` first (see
   `../SYNTH-STAFF.md`). The planner assigns visits to these provider/MA names.
2. **Local zambda server running on the synth env** — the harness routes through
   local zambdas (`ENV=synth npm run apps:start:no-apply`). Synth runs ALWAYS
   use local zambdas.
3. **M2M creds** at `packages/zambdas/.env/synth.json` (children inherit them).
4. **Permissive booking schedule** — the runner books a throwaway near-future
   "scaffold" slot per visit (Phase 15 then backdates it). A location whose
   Schedule has realistic per-hour capacity (the synth **Los Angeles** schedule
   caps at 2–18/hr) rejects concurrent scaffold bookings with `4019 "slot
   unavailable"`. Run once to make the schedules permissive (capacity 200, open
   0–23); each original is backed up to `schedule-backup-<location-id>.json`:
   ```bash
   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx fix-schedules-permissive.ts
   # restore later if desired:
   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx fix-schedules-permissive.ts --restore
   ```
   Capacity only gates new bookings, never the backdated historical visits.

## 1. Plan — `plan-population.ts`

Deterministic (seeded) generator. Emits `population-plan.json`: a flat,
chronologically-ordered list of visit instances, each with a patient identity,
an archetype, a date/time, a location, and the attending provider + intake MA.

```bash
npx tsx plan-population.ts            # defaults: 2000 patients, seed 42
npx tsx plan-population.ts --patients 500 --seed 7 --out small-plan.json
```

How it works (`archetypes.ts` holds the registry + identity pools):
- **46 archetypes** map to scenarios in `../examples` — 16 rich hand-authored
  ones plus 30 generated `gen-*.json` scenarios (variants + new complaints);
  the committed `examples/*.json` files are the source of truth — each
  archetype is annotated with a plausible patient age band + sex constraint + a
  frequency weight (bread-and-butter complaints weighted high, acute/unusual
  low).
- Per patient: pick a seed archetype (weighted) → derive age/sex → generate a
  unique (name, DOB) identity from diverse name pools. Repeat-visit mix (default
  80/14/4/2% → 1–4 visits) draws additional **age/sex-compatible** archetypes so
  an 80-year-old's repeat visit is never a toddler complaint.
- Dates spread across the 12-month window (business hours, light Sunday
  de-weighting); a patient's multiple visits are chronologically spaced.
- Location assigned to keep the LA/NY **visit** counts even; provider + MA drawn
  from that location's roster.
- Reproducible: **same seed + same `--today` anchor → byte-identical plan**.
  `run-population` pins that anchor in the per-project manifest on the first run
  and reuses it on every resume, so each `seq`→patient mapping stays stable.
  Omitting `--today` anchors to the wall-clock day (fine for a one-off manual plan).

The planner prints distribution summaries (by location, archetype, month,
provider) — eyeball these before running.

## 2. Run — `run-population.ts`

Resumable, bounded-concurrency orchestrator. For each planned visit it clones
the archetype scenario, overrides identity + date + location, **forces
`targetStatus: completed`** (archetypes are authored at varied lifecycle stages;
the population is all signed-complete), and runs `synthesize-visit.ts --execute`
with the planned `--practitioner` (attending) and `--intake` (MA).

```bash
# MUST run under the synth env so child harness processes inherit creds:
npx env-cmd -f packages/zambdas/.env/synth.json \
  npx tsx run-population.ts [--seed 42] [--patients 2000] [--concurrency 4] [--limit N] [--from SEQ] [--to SEQ] [--redo] [--dry]
```

- **Self-planning**: on start it resolves the run manifest (below), regenerates
  `population-plan.json` from its params, then seeds — no separate planner step.
- **Pilot**: `--limit 25` runs the 25 chronologically-earliest not-yet-seeded visits.
- **State + resume live in FHIR** (durable — no local progress file or CI cache):
  - a singleton **`Basic` manifest** per project (`code = …|population-manifest`)
    pins the plan params — `seed`, `patients`, `todayAnchor` — plus status/counts,
    so any resume regenerates the identical plan;
  - every seeded **Appointment is tagged** `…/synth-population|seq-<N>`. The resume
    set is "which seqs are already tagged", so a re-run — or a re-dispatched GitHub
    Action — skips finished visits with nothing to persist between runs.
  - `--redo` ignores the done-set and re-runs everything; failures aren't tagged,
    so a plain re-run retries them.
  - **Different population**: the manifest's params win on resume — passing a
    different `--seed`/`--patients` warns and resumes the existing plan. To start a
    fresh one, clean up (`../cleanup-synth-patient.ts --all`) and delete the
    manifest `Basic` (its id is printed in the warning).
- **Dry**: `--dry` regenerates + prints the assignment for the first 20 selected
  visits; writes nothing (no manifest, no visits).
- Per-visit harness output → `.logs/seq-NNNNN.log`; materialized scenarios →
  `.scenarios/seq-NNNNN.json` (both untracked). `population-progress.json` is kept
  as a local run log but is **not** the resume source of truth anymore.
- Concurrency 4 is comfortable against a single local zambda server. Higher may
  overwhelm it.

Each visit lands historically because the harness's Phase 15 translates the
finished visit (Appointment/Slot/Encounter.period/statusHistory) back to the
planned date — the ad-hoc Encounters report buckets on `Appointment.start`.

## 3. Verify — `verify-population.ts`

```bash
npx env-cmd -f packages/zambdas/.env/synth.json \
  npx tsx verify-population.ts [--days 400]
```

Queries Appointments over the window (same `date` param the report uses) and
tallies status (expect mostly `fulfilled`), month (spread, not all today),
location (even LA/NY), and distinct patients.

## Notes / known limitations

- **Front-desk attribution** isn't modeled per-visit yet — attending provider
  and intake MA are wired; the registrar/check-in person is the M2M synthesizer.
  Revisit if/when the ad-hoc Encounters dataset surfaces a registeredBy field
  (that work lives on the reporting branch, not here).
- Per-resource clinical timestamps (Observation.effectiveDateTime, etc.) are NOT
  backdated — only Appointment/Encounter dates, which is what reports bucket on.
- The harness creates real FHIR on the synth project. Cleanup utilities live in
  the parent dir (`cleanup-synth-patient.ts`, etc.).
- Resume state is FHIR-native (the `Basic` manifest + `synth-population`
  Appointment tags). `cleanup-synth-patient.ts --all` removes the seeded
  patients/visits but **not** the manifest `Basic` — delete it manually to start a
  different plan, otherwise the next run reuses its pinned params (and re-seeds
  under the same anchor).
