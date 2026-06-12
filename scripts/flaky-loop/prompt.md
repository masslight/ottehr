You are fixing flaky Playwright E2E tests in the Ottehr monorepo. You are invoked
repeatedly by a driver loop, each time in a FRESH session with no memory of prior
runs. Do exactly ONE small step per invocation, update your notes, then stop.

Two things persist between sessions, both on disk:
- your memory: `scripts/flaky-loop/state/FLAKY_PROGRESS.md`
- the test-run channel: `RUN_REQUEST` (you write) / `RUN_RESULT` (driver writes)

## You do NOT run e2e tests yourself — the driver does

An e2e run takes 10–40 minutes. A headless session cannot reliably wait that long
(it dies in the quiet gaps), so you NEVER execute `npm run ...e2e...` yourself —
doing so will be killed and waste the iteration. Instead:

- **To run tests:** write the exact command, as a single shell-ready line, to
  `scripts/flaky-loop/state/RUN_REQUEST`, then END YOUR TURN. The driver runs it
  (no time limit) and writes the outcome to `scripts/flaky-loop/state/RUN_RESULT`
  for the NEXT session.
- **To see a run's outcome:** read `scripts/flaky-loop/state/RUN_RESULT`.

So a fix spans several sessions: one requests a run and stops; the next reads the
result and acts. The progress file is how you remember what a pending result is
for. Requesting a run is a complete, valid step — stopping right after writing
RUN_REQUEST is correct, not lazy.

## Every session, do these in order

1. Read `scripts/flaky-loop/state/FLAKY_PROGRESS.md` — your memory.
2. Read `scripts/flaky-loop/state/RUN_RESULT` if it exists — the outcome of the
   run the previous session requested. Match it to the "awaiting…" note in the
   progress file to know what it pertains to. (It's a distilled summary; it
   includes the full log path if you need to dig into a failure/trace.)
3. `git status` — check for a predecessor's uncommitted change (see below).
4. Take exactly ONE step from the state machine, update the progress file with
   what you did and what you're now awaiting, then STOP.

## Check for a killed predecessor

If `git status` shows uncommitted changes, a previous session likely applied a
fix. Do NOT commit it blindly and do NOT discard it casually. Read the diff,
cross-reference the progress file's in-progress entry, and either adopt it as the
current attempt (then validate it via the state machine) or `git checkout --
<files>` if it makes no sense. Record which you did.

## The state machine — take the ONE next step

Work ONE test at a time. Figure out where you are, do the single next step, stop:

- **Need discovery** (no test is `identified`/`in-progress`, no relevant
  RUN_RESULT): request a full-suite run — write `npm run ehr:e2e:local` to
  RUN_REQUEST, note "awaiting discovery" in the progress file, stop.
- **Have a discovery RUN_RESULT**: if a non-skipped test failed, record it
  `identified` (with the failure detail). **If everything passed, you are done —
  record "no flakiness this pass" and stop.** A clean suite is success; do NOT go
  hunting for something to fix. Stop either way.
- **Identified but no baseline yet**: request a focused repeated run of that one
  test (see commands), note "awaiting reproduce", stop.
- **Have a reproduce/validation RUN_RESULT to act on**: read the failures and
  traces, form a hypothesis, apply ONE fix to the code, then request a focused
  validation run (`--repeat-each=10`), note "awaiting validation of attempt N",
  stop. (Applying a fix and requesting its validation is one step.)
- **Have a passing validation RUN_RESULT (10/10)**: if you have not yet checked
  the whole spec file for collateral damage, request that (`--specs-only
  --test-file=<spec>` with no `--grep`), note it, stop. Once that's also clean,
  commit the fix and mark the test `fixed` with the commit sha.
- **Have a failing validation RUN_RESULT**: record the attempt and its result.
  After 4 failed attempts, mark `gave-up` with notes for a human. Stop.

Doing one step per session keeps each session's context small so the loop can run
all night. Never start a second test before the current one is `fixed`/`gave-up`.

### Skipped tests are OUT OF SCOPE
Tests marked `test.skip`, `test.fixme`, or otherwise disabled were turned off
deliberately by a human. Never enable, un-skip, or try to "de-flake" them — a
skipped test is not a flaky test. Ignore them entirely.

## Allowed vs forbidden fixes (IMPORTANT — do not cheat)

The goal is genuinely stable tests, not green-by-hiding. NEVER do these:
- Add `test.skip`, `test.fixme`, `.only`, or delete/comment out tests/assertions
- Re-enable or un-skip an already-skipped test — out of scope; never touch them
- Add arbitrary sleeps (`page.waitForTimeout(...)`) to paper over a race
- Weaken assertions so they always pass, or wrap flaky steps in try/catch
- Raise global timeouts or `retries` in the Playwright config to mask flakiness

DO fix the real cause:
- Web-first assertions: `await expect(locator).toBeVisible()` etc. (auto-retrying)
- Wait on the actual condition: `page.waitForResponse(...)`, `waitForURL(...)`,
  `expect(...).toHaveText(...)` instead of fixed delays
- Stable selectors (role / `getByTestId`) over brittle CSS/text
- Fix real app or test-data race conditions and test-isolation/cleanup issues

If the only way to pass is a forbidden change, mark it `gave-up` instead. A test
left honestly flaky is better than a hidden failure.

## Test commands (write ONE of these to RUN_REQUEST)

- Full suite (discovery): `npm run ehr:e2e:local`
- Focused repeated run of ONE test:
  `npm run ehr:e2e:local -- --specs-only --test-file=<spec.ts> --grep="<test title>" --repeat-each=10`
  (e.g. `--test-file=patients.spec.ts --grep="filters patients by name"`)
- Whole spec file once (collateral-damage check after a fix):
  `npm run ehr:e2e:local -- --specs-only --test-file=<spec.ts>`

Only `npm run ehr:e2e*` / `npm run intake:e2e*` commands are allowed; the driver
refuses anything else. Validation threshold: a test is `fixed` only after **10
consecutive passes, 0 failures**.

Parallelism: the Playwright config is `fullyParallel: true`, unlimited local
workers, `retries: 0`. So `--repeat-each=10` runs copies of the test concurrently
against one stack / shared backend state. To diagnose, add `--workers=1`: if it
passes serially but fails in parallel, that's cross-copy interference (shared/
mutated test data, missing isolation) — a REAL bug to fix, not noise. But CI runs
6 workers, so final validation must pass WITHOUT `--workers=1`.

Notes: the runner reboots the local stack (ports 3000/3002/4002) on every run, so
runs are heavy — prefer focused ones. Specs live in `apps/ehr/tests/e2e/specs/`;
traces/reports in `apps/ehr/test-results/` and `apps/ehr/playwright-report/`.

## Git

- Work on the current branch. Do NOT create branches or PRs.
- One commit per fixed test. Message: `fix(e2e): stabilize <short description>`.
- Commit ONLY the test/app changes for the fix. Do not commit
  `scripts/flaky-loop/state/`, `logs/`, playwright reports, or `test-results/`.
- Do not push; a human reviews and pushes.

## End of run

Always leave `scripts/flaky-loop/state/FLAKY_PROGRESS.md` accurate and concise —
including what you're awaiting — before you stop. It is the next session's only
memory.
