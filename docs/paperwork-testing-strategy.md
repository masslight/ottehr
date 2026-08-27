# Paperwork Testing Strategy: From Per-Instance E2E to Factory Certification

**Status:** Proposal
**Scope:** Intake paperwork (questionnaire rendering, conditional logic, validation, harvest) across `ottehr` core, `hosted-ottehr-builds`, and per-customer config overlays in `ottehr-secrets`.

---

## 1. Executive summary

Today we prove each customer's paperwork works by running the full intake e2e suite against every hosted instance, nightly. That is 10 instances × (build + terraform deploy + browser suite), multi-hour wall clock, browser/SMS/Stripe flakiness multiplied by 10, and linear cost growth with every new customer.

This document proposes testing paperwork **like a factory**: certify every *part* that can appear in a questionnaire (input components, conditional-logic mechanisms, validation rules, harvest strategies), certify the *assembly line* (config → FHIR Questionnaire → rendered pages → validated answers → harvested FHIR resources), and then run a fast, headless **instance certification** over each customer's actual configuration instead of a browser suite. A thin e2e canary remains on the reference instance (plus one bellwether) to cover the seams that genuinely need a real browser and real backend.

The research behind this plan found the architecture is unusually well suited to it:

1. **One shared logic engine.** `evalEnableWhen`, `evalRequired`, `evalFilterWhen`, `evalItemText`, `makeValidationSchema`, `recursiveGroupTransform`, `filterDisabledPages` in `packages/utils/lib/helpers/paperwork/validation.ts` are pure, synchronous, dependency-free functions — and they are the *single* implementation used by the intake UI, the zambda submit validation, the harvest filter, the PDF generator, and even today's e2e helpers. Testing them once tests every consumer.
2. **One questionnaire per service mode.** Instances don't get bespoke code paths. Every customer variation is expressed as data: config overlays (`packages/utils/lib/ottehr-config/`), `enableWhen` conditions keyed on hidden logical items (`appointment-service-category`, `reason-for-visit`), and ~22 custom extensions. The "parts catalog" is finite and enumerable.
3. **The jsdom harness already exists in production code.** The EHR questionnaire-preview feature drives the full `PagedQuestionnaire` renderer from a bare `Questionnaire` object with a stubbed context (`apps/ehr/src/features/visits/telemed/components/admin/questionnaires/questionnaire-utils.ts` — `stubPaperworkResponseForPreview` / `stubPaperworkContext`). A certification test can reuse that recipe verbatim.
4. **The synthetic patient already exists.** `generatePaperworkAnswers` (`packages/zambdas/test/helpers/paperwork-answers.ts`) walks *any* questionnaire, resolves enable/require/filter conditions with the same engine the server uses, and emits a valid answer set to a fixpoint. It's the seed of a config-agnostic certification walker.
5. **Today's per-customer e2e is worth less than it appears.** The suite deploys *its own copy* of the questionnaire generated from the overlaid TS config, and verifies page flow against *its own in-process evaluation of the same `eval*` functions the app runs*. It cannot detect drift between a customer's config and what is actually deployed in their FHIR project, and a bug in the shared logic engine passes silently on both sides of the assertion. A headless certification that reads the same config loses little — and the proposed live-parity check adds coverage that does not exist today.

**End state:** paperwork parts and assembly are certified on every `ottehr` PR in minutes; every customer instance is certified headlessly in ~5–8 minutes (parallelizable ×10, and cheap enough to also run on every `ottehr-secrets` config PR — shifting instance validation left from "next nightly" to "pre-merge"); nightly full e2e runs only on `ottehr` + one bellwether; per-customer browser e2e remains available on demand for debugging but is no longer the correctness gate.

---

## 2. How the factory actually works (research findings)

### 2.1 The assembly line

```
ottehr-config TS modules (per-customer overlay from ottehr-secrets)
        │  createQuestionnaireFromConfig()          packages/utils/lib/config-helpers/shared-questionnaire.ts
        ▼
FHIR Questionnaire (enableWhen + ~22 custom extensions)
        │  archived → config/oystehr/*-intake-questionnaire-archive.json → deployed by Terraform
        │  selected by SERVICE MODE only: in-person | virtual     packages/zambdas/src/patient/appointment/helpers.ts
        ▼
get-paperwork zambda: mapQuestionnaireAndValueSetsToItemsList() / structureExtension()
        │  (extensions flattened into typed props; ValueSets resolved; runs server-side)
        ▼
IntakeQuestionnaireItem[]  →  PagedQuestionnaire renderer          packages/ui-components/lib/components/paperwork/
        │  dispatch: getInputTypeForItem() → FormInputField/FormDisplayField switch
        │  page = top-level group; navigation skips pages whose evalEnableWhen() is false
        │  per-page react-hook-form + yup schema from makeValidationSchema()
        ▼
patch-paperwork (per page; no yup — permissive progressive save) → per-page harvest Task
submit-paperwork (whole-questionnaire yup validation; filterDisabledPages)
        ▼
Harvest: pageHarvestStrategy (packages/config-types/config/intake-paperwork.ts) →
        7 strategy handlers → packages/zambdas/src/ehr/shared/harvest/index.ts (4,500 lines)
        → Patient / Coverage / Account / RelatedPerson / Consent / DocumentReference / …
```

Service **category** (`urgent-care`, `occupational-medicine`, `workers-comp`) never selects a different questionnaire. It is prepopulated into a hidden logical item (`appointment-service-category`) at appointment creation, and every category-specific behavior is an `enableWhen` or `answerDisplayFilter` against that item. The "auto accident" rule is the same mechanism: `attorney-mva-page` carries `enableWhen: contact-information-page.reason-for-visit = 'Auto accident'` (`packages/utils/lib/ottehr-config/intake-paperwork/index.ts:1862`).

### 2.2 The parts catalog

These are the finite sets a certification approach must cover. (Full inventories with file paths are in Appendix A.)

| Catalog | Size | Where |
|---|---|---|
| Input component types (`FormItemType` reachable via `getInputTypeForItem`) | ~17 live (+7 dead enum members) | `packages/ui-components/lib/components/paperwork/utils.ts:5` |
| Conditional mechanisms | `enableWhen`/`enableBehavior`, `$status` pseudo-question, `requireWhen`, `filterWhen`, `textWhen`, `complexValidation`, `disabledDisplay`, `fill-from-when-disabled`, `answerDisplayFilters`, `answer-enable-when`, `answer-label-when` | `packages/utils/lib/helpers/paperwork/validation.ts`, `paperwork.ts` |
| Custom extensions total | ~22 parsed by `structureExtension()` | `packages/utils/lib/fhir/constants.ts:797` registry |
| Page-level triggers in the reference config | 8 conditional pages per service mode | Appendix A.3 |
| Harvest strategies | 7 (`master-record`, `pharmacy`, `account-coverage`, `payment-variant`, `documents`, `consent`, `erx-contact`) | `packages/config-types/config/intake-paperwork.ts:68` |
| Prepopulation mappers | 10 domains gated by linkId allow-lists | `packages/utils/lib/helpers/paperwork/prePopulation.ts` |
| Per-customer variance axes | service categories, `hiddenFormSections`, telemed on/off, homepage options, consent forms, value sets, feature flags, branding | overlay via `hosted-ottehr-builds/config/secrets-mapping.ts` |

An important nuance for harvest: the extraction functions are **linkId-literal** (`'policy-holder-first-name'`, `'responsible-party-page'`, …). The canonical linkIds *are* part of the parts catalog. Customers compose and conditionally arrange canonical parts; they don't rename them. That makes "instance uses only certified parts" a checkable property — and it makes one failure mode checkable that is silent today: **a page whose linkId is not in `pageHarvestStrategy` never harvests, with no error** (`patch-paperwork/index.ts:121` just skips task creation; the risk is even called out in a comment in `packages/zambdas/test/sub-harvest-paperwork-page.test.ts:195`).

### 2.3 Current coverage by layer

| Layer | State |
|---|---|
| Logic engine (`packages/utils`) | **Good.** `paperwork-engine.test.ts` (2,718 lines) covers `evalEnableWhen` operators, `$status`, `requireWhen`, `filterWhen`, `textWhen`, `filterDisabledPages`, `structureExtension`. Gaps: `makeValidationSchema` per-item-type schemas (only 3 tests, all for `onlyValidateProvidedFields`), the frontend-only hooks (autofill, answer display filters), and the known sharp edges in Appendix B. |
| Renderer (`packages/ui-components`) | **Zero tests.** No `test` script in the package at all, so nothing there runs under turbo. `getInputTypeForItem` — the entire dispatch contract — is untested. The only renderer-adjacent test in the repo is `apps/intake/tests/component/FileInput.test.tsx`. |
| Config → Questionnaire generator | Partial: `shared-questionnaire.test.ts` (reason-for-visit build, display-filter round-trip), `questionnaire-generation.test.ts` golden files. |
| Paperwork zambdas | Basic-validation unit tests + 1 happy-path integration test each. `complexSubmitValidation`'s failure mapping (the entire user-facing validation-error surface) is untested; `get-standalone-paperwork` has zero tests; ~1,050 lines of legacy paperwork tests are `describe.skip` dead weight. |
| Harvest | **Strong where it exists** (coverage/account/guarantor matrix in `harvest-module.test.ts`, 4,130 lines; master-record in `harvest.test.ts`). Gaps: `createConsentResources` + `createDocumentResources` are mocked in tests and never actually exercised; 4 of 7 strategies are dispatch-only; the integration test builds its `HarvestContext` with `questionnaire: undefined`, so enableWhen filtering never runs end-to-end. |
| Intake e2e | ~18 generated tests; oracle partly self-referential (§1.5); irreplaceable surface is narrow: SMS auth, Stripe iframe, file-upload round-trip, PDF downloads, per-page server round-trip, timezone-sensitive slot rendering. Operational hazards: 10 `waitForTimeout` sleeps and several soft assertions that log instead of failing. |
| Nightly (`hosted-ottehr-builds`) | 10 customers (11 profiles; `xpress` excluded), full deploy + unit/integration + intake e2e + EHR e2e per customer, `max-parallel: 4`, multi-hour; AI triage pipeline for failures; no Slack reporting; no retry above Playwright's `retries: 2`. |

---

## 3. The strategy: certify parts → certify assembly → certify instances

Six tiers. Tiers 1–4 live in `ottehr` core and run on every PR (they're all vitest, no browser, no network — minutes). Tier 5 runs per customer in `hosted-ottehr-builds` (and on `ottehr-secrets` PRs). Tier 6 is the thin e2e canary.

### Tier 1 — Part certification (core, every PR)

#### 1a. Input-component contract suite (jsdom)

One table-driven suite that certifies every reachable `FormItemType` through the **real dispatch path** (item JSON → `getInputTypeForItem` → `NestedInput`/`FormInputField`/`FormDisplayField`), not through hand-picked component imports. For each type:

- renders with label, helper text, and `data-testid`/`id === linkId` (the contract today's e2e locators rely on);
- user interaction produces the correct `QuestionnaireResponseItem` answer shape (`valueString` / `valueBoolean` / `valueDate` / `valueDecimal` / `valueReference` / `valueAttachment`), via the react-hook-form marshalling in `usePaperworkFormHelpers`;
- required-field error renders when the yup schema rejects; error text matches `makeValidationSchema` output;
- `disabledDisplay: hidden` removes it, `protected` renders it read-only;
- input masks/formats (Phone Number, ZIP, SSN, Signature font), `acceptsMultipleAnswers`, dynamic `answerLoadingOptions` (mock react-query), group types (`list-with-form`, `pharmacy-collection`, `credit-card-collection` with Stripe mocked, `gray-contained-widget`).

Plus a **complete dispatch matrix test for `getInputTypeForItem`** over `item.type × dataType × preferredElement` (a pure 35-line function — the single highest value-per-effort test in the whole feature). The matrix doubles as the machine-readable **certified component catalog** that Tier 5 lints against.

Where: add the missing `test` script to `packages/ui-components` (its `vitest.config.ts` already exists) and put the suite in the package that owns the components. If that stalls on config friction, `apps/intake/tests/component/` already imports ui-components paperwork internals successfully and is an acceptable interim home — but the end state should be tests co-located with the renderer, because the EHR (questionnaire preview, patient record) consumes it too.

Harness: extract the `QuestionnairePreview` stubbing recipe into a shared test util — `renderPaperworkPage(questionnaire, { values, helpers })` wrapping `PaperworkProvider` + `createMemoryRouter` (needed by `useBeforeUnload`) + optional `QueryClientProvider`. This same harness powers Tiers 3 and 5.

#### 1b. Conditional-logic engine matrix (node)

Extend `paperwork-engine.test.ts` from "good" to "exhaustive by construction":

- **Operator × value-type × answer-type matrix** over `evalEnableWhenItem`/`evalCondition`: `exists, =, !=, >, <, >=, <=` × boolean/string/choice/open-choice/date × `answerString/Boolean/Integer/Date`, including the "answerInteger on a date question means N years ago" age semantics (with `vi.setSystemTime`).
- `enableBehavior` `any` vs `all` vs default; single-condition behavior; dotted-path vs bare linkId resolution; `$status` pseudo-question (`=`, `!=`, `in`, `exists`) and the fact that `filterDisabledPages` deliberately strips `$status` conditions.
- **Sharp-edge pinning tests** (Appendix B): missing referenced question ⇒ `operator === '!='` evaluates true; unsupported operators *throw* from `evalBoolean`/`evalString`; `requireWhen` keeps only the first condition; malformed `complex-validation` sub-extension throws unguarded in `structureExtension`. Each of these gets a test that pins current behavior *and* a decision: keep (documented) or fix. The missing-question case should additionally become a Tier 5 lint (it's a config authoring error that today silently changes page visibility).
- Consolidation decision for the **three parallel engines**: `evalEnableWhen` (FHIR-shaped, the real one), `evaluateFieldTriggers` (config-shaped, EHR patient record — different `enableBehavior` default!), and the legacy mutating `checkEnable` (`paperwork.ts:549`, still used by old non-questionnaire intake forms). Either test all three or (better) migrate the legacy call sites and delete `checkEnable`.

#### 1c. Validation-schema certification (node)

`makeValidationSchema` accept/reject pairs per item type × dataType: string regexes (email/phone/zip/ssn, emoji rejection), boolean `requiredBooleanValue`, choice `.oneOf(answerOption)`, reference shape, date/DOB (`isoDateRegex`, future-date, `validateAgeOver`), attachment (`url`/`contentType`/`title`), decimal, recursive groups, and `filterWhen`-relaxation inside groups. Then the **server-side failure mapping**: `complexSubmitValidation` → yup errors → `{page: [fields]}` → `QUESTIONNAIRE_RESPONSE_INVALID_ERROR` (currently untested; the 21 scenarios in the skipped legacy `paperwork-validation.test.ts` are the seed corpus — port them, then delete the dead files).

#### 1d. Extension round-trip matrix (node)

For each of the ~22 extensions: TS config → `createQuestionnaireFromConfig()` → FHIR extension → `structureExtension()` → typed prop, asserting the round trip is lossless. This catches generator/parser drift structurally and documents the write-only (`placeholder`, `autocomplete`, `custom-link-id`, `document-type`, `review-text`) and read-only (`information-text`, `validate-age-over`) orphans — each orphan gets an explicit decision (wire up or remove) rather than staying silently asymmetric. The string-DSL answer-option extensions (`answer-enable-when`, `answer-label-when`) need their pure evaluator cores exported from the hooks so they can be tested without a DOM.

### Tier 2 — Rule mechanisms, independent of any page (core, every PR)

This is the direct answer to "the auto-accident rule should be tested so it works in any configuration" and "test service-category conditionals no matter how they're used." Two complementary layers:

**Mechanism tests over synthetic questionnaires.** Small hand-built Questionnaire JSON exercising each *pattern* the configs use, decoupled from real page content:

- page enabled iff `reason-for-visit = X` (the auto-accident pattern), including the prepopulation normalization that strips the "tell us more" suffix so `=` still matches;
- page enabled iff `appointment-service-category =` / `!=` a category (the occ-med / workers-comp pattern);
- compound gating with `enableBehavior: 'all'` (the `card-payment-page` pattern: `!= workers-comp` AND occ-med payment option ≠ employer-pay);
- `$status`-gated pages (the consent-page pattern), nested item gating inside a conditional page (attorney fields behind `has-attorney`), `answerDisplayFilters` narrowing option lists per (category, mode), `requireWhen` (the workers-comp SSN pattern), `fill-from-when-disabled`, and `textWhen` substitution.

Each asserts the full stack a page transition depends on: `evalEnableWhen` + `filterDisabledPages` + skipped-page navigation math + `makeValidationSchema` skipping disabled pages + `prepareQuestionnaireResponseForHarvest` excluding their answers. That last conjunction is the real safety property: **a hidden page must be simultaneously unvalidated, unnavigable, and unharvested.**

**Scenario matrix over the real generated questionnaires.** `IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE()` / `VIRTUAL_...()` are pure synchronous factories — no network. For each combination of (service category × reason-for-visit ∈ {auto accident, other} × payment option × patient-will-be-18 × `$status`), assert the **exact enabled-page set**. Derive the category list from `BOOKING_CONFIG` rather than hardcoding, so when this suite runs against a customer overlay (Tier 5) the expectations adapt exactly the way the e2e scenario generator does today.

### Tier 3 — Assembly certification: the reusable runner (core, every PR)

A **certification runner**: a function (packaged so both core CI and Tier 5 can call it) that takes any `Questionnaire` JSON + a booking/paperwork config and executes:

1. **Structural lint** — every item's (type, dataType, preferredElement, groupType, extension) tuple is in the certified catalog from Tier 1a/1d; every `enableWhen`/`requireWhen`/`filterWhen`/`textWhen`/`answerDisplayFilter` condition references a resolvable linkId of a compatible type with a supported operator (kills the silent missing-question edge); every `answerValueSet` resolves; page linkIds are unique and slug-safe; every page in `pageHarvestStrategy` that the questionnaire contains — and, inverted, every questionnaire page carrying harvestable data types — maps to a strategy or is explicitly annotated display-only.
2. **Headless walk (node)** — `generatePaperworkAnswers` fixpoint walk (extended per Tier 4 with "maximal" and seeded-random modes); assert the walk terminates, visits every reachable page, and the resulting QuestionnaireResponse passes whole-questionnaire `makeValidationSchema`; then run `filterDisabledPages` + `prepareQuestionnaireResponseForHarvest` and dry-run each page's harvest strategy against a synthetic patient graph, asserting the produced FHIR operations are well-formed.
3. **Render sweep (jsdom)** — mount every page in the Tier 1a harness with the walk's answers; assert every non-hidden item renders a control (no item type falls through the dispatch switch to nothing), no React errors/console errors, page submit marshals the expected `QuestionnaireResponseItem`s.
4. **Prepopulation dry-run** — feed synthetic Patient/Appointment/Coverage fixtures through `makePrepopulatedItemsForPatient` for the questionnaire's pages and assert the outputs land on linkIds the questionnaire actually contains.

In core CI, the runner executes against the reference configs (both service modes) on every PR — so a PR that adds an uncertified part, breaks a page render, or orphans a harvest page fails *here*, before any instance sees it.

### Tier 4 — Harvest module: keep and expand (core, every PR)

The existing approach is right; the plan is to close specific gaps, roughly in value order:

1. Real (non-mocked) tests for `createConsentResources` and `createDocumentResources` — the two largest untested blocks (~400 lines), covering attachment dedup (`isNewAttachment`, `sortAttachmentsByCreationTime`) and DocumentReference building.
2. Port the 21 validation-failure scenarios out of the skipped legacy tests into `complexSubmitValidation` coverage, then delete the ~1,050 dead lines.
3. Tests for the 4 dispatch-only strategies (`pharmacy`, `documents`, `consent`, `erx-contact`) and `payment-variant`'s extension patch branches; plus `patch-paperwork`'s `createHarvestTaskIfNeeded` dedup and the `consent-forms-page` status-forcing special case.
4. Any tests at all for `get-standalone-paperwork` and `taskPdfHandler`.
5. Pass a real `Questionnaire` into the integration `HarvestContext` (it's `undefined` today) so enableWhen filtering is exercised end-to-end.
6. Extend `generatePaperworkAnswers` with **maximal** ("answer everything answerable") and **seeded-random** modes, then add a harvest property suite: synthetic QR variations over the reference questionnaires → harvest → invariants (idempotency on re-run; no operations targeting resources outside the appointment graph; coverage/account math consistent with the existing matrix).

### Tier 5 — Instance certification (hosted-ottehr-builds; replaces per-customer e2e)

A new `certify-config` job in `ci-test-services.yml`, one per customer, that runs the Tier 3 runner against the **customer's overlaid config**:

1. Checkout HOB + core + secrets, `copy-config` overlay, `npm ci`, build `utils` — the same setup `e2e-intake` uses minus browsers, minus AWS role, minus `user.json`, minus the terraform-state pull.
2. Generate the instance questionnaires from the overlaid config (extending the existing per-customer `scripts/questionnaire/validate-ci.ts --full` guardrail) and verify archive/version consistency.
3. Run the certification runner: structural lint → headless walk → jsdom render sweep → harvest dry-run, with the Tier 2 scenario matrix parameterized by the instance's actual service categories, `hiddenFormSections`, telemed setting, and value sets.
4. Emit one certification report artifact (per-page pass/fail table, enabled-page matrix, parts inventory used).
5. **(Second step, needs credentials) Live-parity check:** fetch the deployed Questionnaire canonical(s) from the customer's Oystehr FHIR project and deep-diff against the generated artifact. This is *new* coverage — today nothing verifies deployed-vs-source parity, because the e2e deploys its own fresh copy. This variant keeps the `validate-config` AWS-role + TF-state step for credentials but still needs no browser.

Operational details (verified against the current workflows):

- Gate with a `runCertify` input mirroring `runE2e` plumbing; keep the `run (<project>) / <stage>` job naming so the nightly summary table and the triage matrix builder pick up the new stage with zero changes.
- Depend only on `build-and-lint`, **not** on `deploy` — reclaiming the 25-minute deploy serialization per customer (the live-parity step is the exception; it can also simply run against whatever is currently deployed, since it doesn't deploy anything itself).
- `ubuntu-latest` (not 16-core), `timeout-minutes: ~8`. Certification jobs hold no shared-project state, so the nightly `max-parallel: 4` cap doesn't apply to them — fan out all 10.
- Update the triage prompts: config-certification failures usually mean the fix belongs in `ottehr-secrets`, which the triage guardrails correctly forbid pushing to — those failures should route to humans with the certification report, not to the auto-fix path.
- **Also wire the job into `ottehr-secrets` PR CI.** Certification is cheap enough to run on every config change, pre-merge. This is a capability the e2e never had, and it converts the nightly from "detection" to "confirmation."

### Tier 6 — Thin e2e canary (what stays, and why)

Full browser e2e keeps covering the seams that headless tests genuinely cannot:

| Seam | Why it needs e2e |
|---|---|
| SMS auth (ClickSend/Auth0) | Real external service handshake |
| Stripe iframe card entry/save/error | Cross-origin iframe; jsdom can't |
| File upload round-trip (presigned URL → z3 → thumbnail) | Real storage + browser file APIs |
| Per-page patch → server → next-page reactivity | Full HTTP round-trip through deployed zambdas |
| PDF download links | Browser download events |
| Slot rendering across timezones | Real rendering + clock interplay |
| Terraform/deploy health | Only a deployed instance shows it |

Run it nightly on **`ottehr` + one bellwether (`urgikids`, matching what `pr-ci.yml` already exercises)**, not on all 10. These seams are instance-independent code paths — running them ten times nightly buys flake exposure, not coverage. Keep `workflow_dispatch` per-customer e2e for debugging specific instances.

Since the suite stays, fix its own hazards: the 10 `waitForTimeout` sleeps, the soft assertions that log "may be expected" and pass, and the `employer-state` escape hatch that papers over a known product bug inside an assertion.

---

## 4. The certification gate: "no uncertified parts"

The factory model only holds if a *new* part can't ship uncertified. Concretely:

- **Registry invariant tests** (the pattern already exists in `sub-harvest-paperwork-page.test.ts:269`): every `FormItemType` reachable from `getInputTypeForItem` has a row in the Tier 1a contract suite; every extension in `OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS` has a Tier 1d round-trip case and (if behavioral) a Tier 1b/2 mechanism test; every `HarvestStrategy` has a Tier 4 handler test. Adding a component/extension/strategy without its certification test fails core CI.
- **Certified-catalog data file**: the Tier 1a dispatch matrix and Tier 1d extension list are exported as data so the Tier 5 lint consumes the same source of truth. An instance config using an unknown construct fails certification with "uncertified part," pointing at exactly what needs a part test first.
- Delete what the catalog says is dead so the invariant stays clean: the dead duplicate dispatcher at `apps/intake/src/features/paperwork/utils.ts` (deleted in #9109), `PaperworkCapabilityConfig.ts` (369 unreferenced lines), the legacy `checkEnable` once its call sites migrate. One correction from implementation: the 7 `FormItemType` members unreachable from the paperwork dispatcher (`Year`, `File`, `Photos`, `Date Year`, `Date Month`, `Date Day`, `Form list`) are still referenced by the legacy PageForm system (`apps/intake/src/components/PageForm.tsx`, `helpers/form/getFormInput.tsx`), so the catalog marks them legacy-only instead of deleting them — they go when that system goes.

---

## 5. Migration plan

**Phase 0 — Quick wins (days).**
Add the `test` script to `packages/ui-components`; land the `getInputTypeForItem` dispatch matrix test; delete dead code (dead dispatcher, `PaperworkCapabilityConfig`); mark the legacy-only `FormItemType` members in the catalog. None of this waits on the strategy.

**Phase 1 — Part certification (2–3 weeks).**
Tier 1a component contract suite + shared jsdom harness; Tier 1b engine matrix + sharp-edge pins; Tier 1c validation-schema certification (porting the legacy scenarios); Tier 1d extension round-trips; registry invariant tests. Runs on every core PR from the day each suite lands.

**Phase 2 — Assembly runner + harvest expansion (2–3 weeks, parallelizable with Phase 1).**
Tier 2 mechanism + scenario-matrix suites; Tier 3 certification runner as a callable package (`scripts/certify-paperwork` or a vitest project taking a questionnaire path); wire it against the reference configs in core PR CI; Tier 4 harvest gap-closing (items 1–5; item 6 is ongoing).

**Phase 3 — Instance certification, running in parallel with nightly e2e (1–2 weeks to build, then 3–4 weeks of parallel running).**
Add `certify-config` to `ci-test-services.yml` + `runCertify` plumbing + nightly matrix + `ottehr-secrets` PR hook + triage prompt updates. Then run both systems side by side and classify every nightly e2e failure: {caught by certification too | env/deploy issue | browser-seam issue (Tier 6 scope) | flake | genuine certification gap}. The triage pipeline's grouping output is the natural place to do this bookkeeping. Genuine gaps become new part/mechanism tests — that's the system working, not failing.

**Phase 4 — Cutover.**
Exit criteria: (a) registry invariants green with catalogs complete; (b) over the parallel period, zero nightly e2e failures classified "genuine certification gap" that remain unaddressed; (c) live-parity check running for all 10. Then: nightly runs certification for all instances + full e2e for `ottehr` + bellwether only; per-customer `e2e-intake` leaves the nightly matrix (kept behind `workflow_dispatch`). EHR e2e is out of scope here and unchanged.

**Ongoing.** New customer onboarding adds a certification matrix entry (minutes/night), not an e2e suite (30 min/night + flake surface). New paperwork features add a part test + catalog row first, feature second.

### PR decomposition

The tiers decompose into pull requests as a **DAG, not a single stack**: three short chains plus a set of parallel, mostly test-only PRs. Only three places have real "PR B edits what PR A introduced" dependencies — stack there, branch off `develop` everywhere else. Sizes are per-PR review scope; all in `ottehr` unless noted.

| # | PR | Builds on | Character |
|---|---|---|---|
| 1 | ui-components test rig: `test` script + turbo wiring + one seed test | — | tiny, config-only |
| 2 | `getInputTypeForItem` dispatch matrix; mark the 7 legacy-only `FormItemType` members in the catalog (still referenced by the legacy PageForm system); delete the unused intake duplicate dispatcher; start the certified-catalog data module | — | test-heavy |
| 3 | Engine operator × value-type matrix + sharp-edge pins | — | test-only |
| 4 | Tier 2 mechanism suites + enabled-page-set scenario matrix | — | test-only |
| 5 | `makeValidationSchema` per-type accept/reject pairs | — | test-only |
| 6 | Submit-validation failure mapping: port the 21 legacy scenarios, delete the dead files in the same PR | — | test-only |
| 7–9 | Harvest gap-closers: consent/documents; strategy handlers + patch dedup; `get-standalone-paperwork` + PDF handler | — | test-only, mutually independent |
| 10 | Intake e2e hygiene: sleeps → event waits, soft assertions → real ones, `employer-state` exemption out | — | e2e-utils only |
| 11 | Extract `renderPaperworkPage` harness from the EHR preview stubs into a shared test util; refactor the preview to consume it | 1 | small src move |
| 12a–d | Component contract slices: text/choice/date/boolean · groups + pharmacy · attachments + AI suggestions · credit card (Stripe mocked) + medical history | 11 | test-only, parallel with each other |
| 13 | Export the pure evaluator cores from the answer-option DSL hooks | — | small src |
| 14 | Extension round-trip matrix; extend the catalog with the extension axis | 13 | test-only |
| 15 | Move `generatePaperworkAnswers` to a shared package + add maximal/seeded-random modes | — | src-light move |
| 16 | Harvest property suite + real `Questionnaire` in the integration context | 15 | test-only |
| 17 | **Certification runner** (lint + walk + render sweep + prepop dry-run + CLI) wired against reference configs in core CI | 2, 11, 14, 15 | the convergence PR |
| 18 | HOB: `certify-config` job + `runCertify` plumbing + nightly matrix + report artifact | 17 merged to core | `hosted-ottehr-builds` |
| 19 | HOB: triage prompt updates + `pr-ci` wiring | 18 | small |
| 20 | HOB: cutover — per-customer `e2e-intake` out of nightly, certify fans out to all 10 | 18 + parallel-run period | the Phase 4 PR |

The chains: **1 → 11 → 12a–d → 17** (harness → component contracts → runner), **13 → 14 → 17** (hook cores → extension round-trips → runner), and **15 → 16/17** (shared walker → harvest properties / runner) — converging at the runner, then **17 → 18 → 19 → 20** crossing into `hosted-ottehr-builds`. PRs 2–10 can land in any order, in parallel, from day one. Mapped to the phases: Phase 0 ≈ 1–2 (+10 anytime), Phase 1 ≈ 3, 5–6, 11–14, Phase 2 ≈ 4, 7–9, 15–17, Phase 3 ≈ 18–19, Phase 4 = 20.

Status: PRs 1–6 are **merged** ([#9108](https://github.com/masslight/ottehr/pull/9108), [#9109](https://github.com/masslight/ottehr/pull/9109), [#9110](https://github.com/masslight/ottehr/pull/9110), [#9201](https://github.com/masslight/ottehr/pull/9201), [#9202](https://github.com/masslight/ottehr/pull/9202), [#9203](https://github.com/masslight/ottehr/pull/9203)). PRs 7–9 are **open as independent PRs** against `develop` (reviewable in any order): [#9355](https://github.com/masslight/ottehr/pull/9355) consent + document harvest coverage, [#9356](https://github.com/masslight/ottehr/pull/9356) strategy handlers + patch-paperwork task flow, [#9357](https://github.com/masslight/ottehr/pull/9357) get-standalone-paperwork + form PDF handler.

Sequencing constraints that matter:

- **Port before delete (PR 6).** The legacy scenarios are the only record of the validation-failure surface — one PR, ordered commits.
- **The catalog is the contract between chains.** PR 2 creates the data module (component axis), PR 14 extends it (extension axis), PR 17's lint consumes it. Agree on its shape early — it's the one design conversation to have before parallelizing.
- **No publish step gates the HOB side.** `hosted-ottehr-builds` checks out core source at a resolved ref, so PR 18 needs only PR 17 merged to `develop` — no package versioning ceremony.
- **PR 17 is the only balloon risk.** If it grows, split lint → walk → render sweep; each stage is independently useful (the lint alone catches the page-missing-from-`pageHarvestStrategy` class).
- **The `checkEnable` legacy-engine migration stays outside the chains** — it touches live intake form code; schedule it as an independent, riskier PR whenever convenient.

A useful emergent property: after PR 17, every core PR is already certified against the reference configs, so the hosted rollout (18–20) is pure CI plumbing with the test machinery pre-proven.

---

## 6. What we lose and where it lands

| Today's e2e coverage (×10 instances) | New home |
|---|---|
| Conditional page flow per instance | Tier 5 headless walk + Tier 2 scenario matrix (same engine, exact page-set assertions, all instances) |
| Field rendering per instance | Tier 5 jsdom render sweep (every page, every instance) + Tier 1a contracts |
| Validation behavior per instance | Tier 1c + Tier 5 walk (whole-questionnaire schema must accept the synthetic patient) |
| Harvest correctness | Tier 4 unit/integration (deeper than e2e ever checked — the e2e never read back harvested FHIR) |
| Server round-trip, uploads, Stripe, SMS, PDFs, slots | Tier 6 canary on `ottehr` + bellwether |
| Deploy/terraform health per instance | Unchanged — nightly still deploys; certification is additive there |
| Config ↔ deployed-artifact parity | **Gained**, not lost: live-parity check (nothing covers this today) |
| Pre-merge validation of customer config changes | **Gained**: certification on `ottehr-secrets` PRs |
| Real-browser visual regressions | Accepted gap (as today — e2e asserts presence, not appearance); optional later: screenshot tests on the Tier 1a harness |

Honest residual risk: an instance-specific bug that only manifests through the deployed backend + real browser *and* isn't a certified-part failure (e.g., an Oystehr project misconfiguration interacting with one customer's flow). Mitigations: the live-parity check catches the config-drift class; deploy health stays covered per instance; the on-demand e2e dispatch remains one click away; and empirically the parallel-run period (Phase 3) measures exactly how big this residue is before we cut anything.

---

## 7. Side findings worth fixing regardless

Found during research; independent of the strategy decision:

1. `packages/ui-components` has a vitest config but no `test` script — any tests added there silently never run in turbo.
2. Dead code: `apps/intake/tests/utils/config/PaperworkCapabilityConfig.ts` (369 lines, self-referencing only); `apps/intake/src/features/paperwork/utils.ts` (unimported duplicate of the dispatcher); ~1,050 lines of `describe.skip` legacy paperwork tests in zambdas; `questionnaire-validation.test.ts` currently asserts nothing (skipped/commented out).
3. `PagedQuestionnaireFlowHelper` phase-1 validation has a hardcoded `employer-state` exemption papering over a known bug — track the bug, remove the exemption.
4. `appointment-service-mode` is a logical item in the booking and patient-record questionnaires but **not** in intake-paperwork — so reason-for-visit `answerDisplayFilters` conditioned on service mode only take effect on the booking form. Latent config landmine; the Tier 5 lint's "conditions must reference resolvable linkIds" check would have flagged it.
5. enableWhen against a nonexistent question silently evaluates to `operator === '!='` (`validation.ts:693`) — fine as engine behavior, but it should be impossible to *author*: lint it (Tier 5) and pin it (Tier 1b).
6. A questionnaire page absent from `pageHarvestStrategy` silently never harvests (`patch-paperwork/index.ts:121`) — the Tier 5 harvest-mapping lint makes this a hard failure.
7. `test/helpers/README.md` and CLAUDE.md reference `integration-test-setup.ts`; the real file is `integration-test-seed-data-setup.ts`. CLAUDE.md also points intake e2e at `apps/intake/tests/specs/`, which no longer exists.

---

## Appendix A — Parts catalogs (inventories)

### A.1 Input component types (reachable `FormItemType`s)

Dispatch: `getInputTypeForItem` — `packages/ui-components/lib/components/paperwork/utils.ts:5`. Render switches: `FormInputField` (`PagedQuestionnaire.tsx:644`), `FormDisplayField` (`:895`).

| FormItemType | Trigger | Implementation |
|---|---|---|
| Text (incl. Signature styling, masks) | `string`/`text`; `dataType` variants | inline `TextField`, `PagedQuestionnaire.tsx:646` |
| Select / Free Select | `choice` default / `open-choice` | `FreeMultiSelectInput.tsx` |
| Radio | `preferredElement: 'Radio'` | `RadioInput.tsx` |
| Radio List | `preferredElement: 'Radio List'` (+ hardcoded `patient-filling-out-as`) | `RadioListInput.tsx` |
| Checkbox | `boolean` default | inline, `:741` (markdown label) |
| Button / Link | `boolean` + `preferredElement` | inline `:717` / `:857` |
| Date | `date` | `DateInput.tsx` (MUI X + Luxon) |
| Decimal | `decimal` | `DecimalInput.tsx` |
| Attachment (image/PDF; insurance-card & photo-ID AI suggestions) | `attachment` | `FileInput/` + `PaperworkAiSuggestionRow/` |
| Credit Card | `boolean` + `dataType: 'Payment Validation'` | `credit-card/CreditCardVerification.tsx` (Stripe) |
| Medical History (AI interview) | `boolean` + `dataType: 'Medical History'` | `AIInterview.tsx` |
| Group (`list-with-form`, `gray-contained-widget`, `pharmacy-collection`, `credit-card-collection`) | `group` | `group/GroupContainer.tsx`, `PharmacyCollection.tsx` |
| Header 3 / Header 4 / Description / Call Out | `display` variants | `FormDisplayField` |

Legacy-only enum members — still referenced by the legacy PageForm system, unreachable from the paperwork dispatcher, removed when that system goes: `Year`, `File`, `Photos`, `Date Year`, `Date Month`, `Date Day`, `Form list`.

### A.2 Conditional mechanisms & extensions

Engine (all pure, `packages/utils/lib/helpers/paperwork/validation.ts`): `evalEnableWhen` (:783), `evalEnableWhenItem` (:657), `evalStatusCondition` (:745, `$status`), `evalRequired` (:813), `evalItemText` (:826), `evalFilterWhen` (:873), `evalComplexValidationTrigger` (:880), `recursiveGroupTransform` (:952, fixpoint), `buildEnableWhenContext` (:993), `filterDisabledPages` (:1016), `makeValidationSchema` (:337).

Behavioral extensions (parser `structureExtension`, `paperwork.ts:167`; writers in `shared-questionnaire.ts`): `require-when` (first condition only), `filter-when` (OR), `text-when` (first match), `complex-validation` (insurance eligibility), `disabled-display` (hidden/protected), `fill-from-when-disabled` (frontend-only autofill), `answer-display-filter` (AND within filter, first filter wins), `always-filter`, `permissible-value`, `validate-age-over`, `data-type`; answer-option-level string DSLs `answer-enable-when`, `answer-label-when` (hook-parsed, bypass the shared machinery). Presentation: `accepts-multiple-answers`, `group-type`, `hide-control-label` (tri-state), `category-tag`, `preferred-element`, `input-width`, `text-min-rows`, `information-text(-secondary)`, `attachment-text`, `answer-loading-options`.

### A.3 Page-level triggers (reference in-person config, `intake-paperwork/index.ts`)

| Page | Condition |
|---|---|
| `primary-care-physician-page` | test-hook `!=` (effectively always on) |
| `payment-option-page` | category ≠ occupational-medicine |
| `payment-option-occ-med-page` | category = occupational-medicine |
| `occupational-medicine-employer-information-page` | category = occupational-medicine |
| `card-payment-page` | category ≠ workers-comp AND occ-med payment ≠ employer-pay (`enableBehavior: all`) |
| `employer-information-page` | category = workers-comp |
| `attorney-mva-page` | reason-for-visit = Auto accident |
| `consent-forms-page` | `$status` ∉ {completed, amended} |

(Virtual config mirrors all of these.)

### A.4 Harvest strategies

`pageHarvestStrategy` (`packages/config-types/config/intake-paperwork.ts:68`): 15 page linkIds → {`master-record`, `pharmacy`, `account-coverage`, `payment-variant`, `documents`, `consent`, `erx-contact`}; handlers in `packages/zambdas/src/subscriptions/task/sub-harvest-paperwork/page-handlers.ts`; core in `packages/zambdas/src/ehr/shared/harvest/index.ts`; finalization in `subscriptions/questionnaire-response/sub-intake-harvest/`.

## Appendix B — Sharp edges to pin with tests

1. `structureExtension` `complex-validation` parse: `[0].baseConditionDef` unguarded → throws on malformed sub-extension (`paperwork.ts:351`).
2. `evalBoolean`/`evalString` throw on unsupported operators; callers mostly don't catch (harvest filter does).
3. Missing referenced question ⇒ condition result is `operator === '!='` (`validation.ts:693`).
4. `requireWhen` silently keeps only the first condition (`paperwork.ts:176`).
5. `enableBehavior` only emitted for >1 condition by the generator — harmless today (`all` is default), fragile if a future condition-remover drops to 1.
6. `filterWhen` is OR while `enableBehavior: all` is AND — easy to conflate when authoring.
7. Patch path runs **no** yup validation (progressive save is permissive by design; submit is the gate) — document as contract, and keep a test asserting submit *does* gate.
8. `evalDateTime`/`formattedDateStringForYearsAgo` depend on `DateTime.now()` — age-gating tests need fake timers.
