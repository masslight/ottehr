# Daily synthetic census (cron)

Keeps a lower environment's tracking board alive: every morning it **signs off
yesterday's** unfinished synthetic visits and **creates 40 new ones** dated today
in a spread of in-progress statuses, so the EHR always looks like a live clinic.

Default target: **demo**. Runs from your Mac at **07:15** via `launchd`.

## Pieces

| File | Role |
|---|---|
| `synth-daily-census.ts` | The job. Two phases: catch-up (sign yesterday) + generate (40 today). `--env`, `--count`, `--phase`, `--dry`. |
| `run-daily-census.sh` | Wrapper: preflight gates → boots an **ephemeral** zambda server on a dedicated port → runs the job → tears the server down → logs. |
| `com.ottehr.synth-daily-census.plist` | `launchd` schedule (07:15, demo). |

Reuses the visit harness (`synthesize-visit.ts`), the archetype library, and the
synth staff/locations — nothing new to maintain.

## How it works

**Catch-up.** Finds `synth-cron`-tagged appointments dated before today that
aren't `fulfilled`, walks each to completed, `sign-appointment`s it, and rewrites
`statusHistory` anchored to that visit's own day (so it ends signed with
realistic durations, not stamped "now").

**Generate.** Creates N=40 new patients (archetype fan-out, age/sex-matched),
dated today with arrival times staggered across business hours, assigning a
realistic status mix (arrived / intake / ready-for-provider / with-provider /
discharged-awaiting-review / completed). Everything tagged `synth-cron` + the run
date.

**Safe by construction:**
- Idempotent — the generate phase no-ops if today already has ≥ N `synth-cron`
  visits; catch-up only ever touches `synth-cron`-tagged visits (never real data).
- Refuses to run when `ENVIRONMENT=production`.
- Ephemeral server → a fresh M2M token every run (sidesteps the stale-token bug).
- Creds come from `packages/zambdas/.env/<env>.json` — never inlined.

## Prerequisites in the target env (e.g. demo)

- The two in-person **Locations** (with Schedules) the harness books against —
  the job aborts with guidance if missing.
- **Providers + MAs** — run `link-synth-staff-users.ts` against the env to create
  the synth staff (or visits fall back to whatever role-assigned provider exists;
  the job warns).
- In-house **lab catalog** — demo already has it.

## Install (07:15 daily, demo)

```bash
# 1. one-time: edit the absolute paths + Node PATH in the plist to match your machine
cp scripts/synthetic-patient-data/com.ottehr.synth-daily-census.plist ~/Library/LaunchAgents/

# 2. load + test-run once
launchctl load  ~/Library/LaunchAgents/com.ottehr.synth-daily-census.plist
launchctl start com.ottehr.synth-daily-census

# disable later
launchctl unload ~/Library/LaunchAgents/com.ottehr.synth-daily-census.plist
```

The Mac must be awake at 07:15 (launchd runs it at next wake if asleep, but not if
powered off).

## Run / test manually

```bash
# dry run (no writes) — shows the plan
scripts/synthetic-patient-data/run-daily-census.sh --env demo --dry

# real run now
scripts/synthetic-patient-data/run-daily-census.sh --env demo

# just one phase, or a smaller batch
scripts/synthetic-patient-data/run-daily-census.sh --env demo --phase catchup
scripts/synthetic-patient-data/run-daily-census.sh --env demo --count 10
```

Logs land in `scripts/synthetic-patient-data/.census-logs/` (one per run, plus the
ephemeral server's own log). The same wrapper is the manual command and the cron
entry point, so "re-run after fixing" is always the command printed in any abort
message.

## Branch dependency

The harness + the `sign-appointment` fix live on the synth branch
(`otr-2435`). Until that's merged to develop/main, the wrapper's preflight aborts
(with exact guidance) when run from a branch that lacks them. Once merged, it runs
from any branch.

## Notes / not included

- Per-resource clinical timestamps aren't shifted — only appointment/encounter
  dates, which is what the board and reports key on.
- No retention/pruning — the dataset grows daily. Add a prune step if you want a
  fixed rolling window.
