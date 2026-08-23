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

---

## `get-appointments` — tracking board

Fixture: 30 in-person appointments at one location on one day, each with a patient, a
user-RelatedPerson with an SMS number, an encounter with a practitioner participant, and a
questionnaire response.

| | before | after | change |
| --- | --- | --- | --- |
| median latency | 758ms | 352ms | **−54%** |
| min latency | 627ms | 330ms | −47% |
| p90 latency | 1183ms | 382ms | **−68%** |
| FHIR calls per invocation | 35 | 6 | **−83%** |
| sequential waves (warm) | 3 | 2 | −1 |
| sequential waves (cold) | 4 | 3 | −1 |

Three things were making this slow, and the waterfall showed all of them. First, `Provenance`
resources — the supervisor-approval signatures — were fetched with **one search per encounter**, so a
30-row board issued 30 concurrent searches whose tail latency (315ms for the slowest, against ~100ms
for a normal search) dominated the response; `target` accepts a comma-separated OR list, so these
collapse into a single search per 100 encounters, which was verified to return exactly the same
Provenances as the per-encounter version. Second, the `RelatedPerson` fallback search was awaited
entirely on its own before anything else was even issued, costing a full round trip that only the
`Communication` search actually depends on — so the document-reference, practitioner, provenance and
parent-encounter searches now all go out alongside it, and the `Communication` search is issued
speculatively with the phone numbers the main appointment search already surfaced, with a narrow
follow-up search only in the rare case the fallback turns up a number that search missed. Third, the
missing-parent-`Encounter` search was awaited after that whole group, adding yet another round trip
whenever the board contained follow-up visits; it is now part of the same concurrent group. Separately,
on a cold invocation the per-location timezone lookup was blocking the appointment search even though
the search uses the caller-supplied timezone and the timezone map is only read at formatting time —
it now overlaps the search instead. That last change also removed `makeEncounterSearchParams`,
`makeEncounterBaseSearchParams`, `makeResourceCacheKey` and `encounterIdMap`, whose computed search
params were being thrown away unused at the only call site: the function was in practice an
expensive way to populate the timezone map, and leaving it in place invited someone to reintroduce
the round trip.

---

## `ehr-get-visit-details` — visit details screen

Fixture: one in-person visit with the satellite resources the screen actually reads — an intake
questionnaire response pointed at the instance's active intake questionnaire, a Slot/Schedule chain
(the source of the visit timezone), a consent `DocumentReference` + `Consent` pair, an `Account` with
a guarantor, and a `Flag` on the encounter. The patient has no insurance, so these numbers are the
optimistic case: a patient with `Coverage`s adds a further serialized payer lookup.

| | before | after | change |
| --- | --- | --- | --- |
| median latency | 337ms | 247ms | **−27%** |
| min latency | 303ms | 236ms | −22% |
| p90 latency | 490ms | 322ms | **−34%** |
| FHIR calls per invocation | 6 | 5 | −17% |
| sequential round trips | 3 | 2 | −1 |

The waterfall showed the appointment search fanning out into two independent chains that were each
three round trips deep, so shortening only one of them would not have helped. On the consent chain,
the `Consent` search was keyed on the id of the `DocumentReference` the previous search returned,
which forced it to wait; chaining through the source document reference to the appointment
(`source-reference:DocumentReference.related`) narrows the `Consent` search the same way without
needing that id, so both searches now go out together and a client-side filter on the returned
document reference keeps the result set exactly what the sequential version produced — provably, not
just empirically, since the document references were already filtered to that appointment. On the
account chain, `getAccountAndCoverageResourcesForPatient` was fetching the EHR payer-override `List`
*after* the patient/coverage searches even though it depends on nothing at all, so that fetch now
starts up front and overlaps them; this helper is shared, so every caller of it gets the same
saving. Finally, the standalone-forms lookup was re-searching `Encounter` plus
`QuestionnaireResponse` for the same appointment the main search had already pulled both of via
`Encounter:appointment` and `QuestionnaireResponse:encounter` — that search is gone and the forms
are selected straight out of the main bundle. The one trade-off: the `Consent` search now always
runs rather than being skipped when no consent document exists, which is one extra call but no extra
latency, since it is concurrent.

---

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
yields a byte-identical payload — verified for both call shapes. That left the serialized `Encounter` + `Patient` prefetch
as the only thing still on the critical path — addressed next.

### Stage two: dropping the serialized encounter/patient prefetch

`getChartData` opened by resolving the Encounter and its Patient in a round trip of their own, purely
to obtain the patient id that patient-scoped searches need. That put a full serialized FHIR round
trip in front of every chart load — after the batch split, about half the endpoint's remaining
latency. All 15-iteration runs against one fixture:

`useChartData` (no `requestedFields`):

| | original | after batch split | after prefetch removal | total change |
| --- | --- | --- | --- | --- |
| median latency | 348ms | 253ms | **158ms** | **−55%** |
| min latency | 314ms | 235ms | **129ms** | −59% |
| p90 latency | 490ms | 358ms | **247ms** | **−50%** |
| sequential waves | 2 | 2 | **1** | −1 |

`useChartFields` (progress-note fields):

| | original | after batch split | after prefetch removal | total change |
| --- | --- | --- | --- | --- |
| median latency | 453ms | 289ms | **174ms** | **−62%** |
| min latency | 370ms | 227ms | **137ms** | −63% |
| p90 latency | 490ms | 362ms | **223ms** | **−54%** |
| sequential waves | 2 | 2 | **1** | −1 |

Patient-scoped searches are now scoped by the encounter's *subject* through a reverse chain —
`?subject:Patient._has:Encounter:subject:_id=<encounterId>` — so the entire request set is built from
the encounter id alone and the endpoint issues exactly one wave. The same shape replaces the other
three things that needed the prefetch: the `Practitioner` lookups (which were additionally a
per-`Encounter.participant` fan-out) collapse to one `Practitioner?_has:Encounter:participant:_id=`
search, the `patientHasPreviousVisits` count becomes
`Appointment?patient:Patient._has:Encounter:subject:_id=…&_summary=count`, and the `Patient` resource
itself — still needed for `patientId` and for the pharmacy list — is fetched concurrently rather than
ahead, deliberately kept out of the merged bundle so the set of resources feeding the response is
unchanged. The one gate that had to go was `preferredPharmacies` only searching for its
`QuestionnaireResponse` when the patient already had contained pharmacy Organizations: that list is
built entirely from `patient.contained` and the questionnaire response only marks which entry is
primary, so issuing the search unconditionally is output-neutral. Because a mis-scoped search here
would be a *wrong-patient* bug rather than a slow one, the scoping was verified before being
shipped: two patients were seeded with identical-looking resources, and for all seven patient-scoped
resource types the encounter-scoped search returned exactly its own patient's resource, never the
other's, and matched the direct `?subject=Patient/<id>` search — with the project's ~115k patients
making a silently-dropped filter show up as hundreds of rows rather than one. Both response payloads
are byte-identical before and after, with `allergies`, `medications` and `surgicalHistory` (three
distinct patient-scoped searches) populated. One caution is worth carrying forward, and it is
recorded on the helper: do not add `_revinclude` / `_include:iterate` to a search scoped this way
without checking where the included resource can point, because an iterate leg that walks out
through a resource shared with other patients would pull their data into a patient-scoped result.
No patient-scoped chart search carries one today — the only `_revinclude` in the chart field set is
on `radiologyOrders`, which is encounter-scoped.

---

## Identified but not done

- **The progress note's two `get-chart-data` calls** overlap substantially and each pay the prefetch
  separately. Merging them into one request is a frontend change, not a zambda one.
- **`get-appointments`' main appointment search** (~280ms of the remaining ~350ms) is now the whole
  critical path. It carries four `_revinclude:iterate` legs, two of which (`RelatedPerson:patient`,
  `Person:link`) exist solely to build the SMS/chat column. Fetching that column separately would
  shrink the search materially, but it changes the endpoint's response contract.
- **Insured patients on visit details** pay an extra serialized payer lookup inside
  `getAccountAndCoverageResourcesForPatient` (`searchInsuranceInformation`, which needs the coverages
  from the previous search). Not measured here, since the fixture patient is uninsured.
