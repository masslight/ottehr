# Flaky E2E test-fixing loop

An overnight harness that repeatedly runs Claude Code against the EHR Playwright
suite to find flaky tests and fix them — one test per iteration, with a fresh
session each time so it can run for hours without exhausting context.

## How it works

```
driver.sh  ──loop──▶  claude -p (fresh session)  ──reads/writes──▶  state/FLAKY_PROGRESS.md
                              │
                              └─ runs e2e tests, diagnoses, fixes, validates, commits
```

The key idea: **each iteration is a brand-new `claude -p` process.** Context
never accumulates across iterations — instead, knowledge is carried forward in
`state/FLAKY_PROGRESS.md`, which every session reads first and updates last.
That's what lets it grind all night without degrading.

- `driver.sh` — the outer loop (fresh session per iteration, logging, stop/backoff)
- `prompt.md` — the per-iteration instructions (the "brain")
- `FLAKY_PROGRESS.template.md` — seed for the on-disk memory file
- `state/` — runtime state (progress file, STOP sentinel) — git-ignored
- `logs/` — per-iteration logs — git-ignored

## Prerequisites

- `claude` CLI installed and authenticated on this machine
- The E2E suite runs locally (env files under `apps/ehr/env/`, e.g. `tests.local.json`)
- A clean-ish git working tree (the loop commits fixes)
- A `timeout` command for the per-iteration cap. Linux has it built in; on macOS
  install coreutils (`brew install coreutils`, provides `gtimeout`). The driver
  auto-detects either and runs without a cap if neither is present.

## Run it

```bash
# from the repo root
scripts/flaky-loop/driver.sh
```

Tune via env vars:

```bash
MAX_ITERS=30 MODEL=claude-sonnet-4-6 ITER_TIMEOUT=5400 scripts/flaky-loop/driver.sh
```

Leave it overnight:

```bash
nohup scripts/flaky-loop/driver.sh > scripts/flaky-loop/logs/driver.out 2>&1 &
```

Stop it cleanly (after the current iteration):

```bash
touch scripts/flaky-loop/state/STOP
```

## In the morning

- Review `state/FLAKY_PROGRESS.md` for what was found / fixed / given up on.
- Review the commits it made (`git log`), then push the ones you're happy with.
- Skim `logs/` for any iteration that timed out or thrashed.

## Safety notes

- The driver uses `--dangerously-skip-permissions` so it can run unattended.
  That lets the session run any command without prompting. Run it on a box where
  that's acceptable (your dev machine), not on anything sensitive.
- Safer alternative: drop `--dangerously-skip-permissions` from `driver.sh` and
  pre-approve the specific commands in `.claude/settings.json` (allowlist the npm
  e2e scripts, git, file edits). More setup, less blast radius.
- The prompt forbids "cheating" fixes (skipping tests, blind sleeps, weakening
  assertions). Still review every commit before pushing — treat it as a PR from
  a junior engineer.
- Cost: each iteration runs the full local stack and many test repeats, plus
  model tokens. An overnight run can be expensive. Set `MAX_ITERS` accordingly.
