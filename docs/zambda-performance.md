## `get-vitals-for-list-of-encounters` — tracking board vitals

Found by sweeping the reader endpoints for the shapes that had already proved expensive elsewhere:
a per-item FHIR call inside a `map`, independent `await`s in sequence, and one oversized `fhir.batch`.
This endpoint is called from the tracking board with **every visible encounter at once** — and issued
one `Observation` search per encounter. Fixture: 30 encounters, each with two vitals observations.

| | before | after | change |
| --- | --- | --- | --- |
| median latency | 403ms | 242ms | **−40%** |
| min latency | 296ms | 209ms | −29% |
| p90 latency | 638ms | 329ms | **−48%** |
| FHIR calls per invocation | 31 | 3 | **−90%** |
| sequential round trips | 2 | 2 | — |

The same N+1 as the tracking board's Provenance searches, in a different endpoint: 30 concurrent
`Observation` searches for a 30-row board, whose tail latency (the slowest took 174ms against ~110ms
for a normal one) set the response time. `encounter` accepts a comma-separated OR list, so a chunk of
encounters now resolves in one search and the results are grouped by `Observation.encounter` —
grouping preserves the server's `-date` ordering within each encounter, and every requested encounter
still appears in the response whether or not it has vitals. Before changing anything, both candidate
batched forms (`encounter=Encounter/a,b,…` and the chained `encounter._id=a,b,…`) were checked against
the sum of the per-encounter searches and returned exactly the same 60 observations across the same 30
encounters; a control search with no encounter filter at all *timed out*, which is what confirms the
batched form is genuinely filtered rather than quietly returning everything and being saved by the
grouping step. One deliberate difference: the search is now paged, where before it was a single
unbounded page. That cannot change the result for any realistic encounter, but it means a chunk whose
encounters carry an unusual number of vitals can no longer be silently truncated — a latent bug in the
per-encounter version, since it had no `_count` either.
