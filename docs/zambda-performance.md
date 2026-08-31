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

## Identified but not done

- **`get-appointments`' main appointment search** (~280ms of the remaining ~350ms) is now the whole
  critical path. It carries four `_revinclude:iterate` legs, two of which (`RelatedPerson:patient`,
  `Person:link`) exist solely to build the SMS/chat column. Fetching that column separately would
  shrink the search materially, but it changes the endpoint's response contract.
