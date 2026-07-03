# Synthetic population build

Generates a realistic, year-long urgent-care population on the synth project:
**~2,000 unique patients / ~2,600 signed-completed visits** over the trailing 12
months, every age and sex, common UC complaints with a tail of acute/unusual
cases, evenly split across the two in-person locations (Los Angeles, New York),
each visit handled by a real-looking provider + intake MA.

Built on the single-visit harness (`../synthesize-visit.ts`) and the 24
synthetic staff (`../SYNTH-STAFF.md`). Three steps: **plan → run → verify**.

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
- Same seed → identical plan (reproducible, and the runner resumes by `seq`).

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
  npx tsx run-population.ts [--concurrency 4] [--limit N] [--from SEQ] [--to SEQ] [--redo] [--dry]
```

- **Pilot**: `--limit 25` runs the 25 chronologically-earliest visits.
- **Resume**: a `population-progress.json` records each visit's outcome; a re-run
  skips visits already `done`. Failures are NOT marked done, so re-running
  retries them. `--redo` forces re-run of completed ones.
- **Dry**: `--dry` prints the assignment for the first 20 selected visits.
- Per-visit harness output is saved to `.logs/seq-NNNNN.log`; materialized
  scenarios to `.scenarios/seq-NNNNN.json` (both gitignored-by-convention — the
  whole `scripts/synthetic-patient-data/` tree is untracked).
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
