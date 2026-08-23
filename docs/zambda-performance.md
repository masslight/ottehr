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
