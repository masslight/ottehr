# Zambda performance work

Latency work on the zambdas behind the **tracking board**, **visit details**, and **progress note**
screens. Every number here was measured with `packages/zambdas/scripts/perf/bench.ts` (see its
README), which runs the real handler through the real `local-server` app against the local Ottehr
environment and records a waterfall of every outbound FHIR call.

Two metrics matter more than raw milliseconds, because they are what actually sets the floor:

- **sequential waves** — FHIR round trips on the critical path. Each one costs a full network
  round trip (~90–130ms against this backend), no matter how small the query.
- **FHIR calls** — total requests issued. A large fan-out is slow even when it is concurrent,
  because of connection setup and tail latency.

Every change below was verified output-identical: the bench's `--dump` captured the full response
body before and after, and the two were diffed key-sorted.
