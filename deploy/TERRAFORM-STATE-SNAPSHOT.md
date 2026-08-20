# Terraform state snapshot / restore (unmerged-branch review deploys)

Use this when you need to deploy an **unmerged** branch to a shared environment for
review, and that branch carries the Phase-1 self-service-Locations migration
(`oystehr/removed-locations.tf.json`).

## The problem

The `removed` blocks use `lifecycle { destroy = false }`: on apply they drop the
seed Locations/Schedules from **Terraform state** but leave them in FHIR. That's
correct for the migration — but it also means the shared workspace's state no
longer tracks those resources. A later apply from a branch that still *declares*
them (e.g. `develop`) sees "in config, not in state" and **recreates** them →
duplicate FHIR resources (or, if the provider pins the id, silently reverts
runtime edits).

## The fix

Snapshot the workspace state before deploying, restore it after review. Restoring
puts the seed resources back into state so the next `develop` apply treats them as
existing and does nothing.

## Runbook

Clear the runway first: make sure no one else will `apply` to the target env
between your snapshot and your restore.

```bash
cd deploy

# 1. BEFORE deploying the branch — capture state for the target env
./state-snapshot.sh development
#    -> writes .state-backups/pre-review-development-<timestamp>.tfstate
#    -> prints the exact restore command (absolute path)

# 2. Deploy the branch and let the product team review
./apply.sh development           # (normal deploy)

# 3. AFTER review — restore the snapshot
./state-restore.sh development .state-backups/pre-review-development-<timestamp>.tfstate
```

Then a normal `develop` deploy proceeds without recreating the Locations.

## Safety notes

- **Snapshots are gitignored** (`*.tfstate`) — they never get committed.
- `state-restore.sh` **aborts if the state lineage changed** since the snapshot
  (state was recreated → forcing an old snapshot could be destructive).
- Restore pushes forward monotonically (`serial = current + 1`), so no `--force`
  and the serial never regresses.
- Restore **discards any state changes made after the snapshot** — hence the
  clear-runway requirement.
- Both scripts take the env as an explicit argument (no default) so you can't
  snapshot/restore the wrong workspace by accident.
