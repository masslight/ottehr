# Harvested-corpus eval — state and the remaining work

## Decision taken

Neither "restore the old harness wholesale" nor "extend run.ts" — a **hybrid**, because an
investigation showed the two halves of the old harness have very different portability:

- **`score-harvested.ts` (the scorer, ~1800 lines) is decoupled from the client.** Its entry point is
  `scoreCase(caseId, gold, state, usage?, dispositionTrigger?)` and `state` is a plain `SimFinalState`
  data structure. It imports fs/path, two ROS helpers and the gold types — **no client matchers**. It
  therefore ports as-is, and re-deriving its per-section gold comparison, transcript-derivability
  handling and voiced-aware denominators would be weeks of clinical judgement.
- **The old runner is NOT portable.** It replayed actions through the previous implementation's client
  matchers (`findExamLeafMatchesScored`, `buildExamRemoveItems`, `carrySwapPrimary`,
  `preferredExamLeaf`, `EXAM_LEAVES`, …) to build that state. Those names, shapes and the whole sim
  layer no longer exist. On this branch the executor is already headless-friendly by design, so
  rebuilding the runner against it is less work than rewiring the old one — and it exercises the code
  that actually ships.

## Done

- `gold-types.ts` — the gold/manifest types (ported, barrel imports fixed).
- `score-harvested.ts` — the scorer (ported; typechecks). Its usage type is deliberately **local**
  (`EvalTokenUsage`) rather than the app's `ModelUsage`: the scorer needs counters, and binding it to
  the app type drags in provider naming and the escalation record, which live elsewhere now. Adapt at
  the runner boundary.
- The corpus lives in `harvested-cases/` and is **gitignored** — verified with
  `git status --short | grep harvested` returning nothing. It is PHI; keep it that way.

## Remaining: the runner

Build `run-harvested.ts` that, per case in `harvested-cases/caseNNN.json`:

1. read `transcript` (the ONLY model input) and `gold`;
2. `POST` the transcript to **easy-chart-plan** as `narrative`, with `incremental: false` and no
   chartState — the case starts from an empty chart;
3. execute the returned `actions` through the **real executor**: `runPlan(actions, context)` with a
   fake `ChartWriter` and a fake/real `Catalogue`, mode `'bulk'` so ambiguity auto-picks rather than
   blocking on a picker;
4. fold the applied steps into a `SimFinalState` — this is the one genuinely new piece of work. The
   shape is in `score-harvested.ts`; `advanceSnapshot` in the executor already does the same job for
   `ChartSnapshot` and is the closest model to follow;
5. `scoreCase(caseId, gold, state, usage)` → write `caseNNN.score.json`;
6. aggregate with the scorer's own `aggregateScores` / `formatSummary` into `summary.json`.

Then, in order of value: the **transcript-derivability** pass (`tag-voiced.ts` in the old branch —
without it the fidelity number counts gold items the recording never heard and never improves), and
the free-text LLM judge.

## Practical notes from the corpus author

- A full 191-case run takes a couple of hours and burns real model tokens. Do not kick one off casually.
- Expect ~10% of cases to fail on transient fetch errors; re-run just those and let results interleave
  into the same output directory.
- The free-text judge needs `ANTHROPIC_API_KEY`, which the synth secrets file does not carry.
- `encounterHash` is known to be unstable across harvests — do not use it as a permanent unique key.
