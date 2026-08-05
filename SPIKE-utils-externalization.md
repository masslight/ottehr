# Spike: can we speed up the zambdas unit suite without `--no-isolate`?

**Result: no. Recommend abandoning this direction.**

The goal was to keep vitest's per-file isolation — and therefore per-file `vi.mock`, which is
much nicer to read and write — while removing the module-loading cost that makes the isolated
suite slow. The idea was to stop vitest re-executing the `utils` package for every test file.

It does not work. The only variant that was faster is the one that is incorrect, and the variant
that is correct is not faster.

## Numbers

Full unit suite, `npm run test:unit:ci` invoked directly (turbo bypassed, so no cache), same
machine. Baseline is `develop` as-is.

| Variant | Wall time | Tests run (of 3,800) |
|---|---|---|
| `develop`, isolated (baseline) | 7m 45s | 3,800 — all pass |
| Spike, CJS output, half-applied | 6m 28s | — |
| Spike, CJS output, fully applied | **5m 34s** (28% faster) | 2,705 — 121 failed, ~1,100 never ran |
| Spike, ESM output, fully applied | **7m 46s** (no change) | 2,774 — 56 files failed to collect |
| `--no-isolate` (PR #9001), for reference | **45s** (10.3× faster) | 3,800 — all pass |

## What was changed

- `utils` is built to a prebuilt bundle (its own source and workspace deps bundled, real
  node_modules deps left external) and `package.json#main` points at the build, so Node can load
  it directly instead of vite transforming its TypeScript.
- `packages/zambdas/vitest.config.ts` stops inlining `utils`.
- 32 deep `utils/lib/...` imports in `packages/zambdas/src` were rewritten to the barrel. Each one
  resolved to utils *source*, pulling the whole TypeScript graph back in and silently cancelling
  the externalization.

## Why it caps out

Module counts, measured with a vite plugin that counts modules transformed for one test file:

| Test file imports | Before | After |
|---|---|---|
| one symbol from `utils` | 368 | **2** |
| one symbol via the `src/shared` barrel | 779 | **413** |

Externalization does exactly what it promises: `utils` goes from 368 modules to 2. But a test that
touches `src/shared` still pulls **413 modules**, and those are zambdas' *own* source, reached
through the 45-way `export *` barrel in `src/shared/index.ts`.

**You can externalize a dependency. You cannot externalize the code under test.** Isolation
re-executes that 413-module graph once per test file, 303 times per run. No amount of dependency
packaging touches it. The only remaining lever would be breaking up the `src/shared` barrel so each
test pulls only its subject — a refactor across all of `src` and every test file, larger than the
mock consolidation in PR #9001, with no guarantee it converges.

## Why the faster variant is the broken one

The 28% appears only with **CJS** output, and the most likely mechanism is that CJS externalized
modules land in Node's `require` cache, which persists across isolated test files inside a worker
process. ESM goes back through vitest's module runner, which isolation resets per file — hence no
speedup. (Timings are measured; this mechanism is inferred, not directly instrumented.)

But CJS is what breaks module identity. With CJS, utils `require()`s zod's CommonJS build while the
vite-processed zambdas graph `import()`s zod's ESM build. Two distinct `ZodError` classes, so
`instanceof` fails and validation errors degrade to `"Unknown validation error"`. Same root cause
broke `@oystehr/sdk` default-export interop (`import_sdk.default is not a constructor`, 95 tests).
Only one copy of each package is installed, so this is the ESM/CJS dual-package hazard, not
duplicate dependencies.

Switching to ESM heals the identity split — and gives back the entire speedup.

## A second, independent cost

Rewriting the 32 deep `utils/lib/...` imports to the barrel changes mocking semantics. Code that
previously imported deep *bypassed* `vi.mock('utils')`; routed through the barrel it is now mocked,
so partial mock factories fail with e.g.
`No "ottehrCodeSystemUrl" export is defined on the "utils" mock`.

That inconsistency is worth knowing about regardless of this spike: today some modules bypass
`vi.mock('utils')` and others do not, purely based on import style.

## Worth salvaging regardless of direction

1. **7.3MB of JSON on the hot path.** `config/oystehr/in-person-intake-questionnaire-archive.json`
   (3.2MB) and `virtual-intake-questionnaire-archive.json` (4.1MB) are reachable from the `utils`
   barrel, so every unit test parses them just to import a constant. Making them lazy is small,
   self-contained, and helps both isolated and `--no-isolate`.
2. **The 32 deep `utils/lib/...` imports**, for the mocking-consistency reason above.

## Reproducing

Branch `claude/spike-utils-externalization`. Build variants:
`packages/utils/build-utils-spike.mjs` (CJS) and `build-utils-esm.mjs` (ESM); point
`packages/utils/package.json#main` at the corresponding output, then run
`cd packages/zambdas && npm run test:unit:ci`.

The module-counting harness used for the tables above is a vite plugin with a `transform` hook that
collects module ids into a `Set` and writes `set.size` on `closeBundle`, paired with single-import
probe test files.
