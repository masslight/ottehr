# Barrel-elimination campaign: measured results so far

Branch `claude/barrel-elimination-zambdas`. The codemod that produced these numbers is kept at
`packages/zambdas/scripts/debarrel.ts`; the source rewrites are reverted so the branch is green.
Regenerate any state below with one command (see bottom).

## Headline

| Change | Effect on unit-test wall time | Notes |
|---|---|---|
| `import type` sweep (955 files) | **0%** | esbuild already elides type-only imports |
| Debarrel `src/shared` only (120 files) | **0%** | consumers still import the barrel, so it loads anyway |
| Debarrel all of `src` (792 files) | **~16–25%** | breaks 45 test files / 296 tests |
| One vertical slice, *entire chain* clean | **17×** (1.26s → 0.073s per file) | 3 files; no barrel mocks in the chain |

## What each step taught us

**1. `import type` is a no-op for speed.** `@typescript-eslint/consistent-type-imports --fix`
rewrote 955 files, typechecked clean, and changed nothing measurable (40.2s vs 39.4s). esbuild —
which vitest uses to transpile — already drops imports whose bindings are only used in type
positions, and drops the whole statement when nothing remains. Verified directly on a probe file.
Reverted.

**2. Debarrelling the barrel's own members does nothing.** Rewriting the 120 files *inside*
`src/shared` so they import `utils` at leaf paths moved nothing (28.9s vs 28.6s, interleaved).
Once a consumer imports `src/shared/index.ts`, all 45 re-exported submodules load regardless of
what they import internally. The barrel has to stop being *entered*.

**3. A fully-clean chain really is ~17×.** One vertical slice — `get-employees`'s validation test —
required changing only three files (the SUT, `src/shared/validation.ts`, and the test helper), and
went from **1.26s to 0.073s per test file**, reproducible across interleaved cycles, 80 tests
passing. 0.073s is essentially the empty-test-file floor (0.04s). The ceiling is real.

**4. But the whole-suite result is ~16–25%, not 17×.** Debarrelling all 792 `src` files gave 27.0s
vs 32.4s on a 20-file subset (interleaved), and 3m49s vs the 5m02s full-suite baseline. Three
reasons for the gap:

- the 362 files under `test/` still import the barrels themselves (not yet done);
- real handler tests legitimately need heavy dependencies;
- **~55 test files call `vi.mock('utils', async (importOriginal) => ...)`**, and `importOriginal()`
  explicitly loads the entire barrel. Debarrelling cannot help those tests until their mocks are
  rewritten to target deep modules.

**5. Debarrelling breaks barrel mocks.** This is the main cost. When a SUT stops importing
`'utils'`, a test's `vi.mock('utils')` intercepts nothing — silently. That is what broke 45 files /
296 tests. A single `vi.mock('utils', factory)` stubbing N symbols has to become N separate
`vi.mock('utils/lib/...')` calls, one per defining module.

## Remaining work to capture the full win

1. Debarrel `test/` (362 files).
2. Rewrite ~55 barrel `vi.mock` calls into per-module mocks.
3. Fix the 45 broken test files.
4. ESLint `no-restricted-imports` banning the barrels, or it regresses immediately.
5. Repeat inside `utils` itself (its subdirectories are barrels too).

Estimated landing zone: somewhere between 25% and the slice's 17×, depending on how many tests can
be freed of barrel mocks. That is 1,150+ files plus mock surgery.

## Production impact: none

Deployed zambdas are bundled by esbuild with `sideEffects: false`, which already tree-shakes the
barrels. A `get-employees` bundle is 2.03MB and contains zero candidhealth, pdf-lib or Stripe. The
built intake/EHR apps are bundled by vite for the same reason. Barrels cost only where nothing
bundles: **vitest** (large, measured above) and the **local dev server** (`tsx watch`, real but
unmeasured).

## Reproducing

```bash
cd packages/zambdas
npx tsx scripts/debarrel.ts src            # dry run: what would change
npx tsx scripts/debarrel.ts src --apply    # apply
npx prettier --write "src/**/*.ts"
npx tsc --noEmit                           # clean after the rewrite
```

The codemod uses the TypeScript compiler API to resolve each barrel-imported symbol to the module
that actually declares it (following re-export aliases), then regroups the import statement by
target module. It maps 279 `src/shared` symbols and 3,450 `utils` symbols with zero unresolved.
