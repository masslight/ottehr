## `get-chart-data` — progress note initial load

The progress note fires **two** `get-chart-data` calls on mount: `useChartData` sends no
`requestedFields` (the "everything" default) and `useChartFields` sends
`progressNoteChartDataRequestedFields`. Both are benched. Fixture: the visit-details visit above,
plus chart resources so the response is actually populated (chief complaint, history of present
illness, medical decision, an allergy, a medication, an observation, a procedure, a note).

`useChartData` (no `requestedFields`):

| | before | after | change |
| --- | --- | --- | --- |
| median latency | 354ms | 231ms | **−35%** |
| min latency | 316ms | 222ms | −30% |
| p90 latency | 539ms | 304ms | **−44%** |
| FHIR calls per invocation | 3 | 6 | +3 |

`useChartFields` (progress-note fields):

| | before | after | change |
| --- | --- | --- | --- |
| median latency | 420ms | 234ms | **−44%** |
| min latency | 389ms | 210ms | −46% |
| p90 latency | 439ms | 282ms | **−36%** |
| FHIR calls per invocation | 2 | 6 | +4 |

Unlike the other two endpoints, this one was already batching properly — every chart search went out
in a single `fhir.batch`, which looks optimal and reads as one round trip in a waterfall. The problem
is that **a FHIR batch executes its entries one after another on the server**, so a batch of N
searches costs roughly the sum of all N rather than the max. Measured directly against this backend
with a representative set of 18 chart searches: 455ms as one batch, 246ms as two concurrent batches
of nine, and 173ms as either three of six or six of three — and 111ms as eighteen fully parallel
single-search requests. The fix is to split the request list across a handful of batches issued
concurrently, converting that server-side sum into a max; the constants target six concurrent
batches with a floor of three searches each, which the measurements show sits at the flat part of
that curve without pushing dozens of simultaneous connections at the backend the way full fan-out
would. This is deliberately the *only* change to the endpoint's semantics-free surface: the requests
are independent, `chunkThings` and `Promise.all` both preserve order, and the response is assembled
by resource type rather than by request index, so concatenating the batch responses back together
yields a byte-identical payload — verified for both call shapes. What remains on the critical path is
the serialized `Encounter` + `Patient` prefetch that runs before the batch can be built (it supplies
the patient id that patient-scoped searches need), which is now roughly half the endpoint's latency.
`Patient?_has:Encounter:subject:_id=<encounterId>` resolves the right patient in one hop, so
attacking that is feasible, but it would mean re-expressing every patient-scoped chart search as a
nested reverse chain — a change whose correctness could not be established cheaply, since a
silently mis-scoped search here would return another patient's data or quietly drop the patient's
own. Left as the identified next step rather than shipped on a guess.

---

## Identified but not done

- **`get-chart-data`'s serialized encounter/patient prefetch** — see above. Worth ~110ms (roughly
  half the endpoint's remaining latency) if the nested reverse-chain form can be verified.
