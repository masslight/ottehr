# Zambda performance bench

A harness for measuring — and then actually reducing — the latency of the zambdas behind the
tracking board, visit details, and progress note screens.

It boots the real `local-server` express app in-process, seeds (or reuses) realistic fixture data,
and invokes a zambda over HTTP repeatedly. Because the handler runs in this process, patching
`globalThis.fetch` records a **waterfall of every outbound FHIR call**: start offset, duration, and
a compact label. Calls are grouped into "waves" — a new wave begins when a request is issued after
every previously-seen request has already finished, which is precisely the signature of a serialized
`await`. So:

- **wave count** = sequential FHIR round trips on the critical path (the thing that sets the latency floor)
- **repeated labels inside one wave** = an N+1 fan-out

Always run against the local Ottehr environment.

```bash
cd packages/zambdas

# baseline a scenario
ENV=local VITEST=true NODE_OPTIONS='--preserve-symlinks' npx tsx scripts/perf/bench.ts \
  --scenario=get-appointments --iters=9 --warmup=2

# capture the full response body, so a refactor can be proven output-identical
... --dump=/tmp/before.json      # then again after the change, and diff the two

# machine-readable stats for before/after comparison
... --json=/tmp/result.json --label=my-experiment

# fixture size: --appointments=N (tracking board), --visits=N (patient visit history)

# delete every fixture this bench has seeded
ENV=local VITEST=true NODE_OPTIONS='--preserve-symlinks' npx tsx scripts/perf/bench.ts --teardown
```

`VITEST=true` only suppresses `local-server`'s own `app.listen()` so the bench can bind its own
ephemeral port; nothing else in the codebase reads that variable.

Fixture ids are cached in `packages/zambdas/.perf-bench/` (gitignored) so a fixture is seeded once
and reused across many runs, which keeps before/after comparisons on identical data.

## Scenarios

| scenario | zambda | screen |
| --- | --- | --- |
| `get-appointments` | `get-appointments` | tracking board |
| `ehr-get-visit-details` | `ehr-get-visit-details` | visit details |
| `get-chart-data-default` | `get-chart-data` (no `requestedFields`) | progress note (`useChartData`) |
| `get-chart-data-progress-note` | `get-chart-data` (progress-note fields) | progress note (`useChartFields`) |
| `get-patient-visit-history` | `get-patient-visit-history` | patient details (`/patient/:id`) |
| `get-patient-account` | `get-patient-account` | patient details (`/patient/:id/info`) |

Add a scenario by adding an entry to `SCENARIOS` in `bench.ts`; add fixture data it needs to
`fixtures.ts` (stamp every resource with the fixture tag so `--teardown` can find it).
