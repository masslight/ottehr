## `radiology-order-list`

Radiology orders render on both the tracking board (as part of its orders column) and the visit
screen's radiology panel. Fixture: 30 encounters with one radiology order.

| | before | after | change |
| --- | --- | --- | --- |
| median latency | 195ms | 126ms | **−35%** |
| min latency | 184ms | 103ms | −44% |
| p90 latency | 302ms | 149ms | **−51%** |
| FHIR calls per invocation | 2 | 2 | — |
| sequential round trips | 2 | **1** | −1 |

Two calls, fully serialized: the endpoint resolved *who is asking* — a `v1/m2m/me` round trip via
`getMyPractitionerId` — and only then searched for orders. That resolution is deliberately not an
authorization gate here (the code says so: a caller without a Practitioner profile still reads the
list, they just lose an affordance) and it never reaches the search parameters. It feeds one thing:
the per-order flag for whether the caller may edit a final report. So the caller lookup is now passed
into the order helper as a promise and awaited after the search, which the type documents; it is
awaited on the empty-result path too, so no code path leaves the promise unobserved.

Verification note: this endpoint's integration suite cannot currently run in this environment —
`create-radiology-order` fails at `terminology.searchIcd10`, which the installed `@oystehr/sdk` does
not expose, so every radiology integration file fails at setup. Confirmed identical before and after
(11 files failed, 5 tests failed, 1 passed, 22 skipped either way), i.e. pre-existing SDK drift rather
than a regression. The change is instead verified by the response diff — byte-identical with an order
actually mapped, not just the empty early return — and by the 105 passing radiology unit tests.
