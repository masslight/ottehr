# Easy Charting — branch review and clean-rewrite baseline

**Reviewed:** `dabrams/otr-2811-easy-charting` @ `4c59f1a68`
**Against:** `origin/develop` (merge-base `a012ee1bc`)
**Size:** 166 files, +32,650 / −203. Never opened as a PR.
**Status of this document:** baseline for discussion. Section 3 is written to be argued with.

---

## 1. What the branch builds

A second charting surface for an in-person visit, at `/easy-chart/:encounterId`:
the visit note on the left, an AI assistant chat on the right. The provider
dictates (or types) a narrative; an LLM decomposes it into charting actions; the
client executes them one at a time, asking the provider to disambiguate when a
term matches more than one catalog entry; a second LLM pass then critiques the
finished note and offers one-click corrections.

Five new zambdas — `easy-chart-agent` (one typed command → one intent, Gemini),
`easy-chart-planner` (narrative → ordered intents, Claude), `easy-chart-review`
(written note → suggestions), `easy-chart-eval-judge`, `transcribe-audio` — plus
a 34-kind intent vocabulary in `packages/utils`, ~12.4k lines of new frontend,
and a 7.9k-line offline eval harness in `scripts/easy-chart-eval/`.

Where the volume sits:

| Area | LOC |
|---|---:|
| `apps/ehr/src/features/easy-charting/` | 12,393 |
| `scripts/easy-chart-eval/` | 7,877 |
| `packages/zambdas` easy-chart (src) | 4,035 |
| Tests (unit + component) | 3,178 |
| ICD-10 test corpus fixture (JSON) | 2,582 |

Five files carry a third of it: `useChartAssistant.ts` (2,549),
`intent-logic.ts` (2,335), `AssistantColumn.tsx` (1,322),
`planner-core.ts` (1,146), `NoteSections.tsx` (1,144).

---

## 2. What is genuinely good, and should survive the rewrite

This is not a bad branch. It is a branch that learned a great deal and then had
nowhere to put what it learned. The following are real assets:

1. **The three-surface decomposition.** *agent* (one typed command), *planner*
   (narrative → ordered steps), *review* (post-hoc critique of the written note).
   That is the right factoring of the problem and should be kept as-is.

2. **The capability registry** — `packages/utils/lib/helpers/easy-chart-capabilities.ts`.
   One table derives the three JSON response schemas, the per-surface kind enums,
   and the required-field gate each surface runs before trusting model output. It
   replaced six hand-maintained copies of the action vocabulary. Keep this idea and
   most of the file.

3. **The code invariant** — `packages/zambdas/src/shared/easy-chart/codes.ts`:
   *no code reaches the note unless the canonical source actually returned it.*
   A model's code is a hint; it is exact-looked-up, and on a miss the display text is
   searched and a real result taken. A hallucinated code is corrected or dropped,
   never charted. This is the correct safety model for the whole feature — the
   rewrite's job is to extend it to everything, not just ICD.

4. **The digit-loop guard** (`easy-chart-capabilities.ts`, `EASY_CHART_INTENT_FIELD_SCHEMAS`).
   Numeric fields are declared `string` in the schemas and coerced after parse,
   because under Vertex constrained decoding a JSON number has no closing token and a
   spurious digit run self-reinforces to the token cap. 31% of one planner run died
   this way. Non-obvious, expensive to rediscover, well documented. Port verbatim,
   with its regression test.

5. **Provenance as a product concept** — `sourceText` (the verbatim phrase from the
   dictation that justifies an item) vs `inferred` (the model produced it with no
   source phrase: default-normal exam findings, template defaults, deduced codes).
   Showing the provider *which items nobody actually said* is the single best idea in
   the feature. The rewrite must keep it and fix its plumbing (see F1).

6. **Fail-closed encounter authorization** — `packages/zambdas/src/shared/easy-chart/auth.ts`.
   Correct reasoning: `http_auth` only proves the token is valid for the project, so
   each handler re-reads the encounter *as the caller* and treats 401/403/404 alike so
   the endpoint is not an existence oracle. Keep. (Note it arrived in a late commit —
   the feature ran without it for most of its life.)

7. **The eval harness exists at all**, and its PHI hygiene was thought about
   (opaque `encounterHash` identifiers, no demographics or note text to stdout,
   output directories gitignored). The instinct is right; the placement is wrong (F7).

---

## 3. Fundamental issues

Ranked by how much they should shape the rewrite.

### F1 — AI provenance is browser-tab state. Nothing durable records that the chart was machine-written.

`useAiProvenance.ts:74` holds the entire needs-review model in React state:

```ts
const [aiCharted, setAiCharted] = useState<Map<string, AiChartedMeta>>(new Map());
```

…alongside `noteFieldMeta`, `procedureProv`, `instructionMeta`. No FHIR
`Provenance` resource is written. No extension is stamped on the resources
themselves. Nothing is persisted server-side — a grep for `Provenance` across the
easy-chart zambdas returns only prose in comments.

So: the assistant writes a diagnosis, a medication, an E&M code, and the HPI into a
real clinical chart. The "3 AI items need review" banner exists in exactly one
browser tab. Refresh the page, navigate away, open the encounter as a second
provider, or crash the tab — the flags are gone, the banner reports *"All AI-charted
items reviewed and no consistency warnings — ready to finalize,"* and the note is
indistinguishable from one the provider wrote by hand.

And Review & Sign — the surface where the note is actually attested — never sees
any of it at all.

For an AI charting feature this is the core, not a detail. FHIR has the resource
for exactly this. It should have been the first thing built.

### F2 — Resolution lives in the browser

`intent-logic.ts` is 2,335 lines of clinical string matching shipped in the EHR
bundle: a tokenizer and stemmer, six stopword lists, negation-token sets, exam
descriptor synonym classes, a hand-built anatomy→section map, ambiguity clustering
with a tuned `AMBIGUITY_RATIO = 0.75`, a medication-qualifier "evidence" table, and
an allergen salt-word list.

It exists because the LLM emits free text — `display` plus `searchTerms` — and
somebody has to turn that into a code. The branch made that somebody the client.
`runIntentSearch` (`intent-logic.ts:2100`) loops per search term, awaiting a
terminology or eRx call each time, then ranks the union locally.

Three consequences:

- **Two divergent resolution paths.** The server already resolves and validates ICD
  codes properly in `codes.ts`. The client re-resolves at execution time with
  different logic. Both run. Neither is authoritative.
- **It cannot be evaluated or versioned.** The eval harness scores the *planner*.
  The matcher that decides what actually lands on the chart is downstream of it,
  in a different process, unmeasured.
- **Plan execution is chatty and partially-failing.** A 20-step plan is dozens of
  serial browser round trips — search, rank, maybe a picker, `saveChartData` — with
  no transaction boundary. A failure at step 14 leaves 13 items charted.

### F3 — The visit note was forked instead of extended

Review & Sign renders the note by composing 25 small containers —
`AllergiesContainer`, `AssessmentContainer`, `ExaminationContainer`,
`ChiefComplaintContainer`, … — totalling **1,128 LOC** in
`features/visits/shared/components/review-tab/components/`.

Easy Chart re-implements the same note in **2,811 LOC** (`NoteSections.tsx` 1,144,
`note-ui.tsx` 628, plus a dozen per-section components and `vitals-display.ts`).
Two and a half times the code for the same output.

The blocker was coupling, not rendering: each container calls `useChartData()` from
the appointment store, and the Easy Chart page deliberately does not populate that
store.

The branch's answer is `review-tab/note-sections.ts` — a *manifest* of section ids
plus a parity test. Its own header says it plainly:

> the two renderers share no code and no list — so a section added to the progress
> note simply never appears in Easy Chart, and nothing says so. […] This file is a
> MANIFEST, not a renderer: adding an id here does not render anything. It exists so
> the omission is loud instead of silent.

That is the right diagnosis and the wrong prescription. Making divergence *loud* is
what you do when you cannot make it *impossible*; here you can.

### F4 — Shipped unflagged, and injected into shared pipelines

- **No feature flag.** The repo has a feature-flag system
  (`packages/utils/lib/ottehr-config/feature-flags/`); Easy Charting does not use it.
  The route is added unconditionally in both `App.tsx` route groups, and an "Easy
  Chart" button is added to every row of the tracking board
  (`AppointmentTableRow.tsx:1161`).

- **The planner runs on traffic that has nothing to do with this feature.**
  `precomputeEasyChartPlan` is called from inside `createResourcesFromAiInterview`
  (`shared/ai.ts:701`) — the *shared* ambient-scribe pipeline. Its three callers are
  the provider audio recorder, the telemed recording subscription, and
  `subscriptions/questionnaire-response/ai-interview-summary` — the **patient's
  intake AI interview**. So submitting intake paperwork now fires a full easy-chart
  planner call (a 120s-primary / 170s-backup budget) for a page the patient cannot
  see and the provider may never open. It is wrapped never-to-reject, so the cost and
  latency are invisible rather than absent.

- **A global keybinding was changed for one page.** `CommandPalette.tsx` previously
  ignored Cmd/Ctrl+K while a text input had focus; the branch removes that guard for
  the whole EHR because the easy-chart composer wanted it.

### F5 — `transcribe-audio` has no authorization check

Every other easy-chart zambda got `requireEasyChartCaller` in the late auth commit.
This one did not. It accepts an arbitrary `z3URL` from the request body, mints the
**project M2M token**, presigns a download for that path, and returns a transcript:

```ts
const { z3URL, secrets } = validateRequestParameters(input);
m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
const presignedDownloadUrl = await createPresignedUrl(m2mToken, z3URL, 'download');
```

`http_auth` proves only that the bearer token is valid for the project. Any holder
of one can read and transcribe any audio object in the project's Z3 bucket. This is
the same hole `shared/easy-chart/auth.ts` was written to close, on the one endpoint
that never got the fix. Treat as P0 — it is worth patching on `develop` ahead of the
rewrite rather than waiting for it.

### F6 — A 2,549-line hook is the orchestrator, and it is untested

`useChartAssistant.ts`:

- ~40 closures, **zero** `useMemo`/`useCallback` in the file — every one is
  reallocated on every render and passed as props into `NoteSections` (1,144 LOC,
  unmemoized). Every keystroke in the composer re-renders the whole note.
- `dispatchIntent` spans lines 763–1529 — a ~766-line if-chain over intent kind.
- The conversation state machine is a **32-variant flat union** (`ConvStep` in
  `chart-types.ts`). Each intent family costs three or four new variants
  (`no-match-X`, `choose-X`, `X-ing`, `X-ed`); `AssistantColumn.tsx` is a single
  component with **32** branches over `conv.kind`.
- Five `useRef`s mirror state (`planRef`, `planDispatchedIdxRef`,
  `planAdvancedIdxRef`, `planLastAdvanceConvRef`, `chartDataRef`) to escape stale
  closures — the signature of a state machine implemented in hooks that wants to be
  a reducer.
- 15 direct DOM reads/timeouts (`document.querySelector`, `setTimeout`) drive the
  scroll-and-flash effects.

Test coverage is inverted. The suites are real work — 3,178 lines — but they cover
pure helpers in `intent-logic.ts` and leaf presentational components. Neither
`useChartAssistant`, nor `useAiProvenance`, nor `AssistantColumn` is referenced by
any test. There are **no E2E tests** for the feature.

### F7 — Prompts are ~1,200 lines of accreted string literal, and the evals that justify them are not in CI

`planner-core.ts` `buildPrompt` runs lines 165–785. The agent's is ~370 lines; the
review's ~230. They read as a changelog of individual production failures ("Treating
this case as incremental was a bug — every patient with intake history silently lost
the template/exam/MDM scaffolding"). That knowledge is valuable and there is nowhere
to put it except more prompt.

No prompt versioning, so no way to A/B a change without a deploy, and no way to tell
after the fact which prompt produced a given note. The 7.9k-line eval harness that
would catch a regression lives in `scripts/`, runs by hand, needs production
credentials, and is not wired to CI. And `easy-chart-eval-judge` — an LLM judge for
offline scoring — is registered as a **deployed production zambda** in
`config/oystehr-core/zambdas.json`.

### F8 — Unrelated infrastructure changes ride along

Good changes, wrong branch — each is independently reviewable and independently
valuable:

- `getUserToken` rewritten (the author notes the line it replaces is copy-pasted at
  ~118 sites, inconsistently, some throwing a 500 on a missing header).
- M2M token expiry check in `checkOrCreateM2MClientToken` — a real bug fix for
  long-lived processes.
- `redactZambdaInputForLogging`, applied to `save-chart-data`'s input log.

Also: `EASY_CHART_PLANNER_MODEL`, a feature-named secret, is the primary-model
selector for the *shared* `invokeChatbotStructured`. Its documented default
(`anthropic:claude-sonnet-4-6`) already disagrees with the code
(`anthropic:claude-sonnet-5`) — drift on day one.

---

## 4. Rewrite plan

### 4.1 The six decisions that define the rewrite

Everything below follows from these. These are the parts to argue about first.

| # | Decision | Replaces |
|---|---|---|
| **D1** | **The server resolves; the client renders.** One endpoint returns *chart-ready* operations — codes already looked up and validated, alternatives already ranked. | 2,335 lines of matching in the browser (F2) |
| **D2** | **Provenance is a FHIR fact.** Every AI-written resource gets a `Provenance` with its source phrase, inferred flag, surface, model, and prompt version. Review state lives there too. | A `Map` in React state (F1) |
| **D3** | **One note renderer.** Make the 25 existing review-tab containers data-source-agnostic; Easy Chart composes the same components with an AI-annotation decorator. | A 2,811-line fork plus a parity manifest (F3) |
| **D4** | **Flagged, opt-in, and isolated.** A feature flag gates the route, the button, and the precompute. Nothing in a shared pipeline fires for a disabled feature. | Unconditional wiring into three unrelated entry points (F4) |
| **D5** | **Plan execution is one server transaction.** Approve → one call → chart data and provenance written together, or nothing. | Dozens of serial client round trips with no rollback (F2) |
| **D6** | **Prompts and evals are versioned assets in CI.** Prompts carry a version stamped into provenance; a small synthetic golden set gates every prompt or resolver change. | 1,200 lines of literal and a manual 7.9k-line harness (F7) |

### 4.2 The contract

Today the planner returns intents the client must still figure out:

```ts
{ kind: 'add-diagnosis', display: 'otitis media', searchTerms: ['ear infection'], code?: 'H66.91' }
```

Proposed — the planner returns operations that are already resolved:

```ts
POST /easy-chart/plan   { encounterId, narrative, mode: 'full' | 'incremental' }
→ {
    planId, promptVersion, model,
    operations: [{
      id: 'op-3',
      kind: 'add-diagnosis',
      resolved: { system: 'icd-10', code: 'H66.91', display: 'Acute suppurative otitis media, unspecified ear' },
      alternatives: [ /* top N, already resolved and ranked, server-side */ ],
      confidence: 'high' | 'ambiguous' | 'unresolved',
      provenance: { sourceText?: string, inferred: boolean, surface: 'planner' }
    }]
  }

POST /easy-chart/apply  { planId, accept: ['op-1','op-3'], overrides: { 'op-3': { code: 'H66.92' } } }
→ { chartData, provenanceIds }        // one FHIR transaction
```

Properties this buys:

- **The `codes.ts` invariant generalizes.** Extend "the canonical source must have
  returned it" from ICD to medications, allergens, exam/ROS leaves, lab catalogs,
  procedure quick-picks, radiology, and templates. One resolver module, one rule,
  server-side, testable against fixtures with no browser.
- **Ambiguity becomes a server verdict.** `confidence: 'ambiguous'` with populated
  `alternatives` is what makes the client show a picker. `AMBIGUITY_RATIO`, the
  stemmer, the synonym classes — all move behind the API and become independently
  tunable and independently evaluable.
- **`intent-logic.ts` collapses** to "render a picker from `alternatives`."
  Realistically a few hundred lines.
- **Apply is atomic** — F2's partial-plan failure mode disappears, and provenance is
  written in the same bundle as the data it describes, so the two cannot drift.
- **The eval harness can score the thing that actually reaches the chart**, because
  resolution is now inside the measured boundary.

### 4.3 Provenance model (D2)

One `Provenance` per written resource (or per batch, targeting several):

```
Provenance
  target[]   → the written resource(s)
  recorded   → now
  agent[0]   → { type: author,    who: Practitioner/<provider> }   // the provider owns the note
  agent[1]   → { type: assembler, who: Device/easy-chart }
               ext: surface (agent|planner|review), model, promptVersion,
                    sourceText?, inferred
  ext: reviewState → needs-review | confirmed | edited | rejected
```

Which gives us, for free:

- Needs-review survives refresh, navigation, and a second provider on the same encounter.
- **Review & Sign can see it.** Surfacing "N items on this note were AI-drafted, M
  unconfirmed" at the attestation point is the whole ballgame — see Q1 for whether
  that warns or blocks.
- A real audit trail: which model, which prompt version, what the provider was told
  the source was, and whether they confirmed it.
- Eval gets ground truth on *provider acceptance*, which is a far better signal than
  an LLM judge.

### 4.4 Module layout

```
packages/utils/lib/easy-chart/
  capabilities.ts          # ported from easy-chart-capabilities.ts (asset #2)
  operations.types.ts      # the D2 contract: Operation, Resolved, Provenance payloads
  chart-state.ts           # ported

packages/zambdas/src/shared/easy-chart/
  prompts/
    planner.v1.ts  agent.v1.ts  review.v1.ts   # versioned; version stamped into provenance
  resolve/
    index.ts                 # resolveOperation(intent) → Operation   ← the D1 boundary
    icd.ts                   # ported from codes.ts + icd-search.ts (asset #3)
    medication.ts allergen.ts exam-ros.ts labs.ts procedure.ts radiology.ts template.ts
  provenance.ts              # build + write Provenance (D2)
  apply.ts                   # one FHIR transaction: chart data + provenance (D5)
  planner-core.ts            # narrative → intents (thin; prompt lives in prompts/)

packages/zambdas/src/ehr/
  easy-chart-plan/     easy-chart-apply/     easy-chart-agent/     easy-chart-review/

apps/ehr/src/features/easy-charting/
  EasyChartPage.tsx
  assistant/
    machine.ts               # reducer over operations[] — pure, testable, no React
    useAssistant.ts          # thin React binding over machine.ts
    Thread.tsx  Composer.tsx  Picker.tsx      # ONE picker, driven by alternatives
  note/
    AiAnnotated.tsx          # decorator adding highlight / hover / confirm
    EasyChartNote.tsx        # composes the SHARED review-tab containers (D3)
```

Gone: `intent-logic.ts` (2,335), `NoteSections.tsx` (1,144), `note-ui.tsx` (628), the
per-section duplicates, and most of `useChartAssistant.ts`.

### 4.5 The state machine (F6)

Replace the 32-variant `ConvStep` union and the 32-branch `AssistantColumn` with a
generic machine — one picker parameterized by operation kind, not a variant family
per kind:

```ts
type TurnState =
  | { phase: 'idle' }
  | { phase: 'planning'; narrative: string }
  | { phase: 'reviewing-plan'; plan: Plan }                    // provider approves
  | { phase: 'choosing'; plan: Plan; cursor: number }          // ONE picker
  | { phase: 'applying'; plan: Plan; accepted: OperationId[] }
  | { phase: 'done'; results: ApplyResult }
  | { phase: 'error'; error: string; retryable: boolean };
```

A reducer over `operations[]` with an explicit cursor, in a plain `.ts` file with no
React import — so the plan-execution logic that currently has zero tests becomes
trivially testable, including every skip / refine / ambiguity path.

### 4.6 Phases

**Phase 0 — Carve-outs (land on `develop` first, independently)**

Nothing here depends on the rewrite, and all of it is useful without it.

- P0 fix: authorize `transcribe-audio` (F5). Do not wait for the rewrite.
- `getUserToken` hardening; M2M expiry fix; `redactZambdaInputForLogging` (F8).
- Revert the global `CommandPalette` Cmd+K change; scope it to the page later (F4).
- Add `easyChartingEnabled: false` to `FeatureFlagsConfig` (D4).

**Phase 1 — Contract and provenance** *(the foundation; build before any UI)*

- `operations.types.ts` — the D2 contract.
- `provenance.ts` + `apply.ts`: write chart data and `Provenance` in one transaction.
- Port `capabilities.ts` and the digit-loop guard with its regression test.
- Exit criterion: a hand-written `Operation[]` can be applied and produces both chart
  data and a queryable `Provenance` graph. No LLM involved yet.

**Phase 2 — Server-side resolution** *(the D1 boundary)*

- `resolve/` per catalog; port `codes.ts` / `icd-search.ts` and generalize the
  invariant to every catalog.
- Port the exam/ROS matcher out of `intent-logic.ts` — same heuristics to start;
  the win is the *location*, not a rewrite of the scoring.
- Fixture-driven tests per resolver (the existing 2,582-line ICD corpus ports directly).
- Exit criterion: `narrative → Operation[]` end-to-end on the server, no browser.

**Phase 3 — The note surface** *(D3)*

- Give the 25 review-tab containers an explicit data source: a `ChartDataProvider`
  context, or an optional `chartData` prop defaulting to the store. Prefer the
  context — it is one change per container and no call-site churn at Review & Sign.
- `EasyChartNote.tsx` composes the same containers inside that provider.
- `AiAnnotated` wraps a section to add highlight / hover / confirm, reading review
  state from provenance.
- The parity manifest becomes unnecessary; delete it or reduce it to a real assertion.

**Phase 4 — The assistant**

- `machine.ts` (pure reducer) + `useAssistant.ts` (thin binding) + one `Picker`.
- Unit-test the machine directly: every skip, refine, ambiguity, and failure path.

**Phase 5 — Ambient scribe** *(D4)*

- Precompute moves **out** of `createResourcesFromAiInterview` and into an explicit
  call on the provider recording path only, behind the flag. Never on the patient
  intake interview.
- Replace the string-equality `chartState` cache key with a structural hash.

**Phase 6 — Review pass**

- Port `easy-chart-review`. Suggestions become `Operation[]` on the same contract —
  accepting a card is the same `apply` call as accepting a plan step. No second
  execution path.

**Phase 7 — Evals in CI** *(D6)*

- Prompts to versioned assets; `promptVersion` stamped into provenance and usage.
- A small **synthetic, committed, PHI-free** golden set runs on every change to a
  prompt or a resolver, asserting only deterministic properties: code validity, no
  hallucinated codes, required-field gates, digit-loop non-regression, resolver
  fixtures.
- LLM-judge scoring and the production harvest move to a separate internal tool run
  against a controlled environment — not `scripts/`, not developer laptops.
  `easy-chart-eval-judge` is **not** a deployed zambda.

**Phase 8 — Rollout**

- E2E: dictate → plan → picker → apply → provenance written → Review & Sign shows
  the AI summary. This does not exist today at all.
- Flag on for internal, then pilot, then GA.

### 4.7 Scope for v1

Cut for v1 (each returns later as one more operation kind on the same contract, not
as new machinery):

> `update-procedure` field-by-field editing · `apply-template` · radiology ·
> nursing orders · school/work excuse · addendum · hospitalization · surgical history

Ship in v1:

> narrative → CC/HPI/MOI/ROS/MDM · exam findings · ROS findings · diagnoses ·
> E&M + CPT · medications · allergies · in-house and send-out labs · disposition ·
> patient instructions · vitals · the review pass

Roughly two-thirds of the intent vocabulary, and the two-thirds that carry the
demo. The rest is additive by construction once D1/D2/D5 hold.

---

## 5. Salvage list

Port with light edits — do not regenerate:

| From the branch | To |
|---|---|
| `utils/lib/helpers/easy-chart-capabilities.ts` | `utils/lib/easy-chart/capabilities.ts` |
| `utils/lib/helpers/easy-chart-chart-state.ts` | `utils/lib/easy-chart/chart-state.ts` |
| `zambdas/shared/easy-chart/codes.ts`, `icd-search.ts` | `zambdas/shared/easy-chart/resolve/icd.ts` |
| `zambdas/shared/easy-chart/auth.ts` | as-is |
| `zambdas/shared/easy-chart/vitals.ts`, `sniffers.ts` | `resolve/` |
| `zambdas/test/data/icd10-terminology-corpus.json` | as-is |
| Digit-loop guard + `easy-chart-schema-digit-loop-guard.test.ts` | as-is |
| `review-tab/sign-blockers.ts` | as-is — the extraction was correct |
| Exam/ROS matching heuristics from `intent-logic.ts` | `resolve/exam-ros.ts` (server) |
| The three prompts | `prompts/*.v1.ts`, then edited down |

Deliberately **not** carried over: `intent-logic.ts` as a module,
`useChartAssistant.ts`, `AssistantColumn.tsx`, `NoteSections.tsx`, `note-ui.tsx`,
the per-section note components, `review-tab/note-sections.ts` (the manifest), and
the `scripts/easy-chart-eval/` harness in its current form.

---

## 6. Open questions — the parts to decide together

**Q1. Does unreviewed AI content block signing, or only warn?**
D2 makes either enforceable for the first time. Blocking is safer and will be
unpopular; warning is the status quo intent but with a durable record behind it. This
is a clinical-governance call, not an engineering one, and it changes Phase 1's
exit criteria.

**Q2. Is the Easy Chart note editable in place, or read-only with all edits through the chat?**
The branch does both, which is much of why `NoteSections` could not reuse the
existing containers. Read-only-plus-chat makes D3 nearly free. Editable-in-place is
probably the better product and costs an editing mode on ~8 of the 25 containers.

**Q3. Is Easy Chart a separate page, or a mode of the existing chart?**
A `?assistant=1` mode on the in-person chart would make D3 automatic and eliminate
the second data layer (`useEasyChartData` vs. the appointment store) entirely — but
it constrains the two-column layout. The branch's separate-page choice is what forced
almost every duplication in F3.

**Q4. Does the ambient-scribe precompute survive at all?**
It exists to hide planner latency. With D5 the plan is one call the provider is
already waiting on. Dropping it removes the cache-key brittleness, the blast radius
of F4, and a meaningful share of the LLM spend. Keeping it means keeping a cache
invalidation problem.

**Q5. How much of the eval harness comes back, and where does it live?**
7.9k lines is a real asset and a real liability. Proposal: synthetic golden set in
CI; everything PHI-touching in a separate internal tool. Worth confirming that
splits the value the way we want.

**Q6. One model or two?**
The branch uses Gemini flash-lite for the agent and Claude for planner/review, with
hand-rolled escalation inside a shared helper (8 positional parameters) and a
feature-named secret governing the shared path. Worth settling deliberately — and
either way, the routing should not live in `invokeChatbotStructured`.

**Q7. Where does `sourceText` fidelity get enforced?**
The planner prompt spends real effort demanding verbatim quotes, with a
quote-fidelity guard behind it. With D1 this could become a hard server-side check —
reject a step whose `sourceText` is not a substring of the narrative — rather than a
prompt instruction plus a repair pass.
