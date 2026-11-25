# Ad-hoc reports: links between datasets — implementation plan

Repository: `local/core`. Status: **implemented in the working copy, 2026-11-25** (plan revision 3; not committed, not yet run on real data — the acceptance checks of section 6 are open). What changed between revisions is in section 10; what the code looks like is in section 11 and in [adhoc-layer-graph.md](adhoc-layer-graph.md), section 2.9. Builds on [adhoc-layer-graph.md](adhoc-layer-graph.md) (layers, foreign layers, fetch helpers).

## 1. Problem

A report reads one dataset. Today another dataset's data can join it only one way: the patients dataset's layers (`patients.*`) on visit rows, by `patientId`. Every other combination is rejected or silently answered from one side:

| Request (from the product discussion) | Needs | Today |
|---|---|---|
| Profit per minute: 40-minute visits vs 15-minute ones | visit duration (Encounters) + insurance paid / allowed (Claims, billing app) | not possible |
| Net collection rate, AI-assisted visits vs not | AI use on the visit (Encounters, `aiType`) + allowed and paid (Claims) | not possible |
| Amount billed to insurance, AI-assisted visits vs not | AI use on the visit (Encounters, `aiType`) + billed (Claims) | not possible |
| Charges or patient payments of AI-assisted visits | AI use on the visit (Encounters, `aiType`) + charges / payments (Visit payments & charges) | not possible, though both are clinical |
| For each visit: CPT codes billed and claim status | visit rows (Encounters / Visit payments) + claim status and codes (Claims) | answered from Claims alone: visits without a claim are silently missing |

The product discussion says "AutoChart used vs not"; the datasets have no AutoChart field, so these requests are answered with the column that exists, `aiType` (section 2). Four of the five need Claims on visit rows. **Goal: a visit dataset can add the columns of the datasets it is linked to, with the join done in code, the same way in every report.**

## 2. What we know about the datasets

| Dataset | One row per | Row key (unique) | Other link fields it carries |
|---|---|---|---|
| Encounters (`encounters-comprehensive`) | encounter | `encounterId` | `patientId`, `appointmentId` |
| Patients (`patients`) | patient seen in the range | `patientId` | — |
| Visit payments & charges (`billing`) | encounter | `encounterId` | `patientId` |
| Claims, billing app (`billing-claims`) | claim | `claimId` | `encounterId` (null for a claim created by hand); `patientId` is the **billing** patient |
| Medication inventory (`medication-inventory`) | stock entry | `entryId` | `appointmentId`, `patientId` (visit-linked entries) |
| Billing rules (`billing-rules`) | rule (no date range) | `ruleId` | — (configuration, nothing to link) |

Facts from the code that the plan relies on:

- **At most one claim per encounter, by convention, not by constraint.** `create-billing-claim-from-encounter` searches by the `claim-encounter-id` identifier and refuses a second claim; corrections update the same claim. The check is search-then-create, so a race can produce two; `findBillingClaimForEncounter` already treats that as possible (it throws). The join must tolerate it (section 5).
- **The claim's `patientId` is the billing copy of the patient**, not the clinical one. A link must never be made by it.
- **The ad-hoc clinical worker already reads billing-app data.** `sub-adhoc-report` creates a billing client (`createBillingClient(m2mToken, secrets)`) and `shared/adhoc-datasets/billing.ts` imports `billing/patient-payments` and `billing/payments` and reads the billing app's PaymentNotices by `claim-encounter-id` (merged in #10129). So the worker joining claims by the same identifier is the existing pattern, not a new crossing of the clinical/billing boundary. The Claims dataset itself is still served to the browser by its own zambda (`adhoc-billing-dataset` → `sub-adhoc-billing-dataset`); that does not change.
- **Access is the same on both sides.** `adhoc-report` and `adhoc-billing-dataset` both require `AD_HOC_REPORT_VIEW_ROLES`, so a user who can run the host report may already read the Claims dataset.
- **Field names collide across datasets, with different meanings.** Encounters and Claims both have `cptCodes`, `icdCodes`, `emCode` (charted vs billed) and `accidentTypes / accidentDate / accidentState`; Visit payments and Claims share `memberId`, `cptLines`, `cptCodes`, `emCode`, `icdCodes`; Patients and Claims share `primaryPlanType`, `secondaryMemberId`.

- **The clinical columns the requests need.** Visit duration is in Encounters: the `timing` layer (`timeWithProviderMinutes`, `totalCycleMinutes`). **An AutoChart flag is not:** the `ai` layer has only `aiType` — ambient scribe and / or patient HPI chatbot, read from the visit's AI summary documents. AutoChart writes chart items from the scribe transcript, so "ambient scribe" is the closest column, but it says a recording was summarised, not that AutoChart was used. **Decision: the links expose the datasets as they are.** Reports split visits by `aiType`; no AutoChart field is derived or approximated here.

Every link in scope is a **lookup**: each host row matches at most one source row. One-to-many relations need aggregation and are out of scope (section 8).

## 3. Design

### 3.1 Links are an explicit list

A new constant in `utils/lib/types/adhoc/datasets/links.ts`:

```ts
interface AdHocDatasetLink {
  host: string;      // dataset whose rows get the columns
  source: string;    // dataset the columns come from
  key: string;       // field of the host row
  sourceKey: string; // field of the source row, unique among the rows that have it
  prefix: string;    // column prefix on the host row: 'claim' -> claimBilled, claimMatched
}

export const DATASET_LINKS: AdHocDatasetLink[] = [
  { host: 'encounters-comprehensive', source: 'billing-claims', key: 'encounterId', sourceKey: 'encounterId', prefix: 'claim' },
  { host: 'billing',                  source: 'billing-claims', key: 'encounterId', sourceKey: 'encounterId', prefix: 'claim' },
  { host: 'encounters-comprehensive', source: 'billing',        key: 'encounterId', sourceKey: 'encounterId', prefix: 'billing' },
];
```

A link exists only when it is listed, so a link is offered exactly when its join is implemented, and a coincidence of field names (`patientId` on a claim) can never create one. Three lines are cheaper to read and review than a derivation rule plus its exceptions.

These three links are the complete set, delivered together. Every **own** layer of the source is offered on the host (`BILLING_LAYERS`, `BILLING_CLAIMS_LAYERS`) — for Claims that is the base columns and all nine layers. The source's foreign layers are not passed on: `BILLING_ALL_LAYERS` contains `patients.*`, which Encounters already has, so building from it would add duplicates like `billing.patients.allergies`.

**The visit is the hub.** After this change (✓ = exists today, **+** = added):

| Host rows ↓ / columns from → | Patients | Visit payments | Claims |
|---|---|---|---|
| Encounters | ✓ `patients.*` | **+** `billing.*` | **+** `billing-claims.*` |
| Visit payments | ✓ `patients.*` | — | **+** `billing-claims.*` |

Encounters can carry everything at once (patient, visit finance and claim columns in one report), so any combination of the four datasets is reachable from it. Visit payments also gets the claim columns because "expected charge vs billed / paid" is a natural pair that infer picks without Encounters. Patients, Claims, Medication inventory and Billing rules are not hosts of any link.

There is no reverse link (Encounters columns on Visit payments rows): both datasets are one row per encounter of the same range, so every such report is the Encounters report with `billing.*`. A second direction would add the 26 encounter layers to the Visit payments catalog and make infer's choice of host ambiguous, for no new capability.

Claims are not a host, and do not need to be: every claim that has a visit is on that visit's row, so a question about claims by a visit attribute ("denials by visit type") is answered from the visit dataset with claim columns; the only claims not reachable that way are the ones created by hand, which have no visit and so no visit attributes. The one difference: such a report selects by visit date, not by the claim's service date.

### 3.2 Link layers: the source's layers, with prefixed columns

For each link the host gets the source's layers as `<sourceId>.<layerId>`, plus `<sourceId>.base` for the source's base columns (the Claims money columns and AR statuses are base columns). The ids keep the `patients.*` convention, so `foldIntoForeignLayers`, the layer checkboxes and `needsLayers` work unchanged.

Column names on the host row:

- every source field is renamed `<prefix><Field>`: `claimBilled`, `claimCptCodes`, `claimMemberId`, `billingExpectedCharge`. A field that already starts with the prefix keeps its name (`claimType`, `claimBalance`, not `claimClaimType`). Nothing is dropped and nothing can overwrite a host column or another link's column;
- every link column is nullable in the host's row schema, whatever it is in the source (`billed` is a number on a claim row, `claimBilled` is `number | null` on a visit row): an unmatched row carries nulls, and the worker validates its output with this schema;
- `<sourceId>.base` leaves out the source base fields the host base already has under the same name (`encounterId`, `patientId`, `patientName`; for Visit payments on Encounters the whole visit header is shared, so `billing.base` is empty and not offered — existing rule for a layer left with no field) and the source's internal fields;
- each link adds `<prefix>Matched: boolean` (`claimMatched`), declared in every layer of the link so it is present, and described to the LLM, whenever any of them is loaded.

The lists that go with the columns are derived the same way: a link column is a **domain field** (its distinct values are shown to the LLM — the claim statuses, AR stage, payer) when its source field is one in the source dataset, and an **internal field** likewise. `ENCOUNTER_DOMAIN_FIELDS` / `ENCOUNTER_INTERNAL_FIELDS` and the Visit payments ones are extended with the derived link columns where they are declared, so the front end, which already passes these constants, needs no edit. Without this the model would not see the claim status values.

`patients.*` keeps its current unprefixed columns and its current code (`foreignLayers`, `fetchForeignPatientColumns`). It is not a join of dataset rows — it computes patient layers for the host's patients, including `visitHistory` from the host's appointments — so re-expressing it would only risk a regression.

Where the layer maps are assembled: in the host's dataset file, next to its `patients.*` layers — `ENCOUNTER_ALL_LAYERS = own + patients.* + billing.* + billing-claims.*`, `BILLING_ALL_LAYERS = own + patients.* + billing-claims.*`. With no reverse link the imports must go one way (`encounters.ts` → `billing.ts` → `billing-claims.ts`). Today they do not: `billing.ts` imports `PAYMENT_VARIANT_VALUES` from `./encounters`, so `encounters.ts` importing `billing.ts` would close a cycle, and a constant computed at module load would be `undefined` in one of the files — a failure at run time, not at compile time. `PAYMENT_VARIANT_VALUES` therefore moves to its own small module (`datasets/payment-variant.ts`) that both files import; that is part of step 1. Everything that reads these constants or `DATASET_META` — the worker's input and output schemas, the front end's `layersForDataset` — picks the link layers up with no change. `DATASET_LINKS` and the function that builds a link's layers live in a new `adhoc/datasets/links.ts`, which imports no dataset.

A unit test asserts that no link column name equals a host column, an own-layer column, a `patients.*` column or another link's column on the same host.

### 3.3 One join function, one place: the clinical worker

A pure function in `utils` (`adhoc/datasets/join.ts`):

```ts
joinRows(host: Row[], source: Row[], link: AdHocDatasetLink, fields: string[]):
  { rows: Row[]; duplicateKeys: number }
```

- Maps source rows by `sourceKey`; a row with an empty key is skipped (a claim created by hand).
- Copies `fields` (prefixed) onto each host row and sets `<prefix>Matched`. An unmatched host row gets `null` in every field. Host rows are never added or dropped.
- A duplicate source key keeps the row with the smallest row key (stable), and is counted; the worker logs the count.

It runs in `sub-adhoc-report`, as one step after the host rows are built (`buildOutputJson`):

```ts
let rows = await fetchHostRows(...);                      // as today
const links = requestedLinks(datasetId, options);         // links with at least one layer requested
const sources = await Promise.all(                        // at once: they share the worker's budget
  links.map((link) => SOURCE_FETCHERS[link.source]({ dateRange, keys: rows.map((r) => r[link.key]), layers: layersOf(link) }))
);
links.forEach((link, i) => (rows = joinRows(rows, sources[i], link, fieldsOf(link)).rows));
```

`SOURCE_FETCHERS` is a two-entry map over functions that exist:

| Source | Fetcher | Scope |
|---|---|---|
| `billing-claims` | `fetchAdHocClaimRows(billingClient, { encounterIds, …layers }, { eraReadClient, deadline })` | the host's encounter ids |
| `billing` | `fetchAdHocBillingRows(oystehr, { dateRange, …layers }, billingClient)` | the host's date range |

The host dataset builders are not touched: the join is outside them.

### 3.4 Fetching the source

- **Claims for visit rows — by the host's encounter ids, not by date.** A claim's service date is not always the visit date, so two date filters would drop pairs at the edges of the range. `fetchAdHocClaimRows` gets an `encounterIds` input used instead of the date range: the claim ids come from an `identifier` search in chunks (`claim-encounter-id|<id>,…`, as `search-billing-patient-ar-claims` and the payments layer already do) instead of the full claim scan; the page hydration and row mapping after that are unchanged. The ids stay inside the worker — they are a function argument, not a zambda input or Task input.
- **Visit payments for encounter rows — by the host's date range.** Both are visits of the same appointment-date range built from the same root search, so the row sets match; a visit missing on one side gets `…Matched: false`.
- **Time budget.** The worker has one budget (`REPORT_BUDGET_MS`, 13 min) for the host and its sources. `fetchAdHocClaimRows` takes the remaining time as `deadline` instead of starting its own 12-minute budget. Over budget is the existing explicit error ("narrow the date range"), never partial data.

### 3.5 Requests, saved reports, generation: no format change

A link layer is requested exactly as `patients.*` is today: a flag in `options` (`billing-claims.base: true`), sent to `adhoc-report` with the host dataset. So:

- **Front end**: nothing changes. The checkboxes, catalog and LLM schema come from `layersForDataset` and the dataset constants; `mergeRows` gets host rows with the same keys.
- **Saved reports** keep `datasetId` (the host) and `criteria.options`; old reports open unchanged.
- **Infer**: `foldIntoForeignLayers` folds a second dataset into the host's link layers by the same `<sourceId>.<layerId>` ids. One change, for a picked dataset with no layers (only its base columns are needed) — today it does not fold at all: when the host offers `<sourceId>.base`, it folds into that ("claim status per visit" → `billing-claims.base`); when the host has a link to it but offers no `.base` (Visit payments on Encounters: the base is the shared visit header), the dataset is simply dropped — the host already has every column it would add.
- **Infer, host not picked**: the fold also tries a host the model did not pick. When no picked dataset can carry the others (Patients + Claims: neither hosts the other), a catalog dataset that offers all of them as link layers is used — Encounters. Without this, a combination that the links can serve would still be rejected as "two datasets".
- **Generation** sees one flat row type with more columns. One prompt line: a row with `claimMatched: false` has no claim — its claim amounts are null, not zero; exclude it from claim rates and averages.

### 3.6 What it costs

- **A report that requests no link layer costs exactly what it costs today.** Link layers are off by default; the link step does nothing when none is requested; no existing layer's fetch changes.
- **Any `billing-claims.*` layer** costs the claim lookup for the host's visits (the identifier search and the claim page hydration, the fixed part of every claim row) plus that layer's own searches. The base columns come with it for free.
- **Any `billing.*` layer on Encounters** costs a second pass of the visit root search, because the Visit payments builder is run as it is, plus that layer's own searches.
- **Always larger, used or not:** the infer catalog and the list of loadable layers in the generation prompt for Encounters and Visit payments (more prompt tokens per call), and the worker bundle, which now includes the claims builder.

## 4. Why this design

1. **The join is code, not LLM output.** Each link is written and tested once and behaves the same in every report.
2. **One mechanism in one place.** One list of links, one join function, one step in one worker. No routing of options by "side", no second fetch flow in the browser, no new zambda input.
3. **It follows the code as it is.** The clinical ad-hoc worker already holds a billing client and already reads billing payments by `claim-encounter-id`; reading the claim by the same identifier adds no new kind of access. Roles are the same on both zambdas.
4. **The host owns the row set.** Joins add columns, never rows, so "for each visit" is every visit, and `claimMatched` says which ones have no claim.
5. **Names cannot collide.** Prefixed columns mean "CPT codes billed" (`claimCptCodes`) and "CPT codes charted" (`cptCodes`) are both available and never confused.
6. **No storage, contract or front-end change.** Flags in `options`, flat rows, the same report code contract.

## 5. Edge cases, handled once

| Case | Handling |
|---|---|
| Visit without a claim (not signed yet, or recent) | claim columns null, `claimMatched: false`; the generation prompt line covers denominators |
| Claim without a visit (created by hand) | no key, not attached; still visible in the Claims dataset |
| Two claims for one visit (race in claim creation) | smallest `claimId` kept, count logged by the worker |
| Same field name on both sides | cannot clash: link columns are prefixed |
| Claim's `patientId` (billing patient) | not offered: same-name base field; no link uses it |
| Follow-up encounters | carry their own `encounterId`; a claim is made from the main visit, so a follow-up row is unmatched |
| Access | one request, one role check (`AD_HOC_REPORT_VIEW_ROLES`). If the Claims dataset's roles ever diverge from the report's, the link step must check the Claims roles too — a unit test pins the two constants together |
| Host + source too slow for one run | the existing budget error; claims are fetched only for the host's visits and without the full scan |

## 6. Implementation

One delivery. The steps are the order of work, not separate releases. **All four steps are done** (section 11); the acceptance checks below are not.

1. **Links and join in `utils`.** `PAYMENT_VARIANT_VALUES` moved to its own module (breaks the `billing.ts` → `encounters.ts` import); `DATASET_LINKS` (all three), link layers with prefixed nullable columns and `…Matched` in the hosts' `*_ALL_LAYERS`, the derived domain / internal field lists, `joinRows`. Unit tests: every case of section 5, the no-collision assertion, the existing layer tests unchanged.
2. **Claims by encounter ids.** `encounterIds` + `deadline` on `fetchAdHocClaimRows`. Unit test on the identifier search and chunking.
3. **The link step in `sub-adhoc-report`** with the two `SOURCE_FETCHERS` and an ERA read client. Fixture tests: an encounter row with claim columns, a visit without a claim, a duplicate claim; a Visit payments row with claim columns; an encounter row with Visit payments columns; an encounter row with both sources at once.
4. **Infer and generation.** Fold a layer-less dataset into `.base`, or drop it when the host offers none, and fold into a host that was not picked (unit tests); the `…Matched` prompt line.

Acceptance, on real data, before merge:

- the five requests of section 1 produce correct reports, and a report saved before the change opens unchanged;
- infer accuracy does not drop with the larger catalog (Encounters: 38 → 53 layers, ~290 → 432 fields). There is no infer eval set in the repository, so one is put together first: the five requests of section 1 in their Slack wording, plus single-dataset requests that work today (they must keep choosing the same dataset and layers). Run it before and after the change;
- a one-year range of Encounters with heavy own layers plus the heaviest claim layers (`remits`, `history`, `insurancePayments`) finishes inside the 13-minute budget. If it does not, section 7 says what changes.

## 7. Risks

- **Catalog size.** Encounters gains the Claims and Visit payments layers in the infer catalog and the generation schema. Checked at acceptance on the eval set (section 6); if accuracy drops, the heavy claim layers are taken off the links (they stay in the Claims dataset) before merge, not after — removing a layer later would break saved reports that use it.
- **One worker, one budget.** A long range with heavy host layers plus heavy claim layers may not fit 13 minutes where two separate runs would. The failure is explicit, never partial data, and the acceptance timing check measures it. If typical ranges do not fit: fetch Claims in the browser through `adhoc-billing-dataset` and join there with the same `joinRows` — the link list, layers and column names stay the same.
- **Visit payments on Encounters builds the root twice.** The source builder repeats the appointment search of the host. Both are light without layers; share the root only if the timing check shows a need.
- **Generation semantics.** The model must not treat "no claim" as zero billed: `claimMatched`, nulls and the prompt line; covered by the acceptance check.
- **Boundary policy.** Decided: the join runs in the worker, on the precedent in section 2. The import of `billing/adhoc/claims` lives in one place, the link step. If the team later decides the ad-hoc worker must stop importing billing modules, the fallback above (browser join for Claims) applies.

## 8. Out of scope

- **One-to-many links** (patient → all visits, visit → all stock entries): need aggregation layers; `visitHistory` stays the only per-patient summary.
- **Two independent tables in one report:** would change the report code contract.
- **Claims as the host with clinical columns:** not needed (section 3.1), and the billing worker would have to run clinical dataset builders.
- **Medication inventory links** (to its visit by `appointmentId`, to the patient by `patientId`): the structure allows both as lookups for visit-linked entries, but no request in the product discussion needs them (it asks for clinical data combined with billing data). The likeliest future one is patient contacts on stock entries (who received a recalled lot); it would be one more `foreignLayers` call like the two that exist.
- **Claims ↔ Billing rules:** a claim row carries no rule id, so there is no key to link by.
- **New dataset fields.** This change links the datasets as they are and adds no field to any of them. An "AutoChart used" field on Encounters is a separate change to that dataset; once it exists it is available with claim columns automatically.
- **Billing rules:** configuration without dates or visit links.

## 9. Rejected options

| Option | Why not |
|---|---|
| Let the LLM write the join (fetch plan + report code, as Report Studio does) | non-deterministic: every report re-implements the join and its edge cases |
| Join Claims in the browser, clinical datasets in the worker (revision 1) | two join sites, option routing by side, a sequential second fetch, and thousands of encounter ids pushed through a zambda into a Task input; kept as the fallback for Claims only |
| Derive links from field names (`rowKey` / `uniqueKeys` found in the host base) | links Claims to Patients by the billing `patientId`, offers every pair at once before its join exists, and needs exceptions; the explicit list is three lines |
| Unprefixed columns, host wins on a name clash (as `patients.*`) | hides the claim's `cptCodes` / `icdCodes` / `emCode` behind the charted ones and lets two sources overwrite each other (`memberId`, `cptLines`) |
| Copy the needed clinical fields into the Claims dataset (duration, AutoChart flag) | each new question needs a new field in billing code; does not generalize |
| Send two datasets to generation as separate tables | changes the report code contract and moves the join into generated code |
| Join Claims by date range on both sides | drops pairs at the range edges (service date ≠ visit date) |

## 10. Changes from revision 1

Found by checking revision 1 against the code:

1. **The reason for the browser join was wrong.** Revision 1 said the clinical worker cannot see billing data and would need to call a user-authenticated billing zambda. The worker already has a billing client and reads billing PaymentNotices by `claim-encounter-id`; it can call `fetchAdHocClaimRows` directly. The join moved to the worker, which removed the `side` field, the option routing and all front-end work.
2. **"Fetch in parallel" and "fetch by the host's keys" contradicted each other,** and the ids would have travelled as a ~400 KB string inside a FHIR Task input delivered to a subscription — an untested size. In the worker the ids are a function argument.
3. **The name-clash rule broke a product example.** "Host keeps its own field, the source field is not offered" would have dropped the claim's `cptCodes`, `icdCodes`, `emCode` on visit rows ("CPT codes billed" answered from charted codes), and did not cover two sources on one host. Replaced by prefixed columns.
4. **The derivation rule produced a wrong link** (Claims → Patients by the billing `patientId`) and exposed pairs whose join comes in a later phase. Replaced by the explicit list.
5. **`patients.*` is not re-expressed through `joinRows`:** it is not a join of dataset rows. Left as is.
6. **Corrections of fact:** Medication inventory has no `patients.*` layers today; the one-claim-per-encounter check is not atomic; `foldIntoForeignLayers` does not fold a dataset picked with zero layers; the workers and row schemas use per-dataset layer constants, not only `DATASET_META`, and deriving cross-links inside `encounters.ts` / `billing.ts` would create an import cycle.
7. **No phases.** The links ship together with every source layer; the timing and infer checks are acceptance criteria. Claims as a host and Medication inventory links are dropped as unnecessary, not postponed.
8. **Review of revision 2 (revision 3).** The reverse link (Encounters columns on Visit payments rows) is removed: it added no capability, a large catalog and an ambiguous host; three links and two source fetchers remain, and with one direction the link layers are built in the dataset files like `patients.*`, so the worker's schemas need no switch to `DATASET_META`. Added what revision 2 missed: link columns must be nullable in the host schema (the worker validates its output), `…Matched` must be declared in the link layers to reach the LLM schema, domain and internal field lists must be derived for link columns (otherwise the model does not see the claim status values), a field that already carries the prefix is not prefixed twice, and the sources are fetched at once. The Visit payments prefix is `billing`, the dataset id.
9. **Second review.** `billing.ts` imports `PAYMENT_VARIANT_VALUES` from `encounters.ts`, so the "one-way imports" claim was wrong until that constant moves out; only the source's own layers are offered on a link; a layer-less dataset with no `.base` on the host is dropped, not folded; the layer is `timing`, not `timings`; the infer eval set does not exist and is part of the work.

## 11. As implemented

| Plan | Code |
|---|---|
| `DATASET_LINKS`, link layers, column naming | `utils/lib/types/adhoc/datasets/links.ts` (`linkLayers`, `linkColumnName`, `linkFieldList`, `requestedLinkColumns`) |
| `joinRows` | `utils/.../datasets/join.ts`; takes the source's row key to pick the kept row on a duplicate |
| `PAYMENT_VARIANT_VALUES` out of `encounters.ts` | `utils/.../datasets/payment-variant.ts` |
| Link layers in the hosts | `ENCOUNTER_BILLING_LINK_LAYERS`, `ENCOUNTER_CLAIM_LINK_LAYERS` in `encounters.ts`; `BILLING_CLAIM_LINK_LAYERS` in `billing.ts`; all in `*_ALL_LAYERS` |
| Domain lists | `ENCOUNTER_DOMAIN_FIELDS`, `BILLING_DOMAIN_FIELDS` = the typed own list (`*_NATIVE_DOMAIN_FIELDS`) + the link columns; now `readonly string[]`. Internal lists unchanged |
| `SOURCE_FETCHERS`, the link step | `LINK_SOURCES` and `applyDatasetLinks` in `zambdas/src/shared/adhoc-datasets/links.ts`; called from `sub-adhoc-report` for the encounters and billing datasets |
| Claims by encounter ids, shared budget | `fetchAdHocClaimRows(…, { encounterIds, deadline })` in `billing/adhoc/claims.ts` (`claimIdsForEncounters` through `fetchScopedResources`); `reportDeadline()` in `shared/adhoc-report.ts` |
| Infer | `foldIntoForeignLayers` in `ehr/infer-adhoc-report-layers/index.ts` |
| Generation | the LINKED RECORDS rule in `shared/adhoc-generate.ts` |

What the hosts got: Encounters — `billing.*` (5 layers, no `.base`) and `billing-claims.*` (`.base` + 9); Visit payments — `billing-claims.*` (`.base` + 9). The front end was not edited.

Review of the code, 2026-11-25:

1. **Fixed: `<prefix>Matched` was repeated in the LLM schema** (once per selected layer of a link, and so in the raw-data grid's columns). `llmFieldsForLayers` now keeps the first field of each name; covered by a test.
2. **Fixed: dead code.** The link layers never carry the source's internal fields, so the internal lists (`ENCOUNTER_INTERNAL_FIELDS`, `BILLING_INTERNAL_FIELDS`) are the datasets' own typed lists again; only the domain lists are extended.
3. **Checked after the fixes:** the `utils` ad-hoc tests (54) and eight ad-hoc test files in `zambdas` (121 tests: links, infer, the encounters / patients / datasets / claims fixtures, generation, the billing worker) pass; `tsc --noEmit` passes for `utils` and `zambdas`.
4. **Open — not verified on real data:** the three acceptance checks of section 6 (the five requests, infer on an eval set that does not exist yet, a one-year run inside the budget), and a deploy of the worker and generation subscriptions.
