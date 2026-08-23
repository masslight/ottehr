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

---

## Patient details screen

Two endpoints back this screen: `/patient/:id` loads the visit history, and `/patient/:id/info` loads
the account and insurance panel. (The rest of the screen — the patient resource itself, duplicate
detection, the active merge task — is read straight from FHIR by the frontend, not through a zambda.)
Fixture: one patient with ten past visits, a billing account with a guarantor, a payor organization
and coverage, and two eligibility responses. All figures are paired 20-iteration runs.

### `get-patient-visit-history`

| | before | after | change |
| --- | --- | --- | --- |
| median latency | 215ms | 153ms | **−29%** |
| min latency | 187ms | 108ms | **−42%** |
| p90 latency | 249ms | 189ms | −24% |
| FHIR calls per invocation | 2 | 2 | — |
| sequential round trips | 2 | **1** | −1 |

This endpoint makes only two FHIR calls, and they were fully serialized: a `complexValidation` step
fetched the `Patient` purely to confirm it exists — it discards the resource and returns its input
untouched — and only then did the visit search run. The search is keyed on the patient id from the
request and reads nothing that check produces, so awaiting it first put an entire round trip in front
of every load of this screen for no benefit. The two now run concurrently, which halves the round
trips; a missing patient still fails, with the same error, because the rejection propagates out of the
`Promise.all` exactly as it did before.

### `get-patient-account`

| | before | after | change |
| --- | --- | --- | --- |
| median latency | 381ms | 220ms | **−42%** |
| min latency | 325ms | 171ms | **−47%** |
| p90 latency | 460ms | 347ms | −25% |
| FHIR calls per invocation | 6 | 5 | −17% |
| sequential round trips | **4** | **2** | −2 |

Four sequential round trips for one panel. Two of them were unnecessary. The eligibility-check
query — which deliberately fetches ids first and full resources second, because real
`CoverageEligibilityResponse`s can be large enough to blow the response size cap — was waiting on the
account resources even though it needs nothing but the patient id; it now goes out alongside them.
The last round trip was a batch fetching the `Coverage` each eligibility check references, and the
account query one wave earlier had already returned this patient's coverages: eligibility checks are
normally run against exactly those, so the ids were usually already in hand. Fetching only the ones
that are not — typically none — skips that round trip entirely in the common case, and guarding on an
empty request list also stops the endpoint issuing an empty batch request when an eligibility check
carries its coverage inline rather than by reference, which it did unconditionally before. The
coverage pool the response is built from ends up holding the same resources by id either way, which
the response diff confirms. Worth noting for anyone reading the remaining two waves: the second is
the per-eligibility-check fan-out, which is bounded at ten by the id query's `_count` and is already
concurrent.

---

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

---

## `makeEncounterLabResults` — lab results on the progress note

Reached from `get-chart-data` whenever `externalLabResults` or `inHouseLabResults` are requested,
which the progress note does. Each lab-result document needs a presigned download URL, and those
calls were awaited **one at a time inside a `for` loop** — so a visit with N result documents paid N
fully serialized network round trips before the note could render. This is the one change here that
is not an end-to-end zambda measurement: a faithful fixture would need real Z3 PDF objects behind the
result `DocumentReference`s, which only the in-house-lab order-and-result flow produces. What is
measured is the round trip being parallelized, and the transformation itself:

| | serial (before) | concurrent (after) | saved |
| --- | --- | --- | --- |
| 1 result document | 88ms | 88ms | — |
| 2 result documents | 164ms | 93ms | 70ms |
| 4 result documents | 339ms | 106ms | **234ms** |
| 8 result documents | 631ms | 228ms | **403ms** |

(Single presigned-URL POST: min 71ms, median 88ms, p90 106ms.)

The requests are now started as the loop walks the documents and consumed in that same order
afterwards, so the assembled result arrays — external, in-house, and the reflex results that get
grafted onto their originating order — come out ordered exactly as the sequential version produced
them, which is the only thing the change could plausibly have disturbed. Failure behaviour is
unchanged: a presigned-URL fetch that fails still fails the call.

### Also swept, and clean

Worth recording so the next person does not re-check them. `get-medication-orders`,
`get-immunization-orders`, `get-nursing-orders`, `get-erx-orders` and `get-patient-instructions` are
each a single FHIR search — already optimal. `fetchActivityDefinitions` (also inside the lab result
path) fans out per canonical URL but already does so concurrently; since canonical resources are
immutable per version it is a candidate for a module-scope cache across warm invocations, which would
remove the round trip rather than just overlap it. `list-approved-patient-education` fetches a
presigned URL per document, but already concurrently. `get-lab-orders` is three waves over a much
larger surface and was left alone: it is the one remaining reader in this area where the work is
non-obvious rather than mechanical.

---

## Hunting the rest of the EHR getters

Rather than pick targets by reading code, the bench gained an `--all` survey mode: it runs every
scenario briefly and ranks them by measured latency. The candidate set was the 44 zambdas that are
`http_auth`, live under `src/ehr/`, are getters (`get-*` / `list-*` / `search-*`), and are neither
`admin-*` nor async — wired to the ids the existing fixtures already provide.

One endpoint was an order of magnitude worse than everything else. Ranked medians, abbreviated:

```
 3839ms  get-employees                  <-- outlier
  342ms  get-appointments
  283ms  list-provider-groups
  238ms  ehr-get-visit-details
  229ms  get-vitals-for-list-of-encounters
  227ms  get-vitals
  206ms  get-patient-account
   ...
   81ms  get-em-codes                   (23 further endpoints, all under 200ms)
```

### `get-employees`

| | before | after | change |
| --- | --- | --- | --- |
| median latency | 3710ms | 719ms | **−81%** |
| min latency | 3672ms | 667ms | −82% |
| p90 latency | 3863ms | 833ms | −78% |

Worth stressing that this is not only an admin-screen endpoint: the heavy (non-`lite`) path is called
from inside the visit screens — `useGetFieldOptions` and the patient-followup forms — so clinical
users were paying nearly four seconds for it.

Almost all of that was one search. The endpoint asked for three things in a single `fhir.batch` of
inline GETs, and since batch entries execute serially server-side the batch cost their sum; one entry
dominated it completely. The two Encounter searches exist only to compute `seenPatientRecently`, and
the `finished`-status one — org-wide, every finished encounter in the last 30 minutes — measured
~3.5s on its own. Scoping it to the employees' own Practitioner references brings it to ~190ms, and
the result is provably the same: an encounter can only contribute an employee's reference if that
employee participates in it, which is exactly what the filter selects for. The three searches then
run concurrently rather than as one serial batch, so the endpoint costs the max instead of the sum,
and they became POST searches so the participant filter is not limited by URL length. Verified
field-by-field against the original across all 557 employees on live data: every field identical,
`seenPatientRecently` included.

**A correctness issue found while measuring, and deliberately not changed here.** The remaining
in-progress Encounter search is org-wide with no `_count` and no date bound. On this project it
matches 137,722 encounters and the server returns the first 1,000 — so `seenPatientRecently` is
computed from an arbitrary sample, and found 2 employees where a participant-scoped query found 45.
Scoping that search would make it correct but *slower* here (a 557-reference OR measured ~3.0s
against ~0.5s unscoped), and adding the date bound its name implies would change what the flag means
for a visit left open overnight. Both are product decisions rather than performance ones, so this
change leaves the query shape exactly as it was and flags it instead.

### `get-vitals`

| | before | after | change |
| --- | --- | --- | --- |
| median latency | 212ms | 106ms | **−50%** |
| min latency | 183ms | 99ms | −46% |
| p90 latency | 369ms | 226ms | −39% |
| FHIR calls per invocation | 2 | 2 | — |
| sequential round trips | 2 | **1** | −1 |

The progress note's vitals panel. Two FHIR calls, fully serialized — the third instance in this
sweep of a validation search blocking the search that does the actual work. In *current* mode the
vitals search is keyed on the encounter id from the request, and the things validation resolves (the
patient id, the appointment start) are used only by *historical* mode. So current mode now starts
both together and still awaits validation before using its result, meaning an unknown encounter fails
exactly as before; historical mode genuinely depends on the validation output and stays sequential.
Both modes are covered by the integration suite.

### Checked and left alone

`get-conversation` (198ms) is a `RelatedPerson` search followed by `Communication` searches that
genuinely need its results. `list-approved-patient-education` (193ms) spends its time in a single
large `List` search, with the presigned-URL fetches already concurrent — nothing structural to move.
`get-action-logs` (177ms) resolves the caller via `v1/m2m/me` before searching; that is an
authorization gate, and issuing the read concurrently with the check would mean reading on behalf of
a caller not yet known to be permitted, so it stays sequential. `list-provider-groups` (283ms) has a
dependent second `Location` search worth folding, but it backs the scheduling admin screens rather
than clinical ones. Everything else in the survey was already under 200ms with one or two waves.

---

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

---

## `get-create-lab-order-resources`

Loads when a provider opens the external-lab order form on a visit.

| | before | after | change |
| --- | --- | --- | --- |
| median latency | 185ms | 139ms | **−25%** |
| min latency | 170ms | 114ms | −33% |
| p90 latency | 241ms | 250ms | ~flat |
| FHIR calls per invocation | 1 | 3 | +2 |
| sequential round trips | 1 | 1 | — |

The third instance of the serial-batch problem, and the reason it is worth naming as a pattern rather
than a one-off: this endpoint already made a *single* FHIR call, which looks unimprovable, but that
call was a batch of up to six independent searches — coverages, accounts, the lab list, the encounter
and its appointment, lab organizations, ordering locations — and batch entries run one after another
server-side, so the call cost their sum. Split across three concurrent batches it costs the max. The
response is assembled by resource type rather than by request position, so how the requests are
grouped cannot affect it; the diff confirms it byte-for-byte. Note the p90 does not improve here — at
this size the win is in the median and the floor, and three connections have a slightly wider tail
than one.
