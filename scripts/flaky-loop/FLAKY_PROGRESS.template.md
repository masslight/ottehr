# Flaky E2E Progress Log

This file is the loop's memory. Each iteration runs in a fresh Claude session
with NO prior context, so this file is the only thing it knows. Keep it current,
concise, and accurate.

## How to read status values
- `identified`  — confirmed flaky, not yet worked on
- `in-progress` — currently being fixed (attempts recorded below)
- `fixed`       — validated stable (see validation runs) and committed
- `gave-up`     — exceeded max attempts; left for a human

## Settings (do not change without reason)
- Validation threshold: a test is `fixed` only after **10 consecutive passes, 0 failures**
- Max fix attempts per test before `gave-up`: **4**

---

## Flaky tests

<!--
Add one entry per discovered flaky test. Example:

### apps/ehr/tests/e2e/specs/patients.spec.ts > "filters patients by name"
- status: in-progress
- baseline flakiness: 6 failures / 20 runs (observed 2026-06-04)
- attempts:
  1. (2026-06-04) Replaced `waitForTimeout(500)` with web-first assertion on the
     results table. Re-ran 10x -> 3 failures. Not fixed.
  2. (2026-06-04) Root cause was a race: search fires before debounce settles.
     Awaited the network response for the search query. Re-ran 10x -> 0 failures. FIXED.
- commit: <sha> "fix(e2e): stabilize patient name filter test"
-->

(none yet)

---

## Notes / environment quirks
<!-- Anything a future iteration should know: slow specs, flaky test data,
     specs that can't run in isolation, etc. -->
(none yet)
