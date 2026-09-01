# Tracking board: consolidate the refresh into one `get-tracking-board` zambda

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

New zambda `get-tracking-board` (`packages/zambdas/src/ehr/get-tracking-board/`). It accepts the same body as
`get-appointments` and returns the appointment buckets plus the fully grouped order and vitals maps the table
already consumes:

```ts
// packages/utils/lib/types/api/get-tracking-board.types.ts
export interface GetTrackingBoardZambdaInput extends GetAppointmentsZambdaInput {
  /** Defaults to everything. Lets a caller skip orders/vitals (and lets us feature-gate cheaply). */
  include?: { orders?: boolean; vitals?: boolean };
}

export interface GetTrackingBoardZambdaOutput extends GetAppointmentsZambdaOutput {
  orders: OrdersForTrackingBoardTable; // already keyed by appointmentId / encounterId, exactly what AppointmentTable takes
  vitals: GetVitalsForListOfEncountersResponseData; // abnormal entries only (alertCriticality set)
}
```

`OrdersForTrackingBoardTable` and the per-type DTOs already exist in `utils/lib/types/data/orders/types.ts`, so the
table, row, and tooltip components need no prop changes.

### 2.2 Server-side flow

Phase A: appointments (existing logic, extracted)

- Move the body of `get-appointments/index.ts` into an exported `getTrackingBoardAppointments(oystehr, params)`
  (for example `get-appointments/core.ts`) that returns the four buckets and the internal maps the next phase needs:
  `apptRefToEncounterMap`, `practitionerIdToResourceMap`, `locationIdToResourceMap`, and the timezone map.
- `get-appointments` becomes a thin wrapper around it, so existing callers and the integration test keep working.

Phase B: orders + vitals, four lean searches, chunked and parallel

Select the order-eligible encounters from the buckets. `displayOrdersToolTip` only renders orders for the
completed tab and for in-office rows whose status is not `arrived` / `ready`, so the server should use the same rule
(today the page requests orders for the waiting room too and then never shows them).

| Search                                                    | Params                                                                                                                                                                                                                                                                       | What it replaces                                                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ServiceRequest, chunks of 50 encounters, all pages        | `encounter=Encounter/a,b,...`, `status:not=revoked`, `_revinclude=Task:based-on`, `_revinclude=DiagnosticReport:based-on`, `_revinclude=Provenance:target`, `_revinclude=DocumentReference:related` (radiology external results only; drop if we accept `ordered` for those) | the five ServiceRequest searches of external labs, in-house labs, nursing, radiology, procedures            |
| Task (only when the SR search returned DiagnosticReports) | `based-on=DiagnosticReport/...`                                                                                                                                                                                                                                              | external labs' `fetchFinalAndPrelimAndCorrectedTasks` (result-review tasks are based on the DR, not the SR) |
| MedicationAdministration, chunks of 50                    | `context=Encounter/...`, `_tag=in-house-medication-administration-order,immunization`                                                                                                                                                                                        | in-house medications + immunizations                                                                        |
| MedicationRequest, chunks of 50                           | `encounter=Encounter/...`, `_tag=erx-medication`                                                                                                                                                                                                                             | eRx (unchanged query)                                                                                       |
| Observation, chunks of 25, all pages                      | as `get-vitals-for-list-of-encounters` today (`_tag` vitals, `status:not`, `_include=Observation:performer`, `_sort=-date`)                                                                                                                                                  | vitals; drop its preliminary Encounter `_id` search because Phase A already validated the encounters        |

Partition the ServiceRequest results by identity, not by separate queries:

- external lab: `code` in `OYSTEHR_LAB_OI_CODE_SYSTEM`
- in-house lab: `code` in `IN_HOUSE_TEST_CODE_SYSTEM` (needs the ActivityDefinition name; see 2.4)
- nursing: `_tag` `.../order-type-tag|nursing order`
- radiology: `_tag` `ORDER_TYPE_CODE_SYSTEM|radiology`
- procedure: `_tag` code `procedure`, status not `entered-in-error` / `revoked`
- anything else (disposition follow-ups etc.) is dropped

Everything the old searches `_include`d for context (Encounter, Appointment, Slot, Schedule, Patient, Coverage,
Practitioner) is gone: appointmentId, timezone, and practitioner names come from Phase A's maps.

Phase C: map and group

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

- Chunk sizes above are starting points. The Oystehr SDK posts search bodies, so URL length is not the constraint;
  response size is. Reuse `isResponseSizeExceededError` from `get-appointments/helpers.ts` and halve the chunk on
  that error instead of failing the request.
- Use `searchAndGetAllPages` for the ServiceRequest and Observation searches. The legacy order searches each return
  one page: `_count=100` for labs, `20` for radiology (`DEFAULT_RADIOLOGY_ITEMS_PER_PAGE`, because the board never
  passes `itemsPerPage`), and the server default for nursing, medications, eRx and immunizations. A busy
  multi-location day can already drop order icons silently; paging fixes that as a side effect.
- Phase B runs strictly after Phase A (it needs the encounter ids), so the request costs one extra network hop over
  `get-appointments` alone. It is still far below the slowest of today's eight parallel requests plus their
  serialization on the client.
- If a Phase B search fails, return the appointments with that order type empty and log to Sentry; the board today
  already tolerates individual order endpoints failing (each hook swallows its error). Consider an
  `errors?: { orders?: string[] }` field so the UI can show a subtle "orders may be incomplete" hint.
- Zambda config: add `GET-TRACKING-BOARD` to `config/oystehr-core/zambdas.json` (`type: http_auth`,
  `src: src/ehr/get-tracking-board/index`, `zip: .dist/zips/get-tracking-board.zip`). `bundle.ts` and the local
  Express server both read that file, so nothing else needs registering. EHR roles grant `Zambda:Function:*`, so no
  `roles.json` change. Set an explicit `timeout` only if measurements say the default is tight.

### 2.4 Details worth deciding up front

- In-house lab names come from the ActivityDefinition referenced by `instantiatesCanonical`. Either keep
  `_include=ServiceRequest:instantiates-canonical` on the combined search (cheap, a handful of definitions) or
  cache them in module scope across warm invocations. Recommendation: include it.
- External lab status needs DiagnosticReports and their review Tasks; the second Task search stays but only runs when
  DiagnosticReports came back, which for a live board is rare.
- Nursing's `orderingPhysician` and in-house's `orderingPhysicianFullName` are populated today but never rendered on
  the board. Fill them from Phase A's practitioner map when the id is present, otherwise empty string. Do not add a
  Practitioner fetch for them.
- Radiology's caller-practitioner lookup (`getMyPractitionerId`) exists only for edit affordances on the radiology
  page; pass `undefined` on the board.
- Vitals `authorName` requires the performer Practitioner; keep the `_include=Observation:performer`, or resolve from
  Phase A's map first and only fetch the misses.
- `supervisorApprovalEnabled` flows through unchanged.

## 3. Frontend design

### 3.1 One hook

`apps/ehr/src/hooks/useGetTrackingBoard.ts` (React Query):

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

PR 1 (backend, additive, no UI change)

1. Extract `getTrackingBoardAppointments` from `get-appointments/index.ts`; keep the zambda as a wrapper. Run the
   existing `get-appointments` unit and integration tests.
2. Add `get-tracking-board` built first by composition: Phase A plus the exported fetchers the legacy zambdas already
   expose (`getMedicationOrders`, `getErxOrders`, `getImmunizationOrders`, `getRadiologyOrders`, `getLabResources`
   - `mapResourcesToLabOrderDTOs`, `getInHouseResources` + mapper, nursing helpers, procedure SR search +
     `makeProceduresDTOFromFhirResources`, vitals fetch). This already collapses 8 browser requests to 1 and, by
     construction, returns byte-identical DTOs, which is the parity baseline for step 3.
3. Replace the composed fetch layer with the four lean searches from 2.2 and the partition/map/group code.
4. Types in `utils`, config entry, unit tests, integration test (below).

PR 2 (frontend)

1. `useGetTrackingBoard` hook + `Appointments.tsx` rewrite; delete the board-only hooks; wire `updateAppointments`
   to invalidation.
2. Component test for the hook/page with a mocked zambda client (the `AppointmentTabs.test.tsx` pattern), covering:
   interval gating while hidden, stale-filter results never render, error snackbar copy.
3. Run the in-person E2E suite locally; the specs assert on rendered rows, not zambda names, so no spec edits are
   expected.

PR 3 (cleanup, after PR 2 has been out for a release)

- Remove the `encounterIds` branches from the seven legacy order zambdas if nothing else calls them, or leave them
  (they are not on the hot path any more). Decide whether `get-appointments` stays as a public endpoint for
  downstream forks; it costs nothing as a wrapper.

## 5. Verification

Unit tests (`packages/zambdas`, offline `--project unit`)

- ServiceRequest partitioning: one bundle containing every type plus a disposition SR yields exactly the expected
  buckets; revoked / entered-in-error procedures excluded.
- Grouping: orders keyed by `appointmentId` for lab/nursing/radiology and `encounterId` for meds/eRx/procedures/immunizations,
  matching what `AppointmentTable.ordersForAppointment` reads.
- Order-eligible encounter selection mirrors `displayOrdersToolTip`.
- Chunking and the response-size fallback.
- Per-order mapping failure is isolated (a throwing mapper drops one order, not the response).

Integration test (`packages/zambdas/test/integration/get-tracking-board.test.ts`)

- Seed a graph with `setupIntegrationTest`, create one nursing order and one in-house medication through the
  existing zambdas, call `get-tracking-board`, assert the appointment appears in `inOffice` and both orders appear
  under the right keys.
- Parity: for the same seeded day, call the eight legacy endpoints and deep-compare their DTOs with the new response.
  Keep this while PR 1 step 3 is in review; drop it in PR 3.

Manual QA checklist

- Each order icon and pending badge (external lab, in-house lab, nursing, in-house med, radiology internal vs
  external, eRx, procedure, immunization) on in-exam and discharged rows; none on waiting-room rows.
- Abnormal vitals badge appears, and updates within one poll after a new abnormal vital is saved.
- Follow-up visits link orders through `parentAppointmentId`.
- Filter change mid-request never shows the previous filter's rows; hidden tab stops polling; comment editing pauses
  polling.
- `next` flags per tab partition and supervisor-approval rows unchanged.

Targets to record before and after (Network tab, one tick)

| Metric                                      | Before                           | After                                                                    |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| Browser requests per tick                   | 8 (+2 on encounter-set change)   | 1                                                                        |
| Backend FHIR/API calls per tick             | about 21-24                      | about 12-16, none carrying Coverage / Slot / Schedule / Patient includes |
| Encounter fetches per tick                  | 7                                | 1                                                                        |
| Data freshness for vitals and immunizations | on focus / encounter change only | every tick                                                               |

## 6. Risks and open questions

- External lab status parity is the riskiest mapping (draft/active + PST task + DR review tasks + ABN state). Reusing
  `parseLabOrderStatus` and keeping the DR-based Task search removes most of the risk; the parity test covers the rest.
- Very broad filters (several locations over the 7-day maximum range) can produce hundreds of eligible encounters.
  Chunking handles correctness; if latency becomes a problem, cap orders/vitals to the first N encounters per tab and
  set `include.orders=false` beyond that, surfacing "too broad for order icons" in the UI.
- The new zambda bundles the external-lab helpers (large module). Cold start grows somewhat; warm invocations are
  what the 30 s loop hits.
- Until PR 3 the `encounterIds` code paths live in two places. That is deliberate: the legacy zambdas still serve the
  chart pages by `encounterId`/`patientId`, and the board no longer depends on them.
