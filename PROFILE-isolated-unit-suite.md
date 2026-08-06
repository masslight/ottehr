# Where the isolated unit suite actually spends its time

Profiled with V8's CPU profiler inside the test worker
(`poolOptions.forks.execArgv: ['--cpu-prof', '--cpu-prof-dir=...']`), on `develop`, no coverage.

**It is not executing your code, and it is not module count. It is Node re-reading and
re-resolving the dependency closure from disk, once per test file.**

## The measurement

12 real test files (`test/unit/validate-request-parameters/*`), single worker:

| | isolated | `--no-isolate` |
|---|---|---|
| wall | **29.4s** | **6.7s** |
| of which `collect` | 27.6s | 5.9s |
| of which `tests` (the actual assertions) | 0.077s | 0.083s |

Hot functions in the isolated worker profile (29.1s sampled):

| self time | function |
|---|---|
| 8.37s | `readFileUtf8` |
| 6.71s | `(idle)` |
| 4.76s | `read` |
| 1.71s | `internalModuleStat` |
| 0.80s | `readPackageJSON` |
| 0.73s | `(garbage collector)` |
| 0.56s | `wrapSafe @ cjs/loader` |

Attributing that I/O to callers:

| self time | caller chain |
|---|---|
| 8.17s | `loadSource @ node:internal/modules/cjs/loader` |
| 4.76s | `readFileSync → tryReadSync → readSync @ node:fs` |
| 0.75s | module-resolution `stat @ cjs/loader` |
| 0.64s | `tryPackage → _readPackage → read @ package_json_reader` |

So **~54% of CPU is filesystem work driven by Node's CommonJS loader**, plus 6.7s idle waiting on
it. Under `--no-isolate` the same functions vanish from the profile entirely (`readFileUtf8` and
`read` do not appear; `internalModuleStat` drops to 0.24s).

## Isolation overhead itself is trivial — the closure is the cost

10 identical files of each kind, isolated, no coverage:

| Test file content | per-file cost |
|---|---|
| empty (`expect(1).toBe(1)`) | **0.04s** |
| import one symbol deep from `src/shared/auth` | **0.80s** |
| import one symbol via the `src/shared` barrel | **0.88s** |
| import one symbol from `utils` | **0.96s** |

Vitest's per-file isolation machinery costs ~38ms. Everything above that is re-loading
dependencies. Importing a *single function* from `utils` costs ~0.9s per file, because
`utils` resolves to `lib/main.ts` — TypeScript source, 339 files behind 12 `export *` barrels —
and drags heavy SDKs (`candidhealth`, `@pdf-lib`, `stripe`, `@oystehr/sdk`) along with it.

This is why the suite is abnormally slow compared to other projects: a typical unit test imports a
handful of modules; here every test re-reads a few hundred source files plus several MB of
node_modules, 303 times per run.

## Barrel elimination would buy ~10%

Deep import 0.80s/file vs barrel import 0.88s/file. Real, but not worth rewriting the 714 `src`
files that import the shared barrel.

## Corrections to earlier analysis in SPIKE-utils-externalization.md

- The module-count probe used there counted **vite transforms only**. It never counted the
  externalized node_modules that Node re-loads per file, which is where the time actually goes.
  That is why an ~84% "module reduction" from externalizing `utils` bought only 0–28% of wall time.
  The conclusions in that document stand; the module-count reasoning behind them does not.
- The 7.3MB questionnaire archives are **~35ms/file** of raw read+parse (73MB moved across 10
  files), not the major cost that document implies. Still worth making lazy, but it is a small win.

## Reproducing

`vitest.prof.config.ts` on branch `claude/profile-isolated` mirrors the unit project and adds
`--cpu-prof` to the worker. `/tmp/analyze-prof.mjs` and `/tmp/callers.mjs` (inlined in the session)
aggregate self-time by script bucket and attribute fs calls to caller chains by walking the
`.cpuprofile` parent graph.
