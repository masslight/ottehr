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


### Checked and left alone

`get-conversation` (198ms) is a `RelatedPerson` search followed by `Communication` searches that
genuinely need its results. `list-approved-patient-education` (193ms) spends its time in a single
large `List` search, with the presigned-URL fetches already concurrent — nothing structural to move.
`get-action-logs` (177ms) resolves the caller via `v1/m2m/me` before searching; that is an
authorization gate, and issuing the read concurrently with the check would mean reading on behalf of
a caller not yet known to be permitted, so it stays sequential. `list-provider-groups` (283ms) has a
dependent second `Location` search worth folding, but it backs the scheduling admin screens rather
than clinical ones. Everything else in the survey was already under 200ms with one or two waves.
