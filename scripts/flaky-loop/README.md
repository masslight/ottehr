# Flaky E2E test-fixing loop

An overnight harness that repeatedly runs Claude Code against the EHR Playwright
suite to find flaky tests and fix them — one test per iteration, with a fresh
session each time so it can run for hours without exhausting context.

## How it works

```
driver.sh ─loop─▶ claude -p (fresh, short session) ─┬─▶ state/FLAKY_PROGRESS.md  (memory)
      ▲                                             └─▶ state/RUN_REQUEST        (a test to run)
      │                                                        │
      └──── runs the requested e2e test (no time cap) ◀────────┘
            and writes the outcome to state/RUN_RESULT for the next session
```

Two key ideas:

1. **Each iteration is a brand-new `claude -p` process.** Context never
   accumulates — knowledge is carried forward in `state/FLAKY_PROGRESS.md`, which
   every session reads first and updates last. That's what lets it grind all
   night without degrading.
2. **The driver runs the tests, not the agent.** An e2e run takes 10–40 min,
   which a one-shot headless session can't reliably wait on (it dies in the quiet
   gaps, and the Bash tool caps foreground commands at 10 min). So the agent just
   *requests* a run by writing the command to `state/RUN_REQUEST` and stops; the
   driver runs it (plain bash, no cap) and leaves a distilled result in
   `state/RUN_RESULT` for the next session. A fix therefore spans several short
   sessions (request a run → next session reads the result → acts).

- `driver.sh` — the outer loop: fresh session per iteration, runs requested
  tests, logging, stop/backoff, cleanup
- `prompt.md` — the per-session instructions (the "brain"): a step-at-a-time
  state machine driven by the progress file + RUN_RESULT
- `FLAKY_PROGRESS.template.md` — seed for the on-disk memory file
- `state/` — runtime state (progress file, STOP sentinel, RUN_REQUEST/RUN_RESULT,
  lock) — git-ignored
- `logs/` — per-iteration session logs and per-run test logs — git-ignored

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

`MAX_ITERS` counts **sessions**, not fixes. Since the driver runs tests between
sessions, a single fix now spans several short sessions (request discovery → read
result → request validation → commit), plus a long driver-side test run between
each. Set it generously (the default is 50). `ITER_TIMEOUT` caps each individual
test run (default 2h), not the whole loop.

`MODEL=claude-fable-5` gives the strongest debugging at the highest cost;
`claude-sonnet-4-6` is the budget option. Only one driver can run at a time: a
lock in `state/driver.lock` makes a second launch refuse to start, and stopping
the driver (STOP file, Ctrl+C, or `kill`) takes down its claude session and
frees the e2e app ports instead of orphaning them.

### Watching it work

Run it in the foreground and each session streams its steps (tool calls, test
runs, edits) live:

```bash
scripts/flaky-loop/driver.sh
```

This works because `STREAM=1` (the default) runs the session with
`--output-format stream-json` and pipes it through `format-stream.mjs` for a
readable view. Without this, headless `claude -p` only prints at the very end,
so it *looks* frozen for the many minutes the first full e2e run takes — that's
the usual "it's stuck doing nothing" symptom.

Set `STREAM=0` to fall back to plain text (final output only). Each iteration
writes two logs: `logs/iter-NNN-*.jsonl` (raw stream-json events) and
`logs/iter-NNN-*.log` (the readable view, written live). Follow the newest from
another terminal:

```bash
tail -f "$(ls -t scripts/flaky-loop/logs/iter-*.log | head -1)"
```

If a session appears stuck with no output even with streaming on, sanity-check
that headless mode works at all on your machine:

```bash
claude -p "reply with OK" --verbose
```

If that hangs or errors, the issue is the `claude` CLI (auth, or an unknown
model id) — not this harness. Try a known model, e.g.
`MODEL=claude-sonnet-4-6 scripts/flaky-loop/driver.sh`.

Leave it overnight:

```bash
nohup scripts/flaky-loop/driver.sh > scripts/flaky-loop/logs/driver.out 2>&1 &
```

Stop it (takes effect within ~5s — it interrupts the in-flight iteration; the
next launch recovers any half-done work via its git-status check):

```bash
touch scripts/flaky-loop/state/STOP
```

`Ctrl+C` or `kill <driver-pid>` do the same and clean up just as well — the
driver tears down the running claude session and frees the e2e app ports
(3000/3002/4002) on its way out. **You should never need `kill -9`.** If a
previous run *was* `kill -9`'d and left app servers running, the next launch
detects and frees those ports automatically at startup.

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
