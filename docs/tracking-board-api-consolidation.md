# Tracking board: consolidate the refresh into one `get-appointments` call

Status: proposal / implementation plan
Scope: `apps/ehr` tracking board (`/visits`), `packages/zambdas`, `packages/utils`, `config/oystehr-core`

## 1. What happens today

### 1.1 The refresh loop

`apps/ehr/src/pages/Appointments.tsx` owns the loop:

- A `setInterval` (constant `30000` in `Appointments.tsx`; the loop skips ticks while a fetch is in flight)
  resets `loadingState` to `initial`, which re-runs the fetch effect. The page is visibility-gated
  (`usePageVisibility`) and paused while a comment is being edited.
- The effect calls `getAppointments` (zambda `get-appointments`). On success it does two things that fan out
  to every other endpoint:
  - `setAppointmentsVersion(Date.now())` bumps a `refreshKey` that four hand-rolled `useEffect` hooks depend on
    (external labs, in-house labs, nursing, radiology). Each one re-runs its own fetch.
  - `refetchOrders()` calls `.refetch()` on three React Query hooks (in-house medications, eRx, procedures).
- A 300 ms `useDebounce` delays committing the appointment results so the order data has a chance to land first.

Net effect: every tick is one appointment request plus seven order requests, all issued from the browser as
separate authenticated zambda executions, each with its own cold-start risk and each re-resolving the same
encounter graph server-side.

### 1.2 The eight requests per tick

| #   | Zambda                                                                      | Fired by                                     | FHIR calls it makes today (encounterIds path)                                                                                                                                                                                                                                                                                                                                                                              | What the board renders from it                                           |
| --- | --------------------------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | `get-appointments`                                                          | fetch effect                                 | Appointment search per actor (paged, `_include` patient/location/actor, `_revinclude:iterate` Encounter/QR/RelatedPerson/Person) + RelatedPerson fallback + DocumentReference (cards) + Practitioner `_id` + Provenance (verifier, chunked 100) + parent Encounters + Communication (SMS, 1-2 calls)                                                                                                                       | everything in the four tab buckets                                       |
| 2   | `get-lab-orders` (external)                                                 | `refreshKey`                                 | ServiceRequest search with `_include` encounter/patient, `_revinclude` Task/DiagnosticReport/Provenance, `_include:iterate` Coverage, DiagnosticReport:result (Observations), Encounter:appointment, Appointment:slot, Slot:schedule; then Practitioner `fhir.batch`, a second Task search keyed on DiagnosticReports, a reflex-result DiagnosticReport search, a Location `_id` search, optional presigned ABN/order PDFs | `serviceRequestId`, `testItem`, `orderStatus`, `appointmentId`           |
| 3   | `get-in-house-orders`                                                       | `refreshKey` (gated by `inHouseLabsEnabled`) | ServiceRequest search with `_include` encounter, instantiates-canonical (ActivityDefinition), `_revinclude` Task/Provenance, `_include:iterate` Encounter:location, Encounter:appointment, Appointment:slot, Slot:schedule; then Practitioner `fhir.batch` (requesters + attending)                                                                                                                                        | `serviceRequestId`, `testItemName`, `status`, `appointmentId`            |
| 4   | `get-nursing-orders`                                                        | `refreshKey`                                 | ServiceRequest search with `_include` requester/encounter, `_revinclude` Task/Provenance, `_include:iterate` Provenance:agent                                                                                                                                                                                                                                                                                              | `serviceRequestId`, `note`, `status`, `appointmentId`                    |
| 5   | `radiology-order-list`                                                      | `refreshKey`                                 | ServiceRequest search with `_revinclude` Task/DiagnosticReport/DocumentReference, `_include` requester/encounter, `_include:iterate` Encounter:participant:Practitioner; plus a `user/me` lookup to resolve the caller's practitioner (only used for edit affordances)                                                                                                                                                     | `serviceRequestId`, `studyType`, `status`, `external`, `appointmentId`   |
| 6   | `get-medication-orders`                                                     | `refetchOrders()`                            | MedicationAdministration search (`_tag` in-house, `context=Encounter/...`) with `_include` subject (Patient), performer (Practitioners), request (MedicationRequest), `_revinclude` MedicationStatement                                                                                                                                                                                                                    | `id`, `medicationName`, `status`, `reason`, `otherReason`, `encounterId` |
| 7   | `get-erx-orders`                                                            | `refetchOrders()`                            | MedicationRequest search (`_tag=erx-medication`, `encounter=...`) — already lean                                                                                                                                                                                                                                                                                                                                           | `resourceId`, `name`, `status`, `encounterId`                            |
| 8   | `get-chart-data` (procedures via `requestedFields.procedures.encounterIds`) | `refetchOrders()`                            | Three `fhir.batch` calls: chart batch (Encounter GET for `encounterIds[0]` + `ServiceRequest?encounter=...&status=completed`), Patient lookup for `encounterIds[0]`, `patientHasPreviousVisits` appointment count for `encounterIds[0]`                                                                                                                                                                                    | `resourceId`, `procedureType`, `encounterId`                             |

Two more requests fire only when the encounter set changes (they are React Query hooks keyed on the id list, so the
30 s tick does not refresh them):

| Zambda                              | Cache policy today         | FHIR calls                                                                                              | What the board renders                                                         |
| ----------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `get-immunization-orders`           | `staleTime` 5 min          | MedicationAdministration search (`_tag=immunization`, `context=...`)                                    | `id`, `details.medication.name`, `status`, `encounterId`                       |
| `get-vitals-for-list-of-encounters` | `staleTime` 0, no interval | Encounter `_id` search + `_include` patient; Observation search chunked by 25 with `_include` performer | only entries with `alertCriticality` (client filters with `getAbnormalVitals`) |

That last row is a latent bug: abnormal-vitals badges and immunization icons can sit stale until the encounter list
changes or the tab regains focus. The consolidated endpoint fixes this for free because everything rides the same
refresh.

### 1.3 Where the overlap is

The seven order endpoints are all keyed on the same `encounterIds`, and each independently re-fetches context that
`get-appointments` already holds in memory when it builds the buckets:

| Resource                                                                                                                  | Fetched by                                                                                                                                                                                                | Why each one fetches it                                                    | Needed for the board?                                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Encounter                                                                                                                 | get-appointments, external labs, in-house labs, nursing, radiology, chart-data, vitals (7x)                                                                                                               | map ServiceRequest to appointmentId, find attending practitioner, timezone | Already in `apptRefToEncounterMap`. No.                                                     |
| Appointment + Slot + Schedule                                                                                             | external labs, in-house labs                                                                                                                                                                              | `visitDate` and `timezone` fields on list DTOs                             | Board never renders them. No.                                                               |
| Practitioner                                                                                                              | get-appointments, external labs (batch), in-house labs (batch), nursing (include), radiology (include x2), medications (include), vitals (include) (7x)                                                   | ordering/attending names                                                   | Board renders no ordering-provider names for orders; vitals need `authorName`. Mostly no.   |
| Patient (+ Coverage)                                                                                                      | get-appointments, external labs, medications, vitals, chart-data (5x)                                                                                                                                     | labs pull every Coverage per patient for the detail page                   | No.                                                                                         |
| Provenance                                                                                                                | get-appointments (verifier), external labs, in-house labs, nursing (4x)                                                                                                                                   | signature date; lab history; nursing ordering physician                    | Only get-appointments' use is rendered.                                                     |
| Task                                                                                                                      | external labs (2 searches), in-house labs, nursing, radiology                                                                                                                                             | order status derivation                                                    | Yes, but one `_revinclude=Task:based-on` on a single ServiceRequest search covers all four. |
| DiagnosticReport (+ Observation results, Specimen, DocumentReference, Communication, Organization, QuestionnaireResponse) | external labs, radiology                                                                                                                                                                                  | status + detail pages                                                      | DiagnosticReport yes (status); the rest no.                                                 |
| ServiceRequest                                                                                                            | five separate searches against the same `encounter=` list (external lab by code system, in-house by code system, nursing by tag, radiology by tag, procedures by `status=completed` then filtered by tag) |                                                                            | One search, partitioned client-side by code system / tag.                                   |
| MedicationAdministration                                                                                                  | two searches against the same `context=` list (in-house tag, immunization tag)                                                                                                                            |                                                                            | One search with `_tag=a,b`, partitioned by tag.                                             |

Rough call budget per tick today: about 21-24 backend FHIR/API calls behind 8 browser round trips, with the order
searches carrying large `_include` graphs (Coverage, Observations, Slots, Schedules) that are discarded on arrival.

## 2. Target design

### 2.1 Contract

Extend `get-appointments` rather than add a zambda. Its only runtime caller today is the tracking board page
(`getAppointments` in `apps/ehr/src/api/api.ts`). The shared `ui-components` client's `getAppointments` resolves to
`telemed-get-appointments`, no zambda calls it, and the remaining references are its own tests, a permissions script
that lists it, and comments. A second zambda would add an IaC entry, a permissions-script entry and a deploy surface
without protecting any caller.

End state: the response always carries the two grouped maps, and the request needs no new parameters.

```ts
// packages/utils/lib/types/api/get-appointments.types.ts (end state, after Phase 3)
export interface GetAppointmentsZambdaInput {
  // unchanged: searchDateFrom, searchDateTo, timezone, locationIds, providerIds,
  // serviceCategories, visitType, supervisorApprovalEnabled
}

export interface GetAppointmentsZambdaOutput {
  // ...existing buckets
  orders: OrdersForTrackingBoardTable; // keyed by appointmentId / encounterId, what AppointmentTable takes
  vitals: GetVitalsForListOfEncountersResponseData; // abnormal entries only (alertCriticality set)
}
```

Transitional shape, Phases 1 and 2 only: the request carries an opt-in `include?: { orders?: boolean; vitals?: boolean }`
and the two maps are optional. With the flag absent the response is today's, byte for byte, which keeps the first
backend PR observably inert while the frontend still consumes the old shape. Phase 3 deletes the flag and makes the
maps required.

`OrdersForTrackingBoardTable` and the per-type DTOs already exist in `utils/lib/types/data/orders/types.ts`, so the
table, row, and tooltip components need no prop changes.

### 2.2 Server-side flow

Step A: appointments (existing logic, restructured in place)

- Split the body of `get-appointments/index.ts` into a `fetchAppointmentBuckets(oystehr, params)` step that returns
  the four buckets plus the internal maps the next phase needs (`apptRefToEncounterMap`,
  `practitionerIdToResourceMap`, `locationIdToResourceMap`, the timezone map) and a handler that runs Steps B and C
  only when `include` asks for them, until Phase 3 makes them unconditional.
- With `include` absent the handler returns exactly what it returns today, so the existing unit and integration tests
  keep passing unchanged.

Step B: orders + vitals in one batch Bundle

Select the order-eligible encounters from the buckets. `displayOrdersToolTip` only renders orders for the
completed tab and for in-office rows whose status is not `arrived` / `ready`, so the server should use the same rule
(today the page requests orders for the waiting room too and then never shows them).

Everything Step B needs is keyed on those encounter ids, so it goes out as a single `oystehr.fhir.batch` call: one
`Bundle` of type `batch` whose entries are independent `GET` searches, answered as one response with a nested
`searchset` per entry. The repo already does this for chart data (`get-chart-data`), conversations
(`get-conversation`) and reports, and `getResourcesFromBatchInlineRequests` / `parseBundleIntoResources` in
`utils/lib/fhir/helpers.ts` already unwrap the nested bundles.

| Batch entry                                 | Params                                                                                                                                                                                                                                                                                                                                                                                                                              | What it replaces                                                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ServiceRequest, one entry per 50 encounters | `encounter=Encounter/a,b,...`, `status:not=revoked`, `_count=500`, `_revinclude=Task:based-on`, `_revinclude=DiagnosticReport:based-on`, `_revinclude:iterate=Task:based-on` (result-review tasks hang off the DiagnosticReport, not the order), `_revinclude=Provenance:target`, `_revinclude=DocumentReference:related` (radiology external results only), `_include=ServiceRequest:instantiates-canonical` (in-house test names) | the five ServiceRequest searches of external labs, in-house labs, nursing, radiology and procedures, plus external labs' second Task search |
| MedicationAdministration, per 50 encounters | `context=Encounter/...`, `_tag=in-house-medication-administration-order,immunization`, `_count=500`                                                                                                                                                                                                                                                                                                                                 | in-house medications + immunizations                                                                                                        |
| MedicationRequest, per 50 encounters        | `encounter=Encounter/...`, `_tag=erx-medication`, `_count=500`                                                                                                                                                                                                                                                                                                                                                                      | eRx (unchanged query)                                                                                                                       |
| Observation, per 25 encounters              | as `get-vitals-for-list-of-encounters` today (`_tag` vitals, `status:not`, `_include=Observation:performer`, `_sort=-date`, `_count=1000`); drop its preliminary Encounter `_id` search because Step A already validated the encounters                                                                                                                                                                                             | vitals                                                                                                                                      |

Step A's own follow-up lookups (RelatedPerson fallback, DocumentReference cards, Practitioner `_id`, Provenance
verifier signatures, parent Encounters, SMS Communications) depend only on the appointment search too, so they join
the same batch as further entries. Net: the zambda makes two server round trips per tick, the paged appointment
search and one batch, plus a third only when a batch entry reports a `next` page or the batch has to be split for
size (see 2.3).

Why not one round trip? A batch's entries are independent: FHIR gives entry 2 no way to use entry 1's results, and
every Step B search is keyed on encounter ids that exist only after the appointment search returns. The one way
around that is chained search (`ServiceRequest?encounter.appointment.date=...&encounter.appointment.actor=...`),
which would re-express the per-actor and HealthcareService pooling logic of `getAppointmentQueryInput` in five
places, cannot express the status-derived eligibility rule, and moves the join onto the FHIR server. Two hops is the
floor worth taking.

Partition the ServiceRequest results by identity, not by separate queries:

- external lab: `code` in `OYSTEHR_LAB_OI_CODE_SYSTEM`
- in-house lab: `code` in `IN_HOUSE_TEST_CODE_SYSTEM` (needs the ActivityDefinition name; see 2.4)
- nursing: `_tag` `.../order-type-tag|nursing order`
- radiology: `_tag` `ORDER_TYPE_CODE_SYSTEM|radiology`
- procedure: `_tag` code `procedure`, status not `entered-in-error` / `revoked`
- anything else (disposition follow-ups etc.) is dropped

Everything the old searches `_include`d for context (Encounter, Appointment, Slot, Schedule, Patient, Coverage,
Practitioner) is gone: appointmentId, timezone, and practitioner names come from Step A's maps.

Step C: map and group

- Reuse the existing pure mappers rather than re-deriving statuses: `parseLabOrderStatus` / `mapResourcesToLabOrderDTOs`
  (external), `determineOrderStatus` / `parseOrderData` (in-house), `mapResourcesNursingOrderDTOs`, radiology
  `parseResultsToOrder` (export it), `mapMedicalAdministrationToDTO` (export it), `mapMedicationAdministrationToImmunizationOrder`
  (export it), `makePrescribedMedicationDTO`, `makeProceduresDTOFromFhirResources`, and the vitals parsers in
  `chart-data/vitals/get-for-list-of-encounters` (extract `parseResourcesToDTOs` to a shared module).
- Several mappers throw on a missing related resource (`get-medication-orders` throws when a practitioner is missing,
  radiology throws when no ordering provider resolves). Wrap mapping per order in `try/catch`, log with the order id,
  and skip it: one malformed order must not blank the whole board.
- Group into `OrdersForTrackingBoardTable` server-side using the encounter-to-appointment map (the client's
  `groupByAppointmentId` / `groupByEncounterId` move here).
- Filter vitals to abnormal entries with `getAbnormalVitals` before serializing.

### 2.3 Sizing, limits, failure modes

- Batch semantics: in a `batch` Bundle each entry succeeds or fails on its own (`entry.response.status`); a failed
  entry does not fail the bundle, which is exactly the isolation the board wants. Read entries by position, the way
  `parseChartDataBundle` and `get-conversation` do.
- No paging inside a batch: each entry returns one page, so set `_count` generously (the vitals search already uses 1000) and check each nested bundle for a `link[rel=next]`; if any appear, issue one follow-up batch with those URLs.
  `searchAndGetAllPages` stays for the standalone appointment search only. The legacy order searches each return one
  page today: `_count=100` for labs, `20` for radiology (`DEFAULT_RADIOLOGY_ITEMS_PER_PAGE`, because the board never
  passes `itemsPerPage`) and the server default for nursing, medications, eRx and immunizations, so a busy
  multi-location day can already drop order icons silently.
- Size limits are per request and per response, and not fully documented. Oystehr's search docs give a 10 KB URL
  limit; the SDK sidesteps it for standalone searches by POSTing, but a batch entry's `url` is inline, so keep comma
  lists to about 50 references (roughly 3.5 KB). The ad-hoc reporting code measured a comma list of 1249 references
  answering 400 while 100 answered 200. The response cap surfaces as "exceeds the maximum allowed size"
  (`isResponseSizeExceededError`); because a batch response aggregates every entry, split the batch in two (orders,
  vitals) or halve the encounter chunks on that error instead of failing the request.
- Entry count and concurrency: Oystehr runs a batch's same-method entries concurrently, up to 20 at a time. Step B
  is typically 5 to 12 `GET` entries for a single-location day, so the whole batch executes in parallel server-side.
  Keep each batch at or under 20 entries; when very broad filters produce more encounter chunks than that, spread them
  across parallel batches instead of letting the extra entries queue behind the limit.
- Step B runs strictly after Step A because it needs the encounter ids, so the request costs one extra network hop
  over `get-appointments` alone. That is still far below the slowest of today's eight parallel requests plus their
  serialization on the client.
- If a batch entry fails, return the appointments with that order type empty and log to Sentry; the board today
  already tolerates individual order endpoints failing (each hook swallows its error). Consider an
  `errors?: { orders?: string[] }` field so the UI can show a subtle "orders may be incomplete" hint.
- No IaC change: the zambda keeps its name, its `config/oystehr-core/zambdas.json` entry, its `Zambda:Function:*`
  role grants and its line in `scripts/update-permissions-for-users.ts`. Set an explicit `timeout` only if
  measurements say the default is tight once orders and vitals are included.

### 2.4 Details worth deciding up front

- In-house lab names come from the ActivityDefinition referenced by `instantiatesCanonical`. Either keep
  `_include=ServiceRequest:instantiates-canonical` on the combined search (cheap, a handful of definitions) or
  cache them in module scope across warm invocations. Recommendation: include it.
- External lab status needs DiagnosticReports and their review Tasks. The plan folds the second Task search into the
  ServiceRequest entry with `_revinclude:iterate=Task:based-on`; verify with one query that Oystehr iterates over
  revincluded DiagnosticReports. If it does not, run the DiagnosticReport-based Task search as a third hop only when
  reports came back, which for a live board is rare.
- Nursing's `orderingPhysician` and in-house's `orderingPhysicianFullName` are populated today but never rendered on
  the board. Fill them from Step A's practitioner map when the id is present, otherwise empty string. Do not add a
  Practitioner fetch for them.
- Radiology's caller-practitioner lookup (`getMyPractitionerId`) exists only for edit affordances on the radiology
  page; pass `undefined` on the board.
- Vitals `authorName` requires the performer Practitioner; keep the `_include=Observation:performer`, or resolve from
  Step A's map first and only fetch the misses.
- `supervisorApprovalEnabled` flows through unchanged.

## 3. Frontend design

### 3.1 One hook

`apps/ehr/src/hooks/useGetTrackingBoard.ts` (React Query), calling `getAppointments` with
`include: { orders: true, vitals: true }` until Phase 3 removes the flag:

- `queryKey: ['tracking-board', { dateFrom, dateTo, locationIds, providerIds, serviceCategories, visitType, timezone }]`
- `refetchInterval: TRACKING_BOARD_REFRESH_MS` (start at the current 30 000; it is now one request, so shortening
  it is a one-line change), `refetchIntervalInBackground: false` (replaces the hand-rolled `usePageVisibility` gate)
- `enabled`: same predicate as today's `fetchStuff` guard (valid date range, at least one of location / provider /
  service category, client ready, not editing a comment)
- `placeholderData: keepPreviousData` so the table does not flash while a filter change is in flight
- `retry: 1`, error surfaced with the existing snackbar copy (keep the `APPOINTMENT_SEARCH_TOO_BROAD` special case)

React Query's per-key caching replaces the `latestQueryIdRef` stale-response discard, the `loadingState` machine,
the `appointmentsVersion` counter, and the 300 ms debounce. `updateAppointments` becomes
`queryClient.invalidateQueries({ queryKey: ['tracking-board'] })`.

### 3.2 Page and cleanup

- `Appointments.tsx` shrinks to filters + hook + `<AppointmentTabs orders={data.orders} vitals={data.vitals} ... />`.
  Component props on `AppointmentTabs`, `AppointmentTable`, `AppointmentTableRow`, `InfoIconsToolTip`,
  `OrdersIconsToolTip` are unchanged.
- Delete `useGetOrdersForTrackingBoard.tsx`, `useGetProcedures.ts`, and `useGetErxOrders.ts` (the board is their
  only consumer; verify with a grep before removing). Drop the `refreshKey` parameter from `usePatientLabOrders`,
  `useInHouseLabOrders`, `useGetNursingOrders`, `usePatientRadiologyOrders` once nothing passes it.
- `useGetVitalsForEncounters` and `useGetImmunizationOrders(encounterIds)` stay for their other callers
  (progress note, follow-up note, immunization pages).
- Invalidation from other pages: `Procedures.tsx`, `ProceduresNew.tsx`, `ApplyTemplate.tsx`, and the immunization
  mutations invalidate order keys that the board will no longer read. The 30 s poll covers the round trip back to the
  board; optionally add the `['tracking-board']` key to those invalidations so the board is fresh the instant the user
  returns.
- Drive-by: remove the per-row `console.log(appointment, vitals)` in `AppointmentTable.tsx`.

## 4. Work breakdown

Phase 1 (backend PR, additive, no UI change)

1. Restructure `get-appointments/index.ts` into Step A plus an `include`-gated tail, and add `include` to
   `validateRequestParameters` (absent by default). Run the existing `get-appointments` unit and integration tests:
   nothing observable changes yet.
2. Implement the tail first by composition, using the fetchers the legacy zambdas already export
   (`getMedicationOrders`, `getErxOrders`, `getImmunizationOrders`, `getRadiologyOrders`, `getLabResources` with
   `mapResourcesToLabOrderDTOs`, `getInHouseResources` with its mapper, the nursing helpers, the procedure
   ServiceRequest search with `makeProceduresDTOFromFhirResources`, the vitals fetch). Behind the flag this already
   collapses 8 browser requests to 1 and, by construction, returns byte-identical DTOs, which is the parity baseline
   for step 3.
3. Replace the composed tail with the Step B batch from 2.2 and the partition/map/group code.
4. Types in `utils`, unit tests, integration test (below). No config entry.

Phase 2 (frontend PR)

1. `useGetTrackingBoard` hook + `Appointments.tsx` rewrite; delete the board-only hooks; wire `updateAppointments`
   to invalidation.
2. Component test for the hook/page with a mocked zambda client (the `AppointmentTabs.test.tsx` pattern), covering:
   interval gating while hidden, stale-filter results never render, error snackbar copy.
3. Run the in-person E2E suite locally; the specs assert on rendered rows, not zambda names, so no spec edits are
   expected.

Phase 3 (cleanup PR, after Phase 2 has been out for a release)

- Remove the transitional `include` parameter: `get-appointments` always runs Steps B and C, `orders` and `vitals`
  become required in `GetAppointmentsZambdaOutput`, the flag leaves `validateRequestParameters`, the API function and
  the hook, and the no-`include` integration case goes with it.
- Remove the `encounterIds` branches from the seven legacy order zambdas if nothing else calls them, or leave them
  (they are not on the hot path any more).

Phase 4 (optional, low priority: trim FHIR payloads with `_elements`)

Once Phase 3 has settled, the same searches can return less. `get-appointments` already does this for the appointment
search: `APPOINTMENT_SEARCH_ELEMENTS` in `get-appointments/helpers.ts` lists every `Resource.field` the downstream
code reads, the server strips the rest, and the list covers included resource types too. Extending that to the Step B
batch entries shrinks the ServiceRequest, Task, DiagnosticReport, Provenance, MedicationAdministration,
MedicationRequest, Observation and Practitioner payloads, which is where most of the response size (and the
response-cap risk) lives after Phase 3.

- Build one elements list per batch entry from what the mappers actually read. Roughly: for orders,
  `ServiceRequest` id, status, code, category, encounter, meta, extension, authoredOn, note, requester, basedOn,
  supportingInfo, reasonReference and instantiatesCanonical; `Task` id, status, code, basedOn, authoredOn, owner and
  location; `DiagnosticReport` id, status, basedOn, code and extension; `Provenance` id, target, activity, recorded
  and agent; `ActivityDefinition` id, url, name and title. For medications, the `MedicationAdministration` and
  `MedicationRequest` fields the two DTO mappers read (`contained` keeps the whole contained Medication, since
  `_elements` does not reach inside it). For vitals, `Observation` id, meta, code, component, valueQuantity,
  effectiveDateTime, performer, encounter, derivedFrom and interpretation, plus `Practitioner` id and name. Derive the
  final lists by reading the mappers, not from this sketch; the exact set is the work of the phase.
- The risk is the one the existing WARNING comment above `APPOINTMENT_SEARCH_ELEMENTS` already describes: a field the
  mapper reads but the list omits arrives as `undefined` and fails silently. Guard it the way the appointment search is
  guarded: a unit test per entry that projects fixture resources down to the elements list and asserts the DTOs are
  unchanged, so a new field read downstream fails the build instead of the board.
- Record FHIR response bytes per tick before and after. This phase moves bytes, not round trips, so do it only if the
  measured size or latency says it is worth the maintenance of the lists.

## 5. Verification

Unit tests (`packages/zambdas`, offline `--project unit`)

- ServiceRequest partitioning: one bundle containing every type plus a disposition SR yields exactly the expected
  buckets; revoked / entered-in-error procedures excluded.
- Grouping: orders keyed by `appointmentId` for lab/nursing/radiology and `encounterId` for meds/eRx/procedures/immunizations,
  matching what `AppointmentTable.ordersForAppointment` reads.
- Order-eligible encounter selection mirrors `displayOrdersToolTip`.
- Chunking and the response-size fallback.
- Per-order mapping failure is isolated (a throwing mapper drops one order, not the response).

Integration test (extend `packages/zambdas/test/integration/get-appointments.test.ts`)

- Seed a graph with `setupIntegrationTest`, create one nursing order and one in-house medication through the
  existing zambdas, call `get-appointments` with `include: { orders: true, vitals: true }`, assert the appointment
  appears in `inOffice` and both orders appear under the right keys.
- A no-`include` case asserting `orders` and `vitals` are absent, so the legacy response shape stays pinned through
  Phases 1 and 2. Phase 3 deletes it together with the flag.
- Parity: for the same seeded day, call the eight legacy endpoints and deep-compare their DTOs with the new response.
  Keep this while Phase 1 step 3 is in review; drop it in Phase 3.

Manual QA checklist

- Each order icon and pending badge (external lab, in-house lab, nursing, in-house med, radiology internal vs
  external, eRx, procedure, immunization) on in-exam and discharged rows; none on waiting-room rows.
- Abnormal vitals badge appears, and updates within one poll after a new abnormal vital is saved.
- Follow-up visits link orders through `parentAppointmentId`.
- Filter change mid-request never shows the previous filter's rows; hidden tab stops polling; comment editing pauses
  polling.
- `next` flags per tab partition and supervisor-approval rows unchanged.

Targets to record before and after (Network tab, one tick)

| Metric                                      | Before                                                                                        | After                                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Browser requests per tick                   | 8 (+2 on encounter-set change)                                                                | 1                                                                                    |
| Server round trips per tick                 | about 21-24 FHIR/API calls, 7 of them sequenced behind get-appointments on the client         | 2 (appointment search, then one batch), 3 when a next page or a size split is needed |
| Order-search payload                        | Coverage, Slot, Schedule, Patient, Practitioner and Observation-result includes on every tick | none of those; Task, DiagnosticReport, Provenance and ActivityDefinition only        |
| FHIR response bytes per tick                | record during Phase 1                                                                         | record again after Phase 4                                                           |
| Data freshness for vitals and immunizations | on focus / encounter change only                                                              | every tick                                                                           |

## 6. Risks and open questions

- External lab status parity is the riskiest mapping (draft/active + PST task + DR review tasks + ABN state). Reusing
  `parseLabOrderStatus` and keeping the DR-based Task search removes most of the risk; the parity test covers the rest.
- Very broad filters (several locations over the 7-day maximum range) can produce hundreds of eligible encounters.
  Chunking handles correctness; if latency or the response cap becomes a problem, cap orders/vitals to the first N
  encounters per tab and return the remaining rows without them, surfacing "too broad for order icons" in the UI.
- Two Oystehr batch limits are still unverified: the maximum entries per bundle and the response cap. Execution is
  not in question, since same-method entries run concurrently up to 20 at a time. The composition step in Phase 1 is
  the place to measure the two limits before the lean batch lands.
- `get-appointments` now bundles the external-lab helpers (large module). Cold start grows somewhat; warm invocations are
  what the 30 s loop hits.
- Until Phase 3 the `encounterIds` code paths live in two places. That is deliberate: the legacy zambdas still serve the
  chart pages by `encounterId`/`patientId`, and the board no longer depends on them.
