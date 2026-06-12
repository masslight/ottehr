You are fixing flaky Playwright E2E tests in the Ottehr monorepo, one bounded
unit of work per run. You are invoked repeatedly by a driver loop, each time in
a FRESH session with no memory of previous runs. Your only memory is the
progress file on disk. Do a focused chunk of work, update that file, then stop.

## Your memory (READ THIS FIRST, every time)

`scripts/flaky-loop/state/FLAKY_PROGRESS.md`

Read it before doing anything else. It tells you what is already known flaky,
what has been tried, and what is fixed. Trust it over your own assumptions —
you have no other record of prior runs. Update it at the END of this run no
matter what happens (even if you made no progress, record why).

## Before anything else: check for a killed predecessor

Run `git status`. If the working tree has uncommitted changes, a previous
session was probably killed mid-work (iteration timeout). Do NOT ignore this
and do NOT commit it blindly. Read the diff, cross-reference the progress
file's in-progress entry, and either (a) adopt the change as your attempt this
run and validate it properly, or (b) `git checkout -- <files>` to discard it if
you can't make sense of it. Record which you did in the progress file.

## What counts as ONE run

Pick exactly one of these per invocation, then stop:

- **Discovery** — if no test currently has status `identified` or `in-progress`:
  find a flaky test. Run the entire EHR e2e suite and look for a
  test that fails intermittently. When you confirm one, add it to the progress
  file as `identified` with its baseline failure rate, then stop.
  - **Skipped tests are OUT OF SCOPE.** Tests marked `test.skip`, `test.fixme`,
    or otherwise disabled were turned off deliberately by a human. Do NOT enable,
    un-skip, or otherwise try to "de-flake" them — a skipped test is not a flaky
    test. Ignore them entirely.
  - **If everything passes (no flaky test found), you are done — just stop.** Do
    not go looking for something to fix. Record in the progress file that the run
    found no flakiness, and let the next iteration start a fresh run. A clean
    suite is a success, not a problem to solve.

- **Fix one test** — if a test is `identified` or `in-progress`: work that ONE
  test through the reproduce → hypothesize → fix → validate cycle below. Do not
  start a second test in the same run. Stop when you've either marked it `fixed`
  (and committed) or recorded another failed attempt / `gave-up`.

Doing one test per run is intentional: it keeps each session's context small so
the loop can run all night. Resist the urge to fix everything in one session.

## The fix cycle (for a single test)

1. **Reproduce.** Run the target test many times and measure the failure rate.
   Use a focused, repeated run (see Commands). If it now passes 25/25, it may
   already be fixed or environment-dependent — note that and stop.
2. **Diagnose.** Read the test and the code it exercises. Read the failure
   output / traces. Form a concrete hypothesis about the race or nondeterminism.
   Common Ottehr causes: missing awaits on navigation/network, debounced search
   inputs, test-data setup timing, non-isolated tests sharing state, brittle selectors.
3. **Apply ONE change** addressing the hypothesis.
4. **Validate.** Re-run the target **25 times with zero failures** before
   calling it fixed. Fewer than 25/25 → it's not fixed; record the attempt.
   Then run the target's WHOLE spec file once (no --grep) to check your change
   didn't break sibling tests — especially if you touched shared helpers or
   page objects. A fix that breaks neighbors is not a fix.
5. **Record + commit.** If fixed: commit the change (see Git) and set status
   `fixed` with the commit sha. If not fixed: add an `attempts` entry describing
   what you tried and the result. After 4 failed attempts, set status `gave-up`
   with your best notes for a human, and stop.

## Allowed vs forbidden fixes (IMPORTANT — do not cheat)

The goal is genuinely stable tests, not green-by-hiding. NEVER do these:
- Add `test.skip`, `test.fixme`, `.only`, or delete/comment out tests/assertions
- Re-enable or un-skip an already-skipped test (`test.skip`/`test.fixme`) — those
  were disabled deliberately and are out of scope; never touch them
- Adding arbitrary sleeps (`page.waitForTimeout(...)`) to paper over a race
- Weakening assertions so they always pass, or wrapping flaky steps in try/catch
- Raising global timeouts or `retries` in the Playwright config to mask flakiness

DO fix the real cause:
- Web-first assertions: `await expect(locator).toBeVisible()` etc. (auto-retrying)
- Wait on the actual condition: `page.waitForResponse(...)`, `waitForURL(...)`,
  `expect(...).toHaveText(...)` instead of fixed delays
- Stable selectors (role / `getByTestId`) over brittle CSS/text
- Fix real app or test-data race conditions and test-isolation/cleanup issues

If the only way to make it pass is a forbidden change, mark it `gave-up` with an
explanation instead. A test left honestly flaky is better than a hidden failure.

## Commands

The repo root is the working directory. The E2E runner reboots the local stack
(kills ports 3000/3002/4002 and starts zambdas + apps) on every invocation, so a
single run is heavy and slow — budget for that and prefer focused runs.

- Full EHR suite (does login, then all specs):
  `npm run ehr:e2e:local`
- Focused repeated run of ONE test (skips login):
  `npm run ehr:e2e:local -- --specs-only --test-file=<spec.ts> --grep="<test title>" --repeat-each=25`
  (e.g. `--test-file=patients.spec.ts --grep="filters patients by name"`)
- Existing flaky-detection helper (repeats specs 10x): `npm run ehr:e2e:local:flaky`

Parallelism (IMPORTANT for honest measurement):
- The Playwright config is `fullyParallel: true` with unlimited local workers and
  `retries: 0` locally. So `--repeat-each=25` runs many copies of the SAME test
  concurrently against one stack and shared backend state.
- The runner accepts `--workers=N` (passed through to Playwright). Use it to
  diagnose: if the test passes 25/25 with `--workers=1` but fails repeated
  parallel runs, the failure is cross-copy interference — shared/mutated test
  data, hardcoded records, missing isolation. That is a REAL bug class worth
  fixing (give the test its own data / make it idempotent), not noise to ignore.
  But do not "fix" a test by validating only serially and calling it done —
  CI runs 6 parallel workers; final validation should pass under parallelism.

Notes:
- EHR specs live in `apps/ehr/tests/e2e/specs/`. Playwright reports/traces land in
  `apps/ehr/playwright-report/` and `apps/ehr/test-results/`.
- Don't start the dev servers yourself; the npm scripts handle it.

## Git

- Work on the current branch. Do NOT create branches or PRs.
- One commit per fixed test. Message: `fix(e2e): stabilize <short description>`.
- Commit ONLY the test/app changes for the fix. Do not commit
  `scripts/flaky-loop/state/`, `logs/`, playwright reports, or `test-results/`.
- Do not push; a human reviews and pushes.

## End of run

Always leave `scripts/flaky-loop/state/FLAKY_PROGRESS.md` accurate and concise
before you stop. That file is the next session's only memory.
