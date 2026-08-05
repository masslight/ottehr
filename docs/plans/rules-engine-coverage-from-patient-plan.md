# Plan: "Coverage (from patient)" rule action for the billing rules engine

## Goal

Let a billing rule set the **primary coverage on a claim from the patient's coverages**, the way
rules can already set "Provider (from list)". The rule author picks which of the reference
patient's coverages to use — **Primary**, **Secondary**, or **Workers Comp** — and the engine
copies that coverage onto the claim as its new primary (focal) coverage.

Example rules this enables:

- *If service category equals `workers-comp` → set Coverage (from patient) to Workers Comp.*
- *If payer id equals X → set Coverage (from patient) to Secondary* (flip to the patient's
  secondary plan).
- *If billing type equals Self Pay and tag `bill-insurance` is present → set Coverage (from
  patient) to Primary* (attach insurance to a self-pay claim).

## How the pieces work today (research summary)

**The rule field catalog is the single contract.** `RULE_FIELD_CATALOG` in
`packages/utils/lib/types/data/billing/rules-engine.field-catalog.ts` drives the rule-builder UI
(property pickers, typed value inputs), save-time validation, the engine's readers/writers, and the
generated docs (`docs/billing-rules-engine.md`, rendered by `rules-engine.docs.ts` via
`npm run docs:billing-rules`). Unit tests guard every pairing:

- `packages/utils/lib/types/data/billing/rules-engine.docs.test.ts` — committed docs match the catalog.
- `packages/zambdas/test/unit/billing/rules-engine.test.ts` ("field catalog / claim-model pairing") —
  every catalog id has a reader in `claim-model.ts`, and exactly the settable ids have writers.

**The precedent: "Provider (from list)" (`renderingProvider.ref` / `billingProvider.ref` /
`serviceFacility.ref`).** Its writer, `setClaimResourceRef` in
`packages/zambdas/src/billing/rules-engine/claim-model.ts`, is synchronous, so the engine prefetches
the referenced originals up front (`loadReferenceResources` in
`packages/zambdas/src/subscriptions/task/sub-rules-engine/index.ts`, gated on the
`collectSetResourceRefs` collector). The writer clones the original with `prepareWorkingCopy`
(stamps `BILLING_WORKING_COPY_TAG` + a `SOURCE_IDENTIFIER_SYSTEM` extension pointing at the
original), registers the copy via `registerCreatedCopy` (placeholder uuid, `urn:uuid:` reference,
supersedes a pending copy of the same slot), swaps the model slot so later rules read/edit the new
copy, and `persistModel` POSTs the copy under its urn fullUrl in the same transaction as the claim
PUT — the server resolves the urn references, and each copy gets a create-Provenance for claim
history. The paired reader returns the working copy's source ref so conditions can compare it.

**Which patient coverage is "Primary" / "Secondary" / "Workers Comp" is an Account question.** The
patient's reference coverages live against the *reference* (original) Patient in the billing
workspace. Their slot assignment is held by the patient's Accounts (`packages/zambdas/src/billing/shared.ts`):
`PBILLACCT` priority 1 = primary, priority 2 = secondary; `WCOMPACCT` = workers comp
(`ACCOUNT_PLACEMENT`, `getCoverageInsuranceType`). `findCoverageOfType(oystehr, patientId, type)`
already resolves "the patient's active (non-cancelled) coverage of type X", and
`get-patient-coverages` (used by the claim-detail coverage dialog) reads the same signal. The
`BillingInsuranceType` values and display labels already exist:
`BILLING_INSURANCE_TYPE_OPTIONS` = `primary` (Primary), `secondary` (Secondary), `workersComp`
(Workers Comp) in `packages/utils/lib/types/data/billing/billing.types.ts`.

**The manual flow to mirror.** The claim editor attaches a patient coverage via
`update-billing-claim` (`attachClaimResources`, `fields.coverageId` branch,
`packages/zambdas/src/billing/update-billing-claim/index.ts:251`):

1. working copy of the original Coverage (`prepareWorkingCopy`, source stamped);
2. `copy.beneficiary` and `copy.subscriber` re-pointed at the claim's **working-copy** patient;
3. if the original subscriber is a standalone `RelatedPerson` policy holder, it is copied too
   (`subscriberCopy.patient` re-pointed) and the coverage copy's `subscriber` points at that copy;
4. the claim's `insurance[0]` becomes `{ sequence: 1, focal: true, coverage: <new ref> }`, other
   entries are kept, and `ensureClaimInsurance` re-sequences and drops/re-adds the no-coverage
   stub;
5. `claim.insurer` is re-pointed at the coverage's payor.

**How the engine finds the reference patient.** The claim's working-copy Patient carries a
`SOURCE_IDENTIFIER_SYSTEM` extension referencing the original `Patient/<id>` (stamped by every
claim-creation path; `get-billing-claim-detail` already exposes it as `patientOriginalId`, which
the coverage dialog uses).

## Design

### 1. New settable catalog field (not a new action type)

A `setField` on a new field id, exactly like "Provider (from list)". This reuses the whole
pipeline: the action dropdown, save-time validation (`setFieldValueProblem` validates select
options), serialization, docs generation, and the engine's setField dispatch. No schema changes in
`rules-engine.schemas.ts` and **zero new UI code** — a `select`-typed field with `options` renders
through the existing `TypedValueInput` dropdown in
`apps/billing/src/components/rules/RuleBuilder.tsx`.

Catalog entry (in `rules-engine.field-catalog.ts`, first entry of the `insurance` group so it sits
above Member ID, mirroring how `.ref` leads the provider groups):

```ts
{
  id: 'insurance.coverageFromPatient',
  label: 'Coverage (from patient)',        // renders under the "Primary insurance" group header
  group: 'insurance',
  valueType: 'select',
  operators: ENUM_OPS,
  settable: true,
  requiredOnSet: true,                     // cannot be cleared — removing coverage is out of scope
  options: BILLING_INSURANCE_TYPE_OPTIONS.map(...),  // Primary / Secondary / Workers Comp
  description: '...'                       // see "Docs" below
}
```

Grouped under **Primary insurance**, the picker and docs read "Primary insurance → Coverage (from
patient)", matching the requested "Primary Coverage (from patient)" naming. The value picks *which
patient coverage* to copy; the target is always the claim's **primary (focal, sequence 1) slot**.

### 2. Reader (conditions)

`insurance.coverageFromPatient` reads as **the patient-coverage slot the claim's current primary
coverage was copied from**: resolve the primary coverage working copy's source extension
(`Coverage/<original-id>`), then look it up in the prefetched patient-coverage context (below).
Reads as absent when the claim has no real coverage, the copy has no source stamp (pre-extension
copies), or the source no longer occupies any slot on the reference patient.

This makes conditions meaningful: `equals Workers Comp` ("the claim already uses the patient's WC
coverage"), `is empty` ("the claim's coverage doesn't come from the patient's current coverages"),
etc. It also satisfies the catalog-pairing test's "every field has a reader" invariant.

### 3. Engine prefetch: patient coverage context

Writers are synchronous, so the engine must prefetch — same pattern as `loadReferenceResources`
(gated) and `loadChargeMasters` (gated):

- **New collector** in the field-catalog module, `ruleReferencesPatientCoverage(rule)`: walks the
  rule's conditional tree and returns true when any **condition or setField action** references
  `insurance.coverageFromPatient`. (Conditions matter too, because the reader needs the context.
  `forEachRuleAction` only walks actions; add a small condition walker alongside, reusing the
  traversal shape of `validateRuleFieldReferences`.)
- **New model member** on `RulesEngineClaimModel` (reference data, never persisted — like
  `referenceResources` / `chargeMasters`):

  ```ts
  patientCoverageContext?: {
    // The reference patient's active coverage per slot, with its standalone policy holder when any.
    byType: Partial<Record<BillingInsuranceType, { coverage: Coverage; subscriber?: RelatedPerson }>>;
    // "Coverage/<original id>" -> slot, for the reader.
    typeByCoverageRef: Map<string, BillingInsuranceType>;
  };
  ```

- **New loader** `loadPatientCoverageContext(oystehr, rules, model)` in the engine
  (`sub-rules-engine/index.ts`, wired into `complexValidation` next to the other two prefetches):
  1. Skip unless an enabled rule passes the collector.
  2. Resolve the reference patient id from `model.patient`'s `SOURCE_IDENTIFIER_SYSTEM` extension.
     No working-copy patient or no source stamp → leave the context undefined (a setField then
     fails the rule and holds the claim; a condition reads as absent).
  3. Fetch in parallel, all with `EXCLUDE_WORKING_COPIES_PARAMS`:
     `Coverage?beneficiary=Patient/<id>`, `RelatedPerson?patient=Patient/<id>`, and
     `getPatientAccounts`. Classify each coverage with `getCoverageInsuranceType` against the
     PBILLACCT/WCOMPACCT accounts; **skip `status: 'cancelled'` coverages** (mirror
     `findCoverageOfType` — the engine must never attach a cancelled coverage, even though the
     manual dialog lists it for a human to judge). First active match per slot wins, as in
     `findCoverageOfType`.

### 4. Writer: `setPrimaryCoverageFromPatient`

New synchronous writer in `claim-model.ts` registered as
`'insurance.coverageFromPatient': (m, v) => setPrimaryCoverageFromPatient(m, v)`. Returns `false`
(→ rule fails → claim held, per the engine's no-silent-skip contract) when: the value is empty or
not one of the three slot codes, the context is missing, or the patient has no active coverage in
the requested slot. Otherwise, mirroring `update-billing-claim`'s attach and `setClaimResourceRef`'s
model mechanics:

1. `copy = prepareWorkingCopy<Coverage>(original, original.id)` — tagged + source-stamped
   (`prepareCopy` adds the source extension even though `extension` isn't a copied Coverage prop).
2. Re-point `copy.beneficiary` at `claim.patient.reference` (the working-copy patient; fail if the
   claim has none).
3. Subscriber:
   - original subscriber is the patient (Self) → `copy.subscriber = { reference: claim.patient.reference }`;
   - original subscriber is a `RelatedPerson` → require it in the context (else fail),
     `subscriberCopy = prepareWorkingCopy<RelatedPerson>(subscriber, subscriber.id)`,
     `subscriberCopy.patient = { reference: claim.patient.reference }`,
     `copy.subscriber = { reference: registerCreatedCopy(model, <replaced subscriber copy>, subscriberCopy) }`,
     and push `subscriberCopy` into `model.subscribers`.
4. `coverageRef = registerCreatedCopy(model, previousPrimary, copy)` → `urn:uuid:<placeholder>`;
   swapping twice in one run supersedes the pending copy (and its pending subscriber copy) so
   orphans are never created.
5. Model swap: replace `model.coverages[0]` with the copy (insert at front when the claim had no
   real coverage); **remove the replaced primary's subscriber copy from `model.subscribers`** so
   discarded edits to it aren't persisted (same "later rules read/edit the new copy" semantics as
   the provider swap — pending edits to the swapped-out resource are dropped).
6. Claim wiring, exactly like the manual flow:
   ```ts
   claim.insurance = ensureClaimInsurance([
     { sequence: 1, focal: true, coverage: { reference: coverageRef, display } },
     ...(claim.insurance ?? []).filter((i) => i.sequence !== 1),
   ]);
   claim.insurer = { reference: copy.payor[0].reference, display: payerDisplayFromClass };
   ```
   The no-coverage stub is dropped automatically (self-pay → Insurance Pay); an existing secondary
   entry is preserved as sequence 2. `display` is derived **synchronously** from the coverage's
   `class` slice (`"<class.name> (<class.value>)"`, the same "Name (Payer ID)" shape
   `payerDisplay` builds) when present, omitted otherwise — the sync writer can't call RCM
   (`setPayerId` precedent already omits display).

**Resolver fix that makes later rules work:** `primaryPolicyHolder` in `claim-model.ts` currently
only resolves `RelatedPerson/<id>` subscriber references. After a swap, the primary coverage's
subscriber reference is `urn:uuid:<placeholder>`; extend the resolver to also match
`urn:uuid:<id>` against `model.subscribers` placeholder ids, so `policyHolder.*` reads/writes in
later rules hit the new copy. (Also generalize the `sourceRef` helper's type to accept `Coverage`
for the new reader.)

### 5. Persistence — no changes needed

`persistModel` already POSTs `createdCopyIds` resources under `urn:uuid:` fullUrls with
create-Provenances, in one transaction with the claim PUT; FHIR transaction processing resolves the
coverage copy's urn subscriber reference against the RelatedPerson POST in the same bundle (the
same mechanism the claim PUT and Provenance references already rely on). `findUnwritableChanges`
exempts minted copies. The context's originals are read-only reference data (writers deep-clone via
`prepareWorkingCopy`), so they never appear in `modelResources` and can't trip the
shared-resource guard. The Claim Submission / pre-invoice finalizers are untouched.

### 6. Save-time validation — no changes needed

The value is a select option: `setFieldValueProblem` + `requiredOnSet` already reject empty or
unknown values in the UI and in `save-billing-rules`. There is no resource reference to verify at
save time (`validateReferencedResourcesExist` doesn't apply — the patient's coverage is resolved
per claim at run time, and a missing slot is a run-time hold by design).

### 7. Docs

Field `description` (rendered into `docs/billing-rules-engine.md`), following the `.ref` fields'
voice — roughly:

> Which of the patient's coverages the claim uses as its primary coverage, looked up on the claim
> patient's reference record (Primary, Secondary, or Workers Comp — the slots on the patient's
> billing accounts). Conditions compare against the coverage the claim's current primary coverage
> was copied from; setting it creates a fresh working copy of the chosen coverage (and its policy
> holder) and re-points the claim — later rules read and edit the new copy. If the patient has no
> active coverage of the chosen type, the rule fails and the claim is held. Cannot be cleared —
> setting it requires a value.

Regenerate with `npm run docs:billing-rules` (the utils docs test fails otherwise; the generated
"67 properties, 57 settable" counts update automatically).

## Failure modes (all hold the claim — never a silent skip)

| Situation | Behavior |
| --- | --- |
| Claim has no working-copy patient, or patient copy has no source stamp | context missing → setField fails → Hold |
| Reference patient has no **active** coverage in the requested slot | setField fails → Hold |
| Standalone policy holder referenced by the coverage is missing | setField fails → Hold |
| Empty / unknown slot value (API-created rule) | rejected at save time; belt-and-braces writer check at run time |
| Conditions referencing the field when context can't load | read as absent (`is empty` matches) — consistent with other readers |

## Step-by-step implementation order

1. **utils** — catalog entry + `ruleReferencesPatientCoverage` collector (+ export), reusing
   `BILLING_INSURANCE_TYPE_OPTIONS`; regenerate docs.
2. **zambdas / claim-model** — `patientCoverageContext` on the model type; reader; writer;
   `primaryPolicyHolder` urn resolution; `sourceRef` accepts Coverage.
3. **zambdas / engine** — `loadPatientCoverageContext` + wiring into `complexValidation`
   (parallel with the existing two prefetches; extend the load log line).
4. **Tests** (below), then `npm run lint` and the affected vitest projects.
5. Nothing to do in `apps/billing` (select input and pickers are catalog-driven) — verify by
   loading the Rules page and building a rule end-to-end locally.

## Test plan

Follow the existing structure and harnesses (`makeModel`/`makeOystehrMock`):

**`packages/zambdas/test/unit/billing/rules-engine.test.ts`** — new describe
"primary coverage from patient swap", modeled on "provider/facility reference swap":
- reader maps the primary coverage's source ref to its slot; absent without context, source stamp,
  or any real coverage;
- writer (Self subscriber): fresh working copy minted (`createdCopyIds`), `coverages[0]` replaced,
  `beneficiary`/`subscriber` re-pointed at the working-copy patient, `insurance[0]` focal with the
  urn reference, `insurer` re-pointed, source extension present on the copy;
- writer (RelatedPerson policy holder): subscriber copy minted and re-pointed; coverage copy's
  subscriber is the subscriber copy's urn; a later `policyHolder.firstName` write lands on the new
  copy (urn resolver);
- self-pay claim: stub dropped, `billingType` reads Insurance Pay afterwards;
- existing secondary insurance entry preserved as sequence 2;
- double swap in one run supersedes the pending coverage **and** subscriber copies;
- failures return false → `executeRule` reports the error → Hold: no context, empty value, unknown
  value, slot not populated, cancelled-only slot, missing policy holder.
- catalog-pairing test passes untouched (new id gains reader + writer).

**`packages/zambdas/test/unit/billing/sub-rules-engine.test.ts`**:
- prefetch gating: context loaded only when an enabled rule references the field (once for a
  condition-only rule, once for an action rule; skipped when the rule is disabled / absent) —
  mirror the charge-master gating tests;
- context classification: PBILLACCT priority 1/2 and WCOMPACCT map to slots; cancelled and
  working-copy coverages excluded;
- end-to-end `performEffect`: rule sets the field → transaction contains Coverage POST (+
  RelatedPerson POST) under urn fullUrls with create-Provenances + claim PUT carrying the urn
  reference → claim submitted; missing slot → Hold persisted, task failed.

**`packages/utils`** — regenerate docs so `rules-engine.docs.test.ts` passes; existing
`validateRuleFieldReferences`/`setFieldValueProblem` tests cover the select semantics generically
(add a case asserting the new field rejects an empty set value via `requiredOnSet` if coverage
seems thin).

**Manual verification** — `npm run apps:start:no-apply`; in the billing app build a
Claim Submission rule "All claims → Set Coverage (from patient) = Workers Comp", run rules from a
claim detail page for a patient with a WC coverage, confirm the claim's insurance card shows the WC
payer, the history shows the engine-attributed coverage creation, and a patient *without* a WC
coverage gets held.

## Out of scope / follow-ups

- **Secondary Coverage (from patient)** (`secondaryInsurance.coverageFromPatient`): same context
  and copy mechanics, writer targets sequence 2 / non-focal. Straightforward follow-up once this
  lands.
- **Remove coverage / make self-pay** rule action (the editor's `removeCoverage`): different
  operation, not part of this field.
- **Copy-churn optimization**: like the provider swap, every set mints a fresh working copy, so
  re-running the engine repeatedly re-copies (prior copies are orphaned, as in the manual editor
  flow). If churn becomes a concern, a follow-up could no-op when the current primary's source
  already equals the requested slot's coverage — decide then; parity with providers wins for now.
- **Duplicate-coverage guard**: a rule could set the primary to the same patient coverage the
  claim's secondary was copied from. The manual editor permits the same; rules authors own the
  semantics. A follow-up condition ("secondary coverage source") would let rules detect it.
