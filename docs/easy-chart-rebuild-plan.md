# Easy Chart — implementation plan for a clean rebuild

**Who this is for:** an engineer (or agent) starting this feature from scratch on a new branch, with
**no access to the previous implementation**. This document is the *engineering* plan — architecture,
order of work, and the specific traps that cost the first implementation real time. Everything below was
learned by building and auditing a working version of this feature; where a rule exists because
something actually broke, the failure is stated so you can judge it rather than trust it.

**Companion documents — these four files are the whole available context; there is no old code to read:**

- `docs/easy-chart-requirements.md` — the **product requirements**, verbatim from the ticket. That file
  defines "done"; where it and this plan disagree, it wins.
- `docs/easy-chart-prompts.md` — the previous implementation's LLM prompts, verbatim (~80 KB of clinical
  instruction tuned over many evaluation runs). Mine it for rules rather than pasting it; its
  "load-bearing rules" section is the minimum to carry forward.
- `docs/easy-chart-kickoff.md` — a short brief for whoever picks this up.

Repo conventions you must follow (they are enforced by CI):

- **No barrel imports.** `import { X } from 'utils'` is banned by ESLint (`no-restricted-imports`).
  Import from the declaring module: `import { X } from 'utils/lib/types/data/…'`. There is a codemod:
  `npx tsx scripts/debarrel.ts <dir> --apply` (and `--check` for CI). Same for
  `packages/zambdas/src/shared` — that barrel does not exist; import `…/shared/sentry`,
  `…/shared/auth`, `…/shared/types/common`, `…/shared/helpers` directly.
- Every zambda is `src/<area>/<name>/index.ts` exporting `index = wrapHandler(...)`, plus
  `validateRequestParameters.ts`, and must be registered in `config/oystehr-core/zambdas.json`.
- Tests: `packages/zambdas` has vitest projects `unit` and `integration`
  (`npx vitest run --project unit`). EHR app has `vitest.config.ts` (unit, node) and
  `vitest.config.component-tests.ts` (jsdom). Component tests run behind a **no-network guard**: a
  test that makes a real HTTP call fails.

---

## 0. The one architectural decision everything follows from

> The LLM never writes. It returns a list of **typed actions** drawn from a closed vocabulary.
> Deterministic, unit-tested code resolves each action against a catalogue and writes it through the
> **pre-existing** chart endpoints.

Consequences to preserve deliberately:

- No new write path, so the existing chart invariants cannot be violated by this feature and a revert
  leaves no orphaned data.
- Every LLM mistake is a *wrong action*, which can be validated, gated, and shown to the provider —
  not a wrong database row.
- The feature is testable without a model: given an action list, the executor's behaviour is
  deterministic.

Do not compromise this even for "just this one field".

---

## Phase 1 — The action registry (build this before any prompt)

**Goal:** one module that defines every chartable action, from which the LLM schemas, the prompt
sections, the runtime validation, and the client dispatch table are all *derived*.

**Why first:** in the first implementation the same vocabulary was spelled out in six unconnected
places (a kind array, a TS union, three hand-written JSON schemas, three hand-written post-parse
normalisers, a separate allow-list in the review endpoint, and the client's `if`-chain). Adding one
action meant editing ~15 sites; missing one failed *silently*. Retrofitting a registry afterwards
immediately exposed **five actions that existed in the schemas but were described in no prompt** —
the model could never emit them, and nothing anywhere said so.

**Create** `packages/utils/lib/<feature>/registry.ts` (or an equivalent shared package):

```ts
export const SURFACES = ['plan', 'review'] as const;
export type Surface = (typeof SURFACES)[number];

// A property of the chart-write payload. Derived from the DTO, NOT re-typed as strings:
// renaming a property on the write contract must break this file's build.
export type ChartField = keyof AllChartValues; // from utils/lib/types/api/chart-data/chart-data.types

export interface Capability {
  surfaces: readonly Surface[];
  // Fields without which the action cannot be executed. Checked at runtime on every surface.
  required: readonly Field[];
  // Which chart-write property this action lands in. Absent for actions that go through a
  // different endpoint (labs, imaging, procedures) or write nothing — see NON_CHART_TARGETS.
  chartField?: ChartField;
  // The prose the model is shown for this action. Assembled into the prompt per surface.
  promptDoc: string;
}

export const CAPABILITIES = {
  'add-diagnosis': { surfaces: ['plan', 'review'], required: ['display'], chartField: 'diagnosis', promptDoc: '…' },
  // …
} as const satisfies Record<ActionKind, Capability>;
```

**Also in this phase:**

1. `ACTION_KINDS` array and the `Action` discriminated union must be **provably the same set**. Two
   one-directional type assertions, exported so they aren't flagged as unused:
   ```ts
   type AssertTrue<T extends true> = T;
   type Extends<A, B> = [A] extends [B] ? true : false;
   export type KindsCoverUnion = AssertTrue<Extends<Action['kind'], ActionKind>>;
   export type UnionCoversKinds = AssertTrue<Extends<ActionKind, Action['kind']>>;
   ```
2. A `NON_CHART_TARGETS: Partial<Record<ActionKind, string>>` recording, for every action with no
   `chartField`, which endpoint it uses instead. Every kind must have one or the other.
3. `hasRequiredFields(kind, obj)` — the single runtime gate. A string counts only when non-blank, an
   array only when non-empty.

**Tests (`registry.test.ts`) — all of these caught real defects:**

- every kind has a capability entry, and no entry names a kind that doesn't exist;
- every capability declares at least one surface;
- every `required` field is one the surface's schema actually declares (otherwise the model can never
  satisfy it and 100% of those actions are rejected);
- every kind names a write target (`chartField` **xor** `NON_CHART_TARGETS`);
- generated schema per surface: kind enum ≡ capabilities offered on that surface; declared fields ≡
  registry's field list for that surface;
- **no schema field has `type: 'number'`** — see Phase 2;
- **every action a surface offers appears verbatim in that surface's prompt.**

---

## Phase 2 — LLM schemas and the two non-obvious traps

### Trap 1 — the digit-loop (this one is expensive)

Vertex/Gemini structured output uses constrained decoding, and **a JSON number has no closing
token**. When the model emits a numeric field on an action where it is meaningless (e.g.
`"value": 0.` on `add-diagnosis`), the digit run self-reinforces at temperature 0 and runs to the
output cap. In one measured planner run **31% of calls died at MAX_TOKENS this way**.

**Rule:** declare every numeric field in the response schema as `{ type: 'string' }` — including
`value`, `systolic`, `diastolic`, `followUpInDays`, and any score. Restore the numeric contract
immediately after parse with a shared coercion helper:

```ts
export const NUMERIC_FIELDS = ['value', 'systolic', 'diastolic', 'followUpInDays'] as const;
// finite parse → replace; empty/non-numeric → delete (same as the model omitting it)
export function coerceNumericFields(obj: Record<string, unknown>, fields: readonly string[]): void { … }
```

Keep `NUMERIC_FIELDS` next to the schema definition in the registry, so the guard and its undo cannot
drift. Pin it with the schema test above.

### Trap 2 — one flat action shape, not per-kind schemas

Every action shares one flat property set (all optional except `kind`). A discriminated `anyOf` schema
would be cleaner and would structurally prevent trap 1, **but constrained decoding handles `anyOf`
poorly** — try it, measure it, and fall back to flat + the string guard if it misbehaves. Do not
assume it works.

### Field-order note

Property order in the serialized schema is part of the cached prompt payload. Keep it stable; don't
reorder for cosmetics.

---

## Phase 3 — Endpoints

Build **one** planning endpoint, not two.

> **Do not split "single command" and "full narrative" into separate endpoints.** The first
> implementation did, and the single-command endpoint returned exactly *one* action. A message like
> `patient is 5'8", weighs 130lb` is 30 characters and one sentence, so a length/sentence heuristic
> routed it to that endpoint and **one of the two vitals was silently dropped**. One endpoint that
> always returns a list of 1..N actions removes the heuristic and the entire failure class.

### 3.1 `chart-plan` — narrative → actions

Input: `{ narrative, noteContext?, chartState?, encounterId?, incremental? }`

- `noteContext` — current free-text note fields, so the model can edit in place.
- `chartState` — a summary of what is **already** on the chart, so it doesn't duplicate.
- `encounterId` — fetch the **real** patient age/sex from the chart and put it in the prompt as
  authoritative. Ambient recordings contain cross-talk about other patients; never let the model infer
  demographics from the transcript.
- `incremental` — true when the note is already written and this narrative only adds to it. Note the
  distinction that bit a previous version: *`chartState` being non-empty does not mean incremental* —
  a first dictation for a patient whose history came from intake paperwork has a non-empty chartState
  and still needs the full pass. Getting this wrong silently dropped the template/exam/E&M scaffolding
  for every patient with intake history.

Output: `{ actions: Array<Action & { sourceText?: string }> }` where `sourceText` is the **verbatim**
phrase justifying the action, absent when the model inferred it.

### 3.2 `chart-review` — written note + narrative → proposals

Runs automatically after the plan finishes. Output is a list of suggestions, each carrying its own
`actions[]` (so accepting one needs no new charting logic) plus a human-readable question/rationale.
Offer it a **deliberately narrow** subset of the vocabulary — it corrects a note, it does not chart a
visit.

### 3.3 Prompt-order rule (cost)

Put the static instruction block **first** and the per-call narrative/context **last**. Providers cache
a stable prefix; a variable prefix re-bills the whole instruction block on every call.

### 3.4 Auth — do this now, not later

These endpoints do their FHIR work under the project's M2M token, so the SDK never consults the
caller's permissions. `"type": "http_auth"` only proves the token is valid *for the project*. Without
an explicit check, **any authenticated token can plan against any encounterId** and read that
patient's demographics.

Use the existing helpers:

```ts
import { getUserToken, requireUserWithRole, isTestM2MClient } from '<...>/shared/auth';
import { createClinicalOystehrClient } from '<...>/shared/helpers';
```

Pattern per request:

1. `getUserToken(input)` — throws `NOT_AUTHORIZED` on a missing/blank Authorization header.
2. If `isTestM2MClient(token, secrets)` → allow (server-side automation and the eval harness
   authenticate with `client_credentials`; they have no user profile and could never pass a role check).
   Wrap it in try/catch: it decodes the JWT and throws on a malformed one.
3. Otherwise `requireUserWithRole(token, secrets, ROLES)` where `ROLES` is **the same set that can
   reach the page in the router** — a role that can open the UI must be able to use the API, and vice
   versa.
4. If an `encounterId` was supplied and the caller is a user: read that Encounter **with the caller's
   own token** and let FHIR apply their permissions. **Fail closed** — 401/403/404 all become
   `NOT_AUTHORIZED` (404 too, so the endpoint isn't an existence oracle for encounter ids); any other
   error also denies, but is captured to Sentry so a broken FHIR path shows up as an outage rather
   than silently denying every provider.

### 3.5 Logging — PHI

**Never log a model response body.** For this feature the candidates *are* the generated note (HPI,
MDM, diagnoses, doses); on a transcription call the body is the transcript. Log only the envelope:
model, candidate count, finish reason, text length, block reason, token usage. The same applies to
FHIR transaction bundles — log resource types and counts, not contents.

---

## Phase 4 — Server-side guards (before the client ever sees an action)

Each of these exists because the model did the wrong thing in a measured run.

**4.1 Diagnosis codes.** Validate every code against the real terminology service
(`oystehr.terminology.searchIcd10`, the same search the EHR picker uses). Shape-check first with
`/^[A-TV-Z][0-9][A-Z0-9](?:\.[A-Z0-9]{1,4})?[A-Z]?$/`. If the code is real, keep it; if not, fall back
to searching the model's `display`/`searchTerms`. Tell the model in the prompt that this happens and
that a hallucinated code can never be charted — it then proposes codes confidently instead of leaving
them blank, which measurably improves specificity. **The charted `{code, display}` pair must come from
ONE terminology row** — never a model code with a searched display, or vice versa.

Also guard: codes carrying an organism/etiology qualifier ("gonococcal") that the narrative doesn't
support; `history of…` Z-codes used when the visit describes a current problem; laterality and
first-episode/recurrent qualifiers contradicting the story; the same diagnosis twice; more than one
primary.

**4.2 Units (vitals).** The client's write path converts **narrowly**: a height is inches only when
the unit starts with `i` or `"` and **otherwise assumed centimetres**; a weight is pounds only when the
unit starts with `l` or `p` and **otherwise assumed kilograms**. So passing `1.73 m` straight through
charts a **1.73 cm** patient.

Therefore: recognise units open-endedly (providers write cm, m, mm, inches, feet, feet+inches, kg, g,
lb, lb+oz, stones) and **convert on the server into a unit the client provably handles**. One table
where recognition and conversion are the same row:

```ts
interface UnitRule { pattern: RegExp; canonical: string; factor: number }
const HEIGHT_UNITS: UnitRule[] = [
  { pattern: /(?<![a-z])(?:millimet(?:er|re)s?|mm)\b/i, canonical: 'cm', factor: 0.1 },
  { pattern: /(?<![a-z])(?:centimet(?:er|re)s?|cms?)\b/i, canonical: 'cm', factor: 1 },
  { pattern: /(?<![a-z])(?:met(?:er|re)s?|ms?)\b/i,      canonical: 'cm', factor: 100 },
  { pattern: /(?<![a-z])(?:inch(?:es)?|ins?)\b|"|''/i,   canonical: 'in', factor: 1 },
  { pattern: /(?<![a-z])(?:feet|foot|ft)\b|'/i,          canonical: 'in', factor: 12 },
];
// weight: mg→kg .000001, kg/kilo→kg 1, g→kg .001, lb/pound/#→lb 1, oz→lb 1/16, stone→lb 14
```

Use `(?<![a-z])` rather than a leading `\b`: a unit legitimately abuts its number (`130lb`, `1.73m` —
there is **no** word boundary between a digit and a letter, so `\blb\b` fails on `130lb`), but it must
not match inside a longer word (`grams` must not yield the `ms` of metres). Match compound imperial
forms (`5'8"`, `5 ft 8 in`, `9 lb 4 oz`) **before** the single-unit pattern, or a bare `5 ft` wins.

**An unrecognised unit must not fall back to the default.** Report it: silently reading `1.73 stones`
as kg charts a number nobody stated.

**4.3 Value recovery from the original text.** The model is inconsistent about populating optional
fields; it will emit `{kind:'set-vital', field:'vital-height'}` with no display at all. Recover the
reading from the **provider's own message/narrative** — for *every* vital, not just blood pressure.
(The first implementation had this fallback only for blood pressure, so `add height 5.8 inches`
answered *"I need a value for that vital, e.g. set temp to 100.4 F"* while the number sat in the
message.) Anchor recovery on the unit keyword (weight/height) or the vital's own keyword
(temp/HR/RR/SpO2) so `cough for 5 days` is never read as a measurement.

**4.4 Physiologic plausibility.** `5.8 inches` is decimal feet written as inches — 15 cm. Charting it
is wrong; silently reading it as `5'8"` charts a number the provider never wrote. **Do neither: drop
the value, flag it, and ask.** Threshold: below 20 in / 51 cm is under any live-birth length, so it is
a mis-stated unit rather than a measurement (34 in / 86 cm paediatric heights must still pass).
Apply the same principle to questionable medication strengths.

**4.5 Exam and ROS.**
- An exam finding must not be filed under a different body-system section. Compare at the exam-card
  level, and treat a finding about one structure as *not* contradicting a normal about a different
  structure in the same system (an abnormal tympanic membrane does not contradict "normal canals").
- **Negation guard:** a negated finding ("no wheezing", "lungs clear", "non-tender") is *not* an
  abnormal finding and must not produce one — and it must not remove the matching normal either, since
  it *agrees* with it. Match on polarity, not on the keyword.
- ROS records both positives and negatives; carry the polarity in the display text
  ("Reports…"/"Denies…") and treat any structured `finding` enum as a secondary signal only.
- Never pad exam or ROS with findings nobody addressed.
- Review-proposed ROS negatives must be verifiable against the narrative word-for-word, or dropped:
  the model fabricates plausible classics ("denies sinus pain" on an eye visit).

**4.5a Orders (labs, imaging) — the missing parameters come from the encounter, not the dictation.**

This one needs stating explicitly, because the honest reading of "never guess in a medical record" leads
to the wrong conclusion here. An order endpoint needs things a dictation will never contain: a payment
method, a catalogue item id, a CPT code. **That does not mean the order cannot be placed.** It means the
model supplies only the *name of the test or study*, and deterministic client code resolves everything
else from data that already exists. The previous implementation did exactly this, and it worked:

- **In-house lab.** Fetch the practice's test catalogue for this encounter, score the dictated name and
  search terms against it. No match → **skip the step with a reason naming the test**, so the voiced
  order is not lost. Several near-equal matches ("flu test" → Flu A / Flu B / Rapid Influenza) → **ask**
  when the request was typed interactively; during bulk plan execution take the best and mark it
  low-confidence.
- **Send-out lab.** Same catalogue matching against the connected lab's catalogue. The two extra
  parameters are *derived*, not invented:
  - **payment method** — the same defaulting the regular Labs tab applies: workers'-comp appointment →
    workers' comp; else the patient has coverage → insurance; else self-pay. The provider can change it
    on the order afterwards.
  - **ordering office** — the encounter's own location when it is lab-enabled, otherwise the single
    lab-enabled office. If neither resolves, **skip with a reason** pointing at the Labs tab.
  - It also requires at least one charted diagnosis; with none, skip and say so rather than ordering.
- **Imaging.** The CPT comes from the practice's study catalogue, matched on the dictated study name —
  never from the model. Link the primary diagnosis (or the only one). No catalogue match → skip and name
  the study.
  **Modality guard, learned the hard way:** if the text mentions ultrasound / CT / MRI / nuclear, refuse
  to match at all when the catalogue is X-ray-only. Without it, "venous duplex ultrasound" once resolved
  to CPT 73590, "X-ray of lower leg" — a wrong study charted with full confidence. Partial-word matching
  across modalities is more dangerous than no match.

The principle to take from this: **"do not guess" means do not invent a value; it does not mean refuse to
act.** Resolve from the practice's own data, ask when genuinely ambiguous, and when you truly cannot
resolve it, skip the step *with the study or test named in the reason* so the provider sees what was
ordered out loud and can place it in two clicks. Silently declining to support these actions loses a
voiced order, which is the failure the requirements care most about (section 5, last paragraph).

One thing the previous implementation got wrong and you should not copy: it sent
`consentObtained: true` as a constant on imaging orders. Nothing in a dictation establishes that consent
was obtained. Either derive it from something real or leave it unset and let the order carry the same
default as a manually placed one.

**4.6 Provenance quotes.** Verify each `sourceText` actually occurs in the narrative (normalised
comparison). Models paraphrase and stitch list items with ellipses. If the quote isn't real, drop it —
the item is then honestly marked *inferred* rather than carrying a fabricated citation.

**4.7 Reliability.** On empty response / unparseable JSON / MAX_TOKENS / timeout: retry once, then
escalate to a **backup model**. Two specifics:
- Treat MAX_TOKENS as a **failure**, not partial success. Returning truncated text hands the caller
  broken JSON that only fails to parse *after* the escalation opportunity has passed.
- Retry **sequentially**, after a failure. Do not fire staggered concurrent attempts as a hedge: a
  plan-sized generation outlives the first stagger, so nearly every call ran 2–3 full generations and
  was billed for all of them.

---

## Phase 5 — Client executor

**5.1 Read the chart through the EXISTING hook. Do not build a parallel read layer.**

The app already has `useChartData` in
`apps/ehr/src/features/visits/shared/stores/appointment/appointment.store.tsx` (~57 consumers). Verify
before assuming otherwise: chart data lives in **react-query**, not Zustand, and the cache key is
`[CHART_DATA_QUERY_KEY, encounterId, requestedFields]` — so **several consumers asking for different
`requestedFields` coexist by design**, no collision. It accepts an `encounterId` directly, and its
writes into the exam/ROS Zustand stores are opt-in behind `shouldUpdateExams` (default off).

The first implementation built a separate ~460-line read+write layer on the belief that the shared hook
required a populated appointment store. **That belief was wrong.** Three small gaps actually stand in
the way. **Fix them in the shared hooks — do not route around them.** Guiding principle for this
phase: *the less new feature-owned code, the better.*

1. `useChartData` does not forward `requestedFields` to `useGetChartData` — a one-parameter
   pass-through.
2. `useChartData`'s encounter precedence is `encounter?.id ?? paramEncounterId`, i.e. **store first,
   parameter second**. For a page keyed by `encounterId` in its own URL that is backwards; prefer the
   explicit parameter. (It happens to work today only because the easy-chart route has no `:id` param,
   so the appointment query is disabled — an implicit dependency on route shape, not a guarantee.)
3. `useSaveChartData` takes `Omit<SaveChartDataRequest, 'encounterId'>` and fills the encounter id
   **from the appointment store**. On an encounter-keyed route the store is empty, so the id is
   `undefined` and the save fails. Give it an optional explicit `encounterId`. **This — not "state
   coupling" — is the actual reason the first implementation wrapped saving itself.**

### 5.1a Merging several field sets

This page needs more than the default field set (progress-note free-text fields, vitals, the
transcript/aiChat, the legacy addendum). Ask for them as **several queries with different
`requestedFields`** — the cache key already includes `requestedFields`, so they coexist — and merge
them in **one memoized selector**. Do not spread the merge across components, and do not widen the
app-wide default field set for one page's benefit. This mirrors how `useChartFields` is already used in
the regular chart.

### 5.1c A signed visit must be read-only here too

The shared `useSaveChartData` refuses to write when the appointment is read-only, allowing only
addendum content through (a signed visit can still be appended to, not rewritten). The `save-chart-data`
**zambda does not check this at all** — the guard is client-side only.

The previous implementation called `apiClient.saveChartData` directly and therefore **bypassed that
guard entirely**: on a signed visit the assistant could still write, while the regular chart refused.
Nobody noticed, because the happy path is an open visit.

Two things follow:

1. Route your writes through the shared mutation (which is another reason to do 5.1b there rather than
   in the feature) so the read-only rule applies for free.
2. Treat the whole page as read-only for a signed visit: the composer, the recorder, and the plan
   executor should be disabled with a visible reason, not merely fail at save time. A provider who can
   type a dictation into a signed visit and watch steps fail one by one has been misled by the UI.

Consider also moving the check server-side. A client-only guard on a write endpoint is one API call
away from being bypassed by anything that isn't this UI.

### 5.1b Push the "what did I just create" delta into the shared save hook

The provenance map is keyed by `resourceId`: to highlight a row as AI-written, attach its source quote,
and make it click-to-correct, the code needs the id of the row that was just created. `saveChartData`
returns the **whole updated chart**, not a description of what it added — so something must compare
before/after and report which ids are new.

**Put that comparison in `useSaveChartData` once** (collect ids before, collect ids after, return the
difference) rather than in the feature. It is a small change, every future caller that needs "what did
I just create" gets it, and the feature's own write wrapper then shrinks to just:

- the exactly-one-primary-diagnosis invariant;
- lab/imaging orders, which are separate endpoints and not chart data at all.

That is the target: a feature layer small enough that there is almost nothing custom left to maintain.

**Layers, strictly separated** (the top layer must not fetch):

```
page ── assistant layer     conversation + plan state machine + dispatch table
     ── provenance layer    who wrote what, needs-review queue
     ── write layer (THIN)  save→merge, delete, invariants  ← feature-owned
     ── read: shared useChartData(react-query)              ← NOT feature-owned
```

What is left for the feature to own once 5.1a and 5.1b are done:

- the exactly-one-primary-diagnosis invariant;
- lab/imaging orders — separate endpoints, not chart data;
- the optimistic delete UX (flash, then remove) plus a callback so the provenance map drops the id.

If you do end up needing a feature-level hook, do not name it `useChartData` — the collision with the
shared hook of the same name and a similar object parameter is a real trap.

**5.2 Dispatch table, not an `if`-chain.** One module per action, assembled as
`satisfies Record<ActionKind, Handler>`. Exhaustiveness is then guaranteed by construction — adding an
action without a handler is a build error. (The previous version was a single 730-line function whose
only safety net was an accidental type-narrowing at the end.)

Add a runtime twin: if an action arrives whose kind this build doesn't know (an old client against a
new endpoint), say so plainly and settle the step as *skipped with a reason* — never let it fall
through to a generic "no match", which a provider reads as "there was nothing to chart".

**5.3 Step state machine.** For each action: resolve against its catalogue →

- exactly one confident match → write, mark AI-authored;
- several near-equal matches → **ask** (only for interactively-typed follow-ups; during bulk plan
  execution, auto-pick the top match and mark it low-confidence, or the provider clicks through dozens
  of pickers);
- nothing / implausible → skip **with a reason**.

Every step must end in `applied | skipped(reason) | failed`. Silent no-ops are the single worst
failure mode in this product.

**5.4 Destructive actions ask.** With several plausible matches for a removal, ask rather than deleting
the first substring match.

**5.5 Provenance.** Store per written item: `sourceText` (verbatim quote) or `inferred: true`, plus
optional `caution`, `templateName`, `reviewNote`. When the provider hand-edits a field, **clear** its
AI-authorship mark. For composite items (procedures), track provenance **per field** — the procedure
itself was dictated, but its field values came from a template default.

**5.6 Two known data-model warts you will meet**

- **The in-person Chief Complaint textarea is backed by the `historyOfPresentIllness` chart key, and
  vice versa.** Isolate this swap in ONE mapping function used by every consumer (client and server),
  or you will be reasoning about it in five places.
- The exam config has a **migration version** on the encounter. An encounter charted under an older
  layout carries observations whose field names the current config doesn't define. The regular chart
  detects these and offers a one-click migration; your surface must do the same, or those findings
  render as raw field names and the assistant is blind to them.

---

### 5.7 Conversation context — the assistant must remember the session

**Requirement:** see the requirements document, Addendum B. The provider should be able to follow up on
the previous turn ("make that ten days instead") and to ask a question about the note and get an answer
grounded in the whole session.

**Starting point to be aware of:** the previous implementation was **stateless per turn**. Each message
was sent on its own with only the current chart state and note text — no prior turns. So a follow-up that
referred to the last exchange could not work, and a *question* was treated as a charting command and came
back as "I can only chart specific items".

That last part matters: **context alone does not deliver this requirement.** Two changes are needed.

#### a) The assistant needs a way to answer, not only to chart

Add an action kind that carries text and writes nothing — call it `reply`. It is distinct from
`provider-note` (which means "this cannot be charted, you must do it yourself in the regular chart"):
`reply` means "here is the answer to what you asked".

Register it in the registry like any other capability, with `surfaces: ['plan']`, no `chartField`, and a
`NON_CHART_TARGETS` entry. Then a turn's result is uniformly "a list of actions", where a question
produces a single `reply`. No second code path, no separate endpoint.

#### b) Send a bounded digest of the conversation, not the raw thread

Include in the request a compact history, appended in the **variable tail** after the static instructions
(Phase 3.3 — history is per-call, so it must not sit in the cached prefix):

```
history: [
  { role: 'provider', text: <verbatim message> },
  { role: 'assistant', charted: ['add-diagnosis: Acute sinusitis', 'set-vital: Temp 100.4 F'], skipped: [...] },
  …
]
```

Rules that keep this from becoming a problem:

- **Summarise assistant turns, quote provider turns.** What the provider *said* is evidence and must be
  verbatim. What the assistant *did* is already in the chart state — one line per action is enough.
- **Cap it**: last ~6 turns and a hard character ceiling, dropping the oldest. Every turn re-sends the
  history, so cost grows superlinearly with an uncapped window. Watch this on the token counter.
- **Always send fresh chart state, and mark every turn after the first `incremental`.** This is the
  guard against the obvious failure mode: given history, the model will otherwise happily re-emit
  actions it already emitted, and the provider gets duplicates. State it in the prompt too — history is
  for reference, the chart state is the truth, chart only what is new.
- **Never put a transcript in the history.** A full ambient transcript is the largest single payload in
  the feature; if it enters the rolling window it will dominate every subsequent call. Keep it as the
  narrative of the turn that used it and summarise that turn like any other.

#### c) Answer provenance questions from stored data, not from the model

"Why did you code it that way?" is the question providers will actually ask. Do **not** answer it by
asking the model to explain itself after the fact — a model asked to justify a past decision will
produce a plausible reason whether or not it was the real one, and in a medical record that is worse than
no answer.

The honest answer is already stored: each item carries the verbatim phrase it came from, or is marked
inferred (Phase 5.5). Route these questions to that data — a `reply` assembled from the provenance the
item actually has ("charted from: *'temp was one hundred point four'*", or "inferred — nothing in the
visit stated it"). Only genuinely open questions ("what else is missing before I can sign?") should go
to the model, and those it can answer from the chart state it already receives.

#### d) Tests

- a follow-up resolves against the previous turn ("make it ten days instead" after a prescription);
- a question returns a `reply` and writes nothing to the chart;
- **a follow-up does not re-chart earlier items** — give the model a history containing prior actions
  plus a chart state that already includes them, and assert no duplicates;
- the history window is capped: after N turns the oldest are dropped and the request stays under the
  ceiling.

---

## Phase 6 — The note pane

Requirement: nothing a reviewer needs at sign-off may be missing from this view.

**Do not re-implement the existing progress note's section list.** The first version did — ~26 sections
rendered by a second, independent renderer — which guarantees drift and then needs a test that *reads
the other renderer's source file* to police it.

**Instead:** make the existing progress note's section list **data** (an array of
`{ id, condition, node }`), and render both surfaces from that one manifest. If that refactor is out of
scope for week 1, then at minimum:

1. a shared manifest module listing every section id and which surface renders it, both columns in one
   file so you cannot add to one without seeing the other;
2. a test asserting your surface covers every section the progress note renders, with an explicit,
   commented exclusions map for deliberate gaps;
3. a test that reads the progress note component and fails when it renders a section component that
   isn't registered.

**Also read the practice's progress-note config** (`useProgressNoteConfig`): whether MDM is required,
the default disposition texts, the vitals unit input order. Your surface is the same note — if it
ignores these, a practice that made MDM optional still sees it demanded, and the note the provider
signs is judged by rules your page never showed them.

**Sign-blocking rules must be shared, not re-derived.** Extract them into one pure function consumed by
the sign button, the "missing data" card, **and** your warnings panel. The first version had a third
private copy that reimplemented 5 of the rules and was missing 4 others — so a clean panel on the new
page did not mean a signable note. Keep genuinely-new AI lint (duplicate codes, two primary diagnoses,
contradictory ROS polarity) separate from shared sign blockers.

---

## Phase 6a — UI: reproduce this layout or better

The previous implementation's UI worked well in practice and is worth treating as a baseline rather
than a starting point to improvise from. Match it or improve on it; do not diverge by accident.

### Entry points

Two, both already proven:

1. **Tracking board row** — a `GoToButton` labelled **"Easy Chart"** with the `AutoAwesomeIcon`
   (sparkle), sitting in the same action cell as "Visit Details" and the progress-note button, between
   them. Navigates to `/easy-chart/:encounterId`. Keeping it in that trio matters: it reads as a third
   way into the same visit, not as a separate product.
2. **Command palette** — the page registers itself as a palette source so the provider can reach it by
   keyboard. Note that the palette's shortcut must not be swallowed while focus is in the assistant's
   message box.

### Page frame

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Jane Doe · 04/12/2018 (7y F)                    [transcript chips] [Open in    │
│ 22.4 kg · Reason: ear pain · Allergies: penicillin           regular chart]    │
│                          ▲ red + bold when allergies exist, grey "none" if not │
├────────────────────────────────────────────────────────────────────────────────┤
│ ☑ I verified patient's name and date of birth.   ← amber tint until checked,   │
│                                                    green once checked           │
├────────────────────────────────────────────────────────────────────────────────┤
│ ⚠ 3 items need review · No primary diagnosis is set   [Confirm all]            │
│   ← one banner: amber if warnings, blue if only review remains, green when      │
│     clear; replaced by "Plan applied — AI review in progress…" while running    │
├──────────────────────────────────────┬─────────────────────────────────────────┤
│ NOTE  (grid 3fr)                     │ ASSISTANT  (grid minmax(320px, 2fr))    │
│ scrolls independently                │ scrolls independently                   │
│                                      │                                         │
│ Chief Complaint                      │  ┌───────────────────────────────────┐  │
│ History of Present Illness           │  │ thread: past turns, each with the │  │
│ Mechanism of Injury                  │  │ settled plan card kept in history │  │
│ Review of Systems                    │  └───────────────────────────────────┘  │
│ Vitals            [+ temp] [+ BP] …  │  ┌───────────────────────────────────┐  │
│ Examination                          │  │ live turn: step 4/11 — adding …   │  │
│ Procedures                           │  │ ⏳ 0:38  (elapsed appears only    │  │
│ Assessment / Diagnoses               │  │ once the call runs long)          │  │
│ Medical Decision Making              │  └───────────────────────────────────┘  │
│ E&M / CPT                            │  ┌───────────────────────────────────┐  │
│ Labs ordered / results               │  │ composer (multiline, stays        │  │
│ Radiology · Immunizations            │  │ focused; queues while busy)       │  │
│ Prescriptions · In-house meds        │  │                          [Send]   │  │
│ Disposition · Instructions           │  └───────────────────────────────────┘  │
│ School/Work excuse · Addendum        │                                         │
│ Privacy policy line                  │                              🎤 (FAB)   │
└──────────────────────────────────────┴─────────────────────────────────────────┘
```

### The note pane's sections, in render order

The previous implementation rendered these 28 sections, in this order. Each is hidden when it has no
content, except the two attestations. Order follows Review & Sign so a provider reading both sees the
same document.

| # | Section | Notes |
|---|---|---|
| 1 | Allergies | |
| 2 | Medications | intake / home medications |
| 3 | Medical History | |
| 4 | Surgical History | |
| 5 | Hospitalizations | |
| 6 | In-House Medications | MAR orders; separate query, not chart data |
| 7 | Immunization | administered only |
| 8 | Chief Complaint | free text, hand-editable |
| 9 | History of Present Illness | free text, hand-editable |
| 10 | Mechanism of Injury | free text, hand-editable; injury visits only |
| 11 | Review of Systems | structured findings, reports/denies |
| 12 | Vitals | plus quick-add chips |
| 13 | Examination | structured findings grouped by body-system card |
| 14 | Additional questions | screening questionnaires + screening notes |
| 15 | Procedures | per-field "template default, verify" affordances |
| 16 | Assessment / Diagnoses | primary marked |
| 17 | Medical Decision Making | free text, hand-editable |
| 18 | E&M Code | |
| 19 | CPT Codes | |
| 20 | Labs ordered | in-house + send-out ServiceRequests |
| 21 | Lab Results | in-house + external results, incl. pending |
| 22 | Radiology | |
| 23 | Prescriptions | |
| 24 | Patient Instructions | **collapsible, with a count in the title** |
| 25 | School / Work Excuse | presigned download links |
| 26 | Disposition — *{type label}* | the type is in the section title |
| 27 | Privacy policy acknowledgement | always shown |
| 28 | Addendum | includes the legacy single-string field |

Two attestations sit **above** the sections, not among them: the "I verified patient's name and date of
birth" checkbox and the readiness/warnings banner.

### Token usage under the chat

Beneath the composer, a monospace caption reports the session's LLM spend, with a `reset` control, shown
only once at least one call has been made:

```
🔢 Claude 128,400 in (96,200 cached, 4,100 wrote) / 3,910 out · Gemini 22,050 in / 1,480 out · 7 calls
                                                                                          [reset]
```

Keep this. Two notes for the rebuild:

- In the previous implementation it was marked `TEMPORARY (debug)` in the code but became something
  people relied on. Ship it as a deliberate feature rather than leaving it labelled temporary — and
  decide whether it is visible to every provider or only behind a flag. The numbers themselves should
  always be collected (Phase 7.2), regardless of who sees them.
- **Show the cached figure.** It is the only way a provider or engineer can tell that prompt caching is
  actually working; a cache-read of zero across a session means the static-prefix ordering broke and
  every call is being billed in full.

Layout specifics worth copying exactly:

- `Container maxWidth={false}` — the note needs the width; do not centre it in a narrow column.
- CSS grid `3fr minmax(320px, 2fr)` on `md+`, single column below. The `minmax` floor stops the
  assistant collapsing to unusable width on a laptop.
- Height constrained to the viewport on `md+` so **each column scrolls independently**. Providers read
  the note while the assistant works; a single page scroll makes that impossible.
- The recorder FAB is lifted (`bottom: 160`) so it never sits under the composer.
- Transcript chips live in the header but are **owned by the assistant column** and portalled up —
  their state belongs with the assistant, their position belongs with the patient banner.

### AI-authored item treatment (the most important interaction in the feature)

Every AI-written row is a button-like surface, not static text:

| State | Treatment |
|---|---|
| AI-written, sourced from a dictated phrase | blue tint `rgba(25,118,210,0.12)`, hover darkens |
| AI-written but **inferred or low-confidence** | **amber** tint `rgba(237,108,2,0.14)` + an "inferred" badge |
| Reviewed / provider-entered | no tint; hover shows a neutral grey |

- **Hover shows provenance** — the verbatim quote it came from, or the review pass's reasoning, or
  "template default, verify". This is how a provider audits a whole note in seconds.
- **Click opens correction in place** — pick a different match from a list, refine the search, or skip.
- **A per-item "looks right" affordance** marks it reviewed without changing it, plus a **"Confirm all"**
  in the readiness banner.
- Amber vs blue is the whole point: it directs attention to what the model *guessed* rather than heard.

### Smaller pieces that carried their weight

- **Quick-add vital chips** next to the Vitals section — the provider types a number instead of
  dictating. Accepts cm, total inches, and feet-and-inches (see Phase 4.2 for units).
- **Inline editable free-text fields** — every note section is editable by hand, exactly like a
  document. The assistant is never the only way in.
- **Settled plan cards stay in the thread** — a completed plan remains visible with per-step
  ✓ / ⏭ / ✗ so the provider can look back at what was done and why.
- **Long pasted narratives collapse** with a "show more" control, or one paste drowns the thread.
- **Elapsed-time counter appears only after the call runs long** — silent waiting is what makes an
  assistant feel broken; a timer from t=0 makes every call feel slow.
- **Composer stays usable while the assistant works** — typed messages queue and send when it frees up.
- **Transcript chips** show source, who recorded, and when (in the viewer's local timezone), with a
  check once used; clicking opens a preview offering generate / insert-into-composer / copy.
- **A one-click banner** offers to generate the chart when the chart is empty and an unused transcript
  exists.
- **"Open in regular chart"** link, always present, opening in a new tab.

### UI acceptance bar

Rebuild is not done until: both entry points exist; the two columns scroll independently; every
AI-written item is tinted, hover-explains its provenance, and is click-correctable; inferred items are
visually distinct from sourced ones; completed plans persist in the thread with per-step outcomes; and
every free-text section is hand-editable.

---

## Phase 6b — Ambient scribe and transcripts

Requirements section 4 in full. This is the highest-value input path — the provider says nothing to the
computer, the visit conversation becomes the note — and it has more moving parts than anything else in
the feature. None of the mechanism below is guessable, so it is spelled out.

### The storage contract

A transcript is a **`DocumentReference` on the encounter** carrying an inline attachment whose
`title === 'Transcript'` with non-empty `data`. It reaches the client as `chartData.aiChat.documents`.

- **Only the unscoped `getChartData` call returns `aiChat`.** A request with `requestedFields` narrowed
  to the note fields will not include transcripts — which matters given Phase 5.1a's several-queries
  approach.
- **Two sources, one shape:** the ambient recording made in the room, and the patient's intake chatbot
  conversation. Distinguish them from the DocumentReference (an audio-vs-chat source helper exists) and
  label the chip accordingly — 🎤 for a recording, 💬 for the intake chat — followed by who produced it,
  resolved from the document plus the providers list on `aiChat`. Sort chips by the document's date.
- **Decoding trap.** The server stores the text base64-encoded via
  `btoa(unescape(encodeURIComponent(text)))`. The client must invert exactly that:
  `decodeURIComponent(escape(atob(data)))`. A plain `atob` **mangles every non-ASCII character** — and
  clinical text has plenty. Test with an accented name.

### "Used" must survive a reload

Requirement: once a transcript has been used it is marked with a check so it is not applied twice, but
deliberate re-use stays possible.

- Session state alone is not enough — the mark has to survive a reload and be visible in another
  browser. Stamp a **durable extension** on the DocumentReference (a `valueDateTime` of when it was
  consumed). Treat "used" as *session-sent OR carries the extension*.
- Write it with a FHIR **patch**, not an update. The in-memory copy of that document may be stale, and a
  full update would clobber concurrent edits to the whole resource; a patch touches only the extension
  array.
- Stamping is **best-effort and must not block** the charting it follows.
- **A failed or interrupted generation must not mark the transcript used** (requirements section 10).
  Stamp only after the send succeeds. Getting this backwards means a failed run silently burns the
  transcript and the provider has no obvious way back.

### Waiting for a transcript that does not exist yet

After a recording is uploaded, the transcript document is created **asynchronously server-side and can
take minutes**. The easy-chart page has no appointment-store refetch to piggyback on, so nothing would
notice it until a full reload.

Implement a bounded poll, started by the recorder's "saved" callback:

- poll the **unscoped** `getChartData` every ~12 s for up to ~5 minutes;
- snapshot the transcript ids you already know **at start**; the first id outside that snapshot is the
  new one — then hand the fresh `aiChat` to the page through the normal data flow so the existing chips
  and banner light up, and stop;
- a second recording started while polling should **re-baseline and extend the window**, not stack a
  second interval;
- a transient fetch failure must not end a minutes-long wait — log it and keep polling;
- cancel on unmount;
- show a pending state while it runs, or the provider sees nothing happening after saving a recording.

### The recorder button

- The mic FAB and its recorder popover are **shared with the in-person visit layout** — do not fork
  them. Make position overridable (px from the viewport bottom) so this page can lift the FAB and its
  popover clear of the assistant composer.
- The popover must be **hidden, not unmounted**, when closed: unmounting kills an in-progress recording.
- The page hosts a recorder, so it must also **stop and save the recording when the provider navigates
  away** — the shared hook for that already exists and every recorder host is expected to call it.

### The transcript-to-composer round trip

Requirement: clicking a chip offers read / generate / insert-into-composer / copy.

The "insert" path needs one non-obvious mechanism. When transcript text is placed in the composer (or
several transcripts are sent at once), prefix each with a header line of a fixed shape,
e.g. `=== 🎤 Dr Smith ===`. That header is load-bearing in two places:

1. the send path detects it and routes the message as a **narrative** regardless of any length
   heuristic — a pasted transcript must never be treated as a one-line command;
2. after a successful send, the labels found in the text are matched **exactly** against the chips to
   stamp the right documents as consumed. An edited header therefore stamps nothing, which is the
   conservative direction: better to leave a transcript unmarked than to mark the wrong one.

Use the same label on the chip and in the header so the provider can trace a thread section back to its
source.

### "Starts immediately" — decide this deliberately

Requirements section 4 says generation from a transcript starts immediately, with the preparation done in
advance. The previous implementation satisfied this by running the planner server-side while the
recording was being processed and caching the resulting plan as an extension on the transcript
DocumentReference; on click the client executed the cached plan instead of making a live call.

The idea is sound and the requirement is real. What was fragile was the **cache key**: a free-text chart
summary that the client and the server had to build byte-for-byte identically (see Phase 8). If you keep
the precompute:

- key it on a **hash of structured inputs**, not on a formatted string;
- log hit and miss rates, or a permanently-missing cache is invisible;
- treat a malformed or absent payload as simply absent and fall back to a live call — the cache is an
  optimisation, never a correctness dependency;
- the cache is valid **only for the transcript's unedited text**. Text the provider edited in the
  composer must go to a live call.

If you defer the precompute to v2, say so explicitly and accept that section 4's "no long wait" is not
yet met — do not leave it ambiguous.

---

## Phase 7 — Eval harness (start it in week 1, not at the end)

Every guard in Phase 4 exists because a harness surfaced the failure. Without one you cannot tell
whether a prompt edit helped.

Build, under `tools/` (**not** as a deployed endpoint — an LLM judge reachable in production is an
open invitation to spend model budget):

1. a corpus. **Read `docs/easy-chart-eval-cases.md` before planning this phase** — it explains what you
   inherit and what you do not. Short version: you get **twenty synthetic dictations with no gold notes**
   (reproduced in that file, usable immediately for deterministic checks), and you get **no real cases at
   all** — the harvested (transcript, gold note) corpus was PHI, lived in gitignored directories, and was
   never committed. Harvesting real cases again needs access to a live environment and whatever approval
   that carries, so it has a lead time. Add the corpus ignore rules **before** the first harvest, not
   after;
2. a runner that calls the plan endpoint for each and dumps the resulting actions;
3. an LLM judge that scores per clinical section: captured / missed / extra, where each miss is tagged
   **"was this even derivable from the transcript?"** — a gold note contains PMH, intake meds and
   exam clicks the ambient recording never heard, and penalising the planner for those is meaningless.
   Headline score over transcript-derivable items only;
4. a replay harness that runs captured actions through the **real client matchers** with assertions —
   this is where exam/ROS mismatches show up. (The previous version had this as a diagnostic that
   printed to the console, asserted `expect(true).toBe(true)`, and was skipped unless a hardcoded
   `/private/tmp/...` path from one developer's machine existed. Make it a real test over committed
   fixtures.)

### 7.1 The tooling that actually proved necessary

The previous implementation accumulated ~25 scripts around this feature. You will rediscover the need
for each one the hard way, so here is the inventory, grouped by what it solves. Build them as you hit
the need, but know they are coming.

| Need | Tool |
|---|---|
| Grow the corpus from real visits instead of hand-writing cases | harvester that pulls (transcript, gold note) pairs from a real environment, plus a deterministic renderer so the gold note is comparable |
| Run one case end-to-end through the real code path | single-case runner (transcript → plan → applied), and a batch runner over a directory |
| Score without spending model budget | **deterministic** scorer for codes/structured items — run this first, reserve the LLM judge for free text and semantics |
| Score meaning, not strings | the LLM judge (see above) + a separate free-text judge per field |
| Distinguish "planner missed it" from "unhearable" | an offline pass that stamps transcript-derivability onto each harvested gold item, so the fidelity number is honest |
| Re-run a case against a real encounter | a "wipe all chart data for this encounter" script — without it, every re-run starts dirty and results are meaningless |
| Exercise the transcript path without a recording | a script that seeds a visit-transcript DocumentReference on an encounter |
| Verify order dispatch really works | small scripts that make the exact zambda calls the lab/imaging actions make, outside the UI |
| Inspect what a template actually contains | a script that prints a template's clinical payload by title |
| Reproduce planning offline | an offline template catalogue so the headless runner doesn't need a live environment |

Two lessons about this tooling:

- **The deterministic scorer earns its keep before the LLM judge does.** Codes, dedup, primary-diagnosis
  and unit errors are all checkable without a model, they are the failures that matter most, and they
  cost nothing to re-run on every change.
- **The judge must be a local tool, not a deployed endpoint.** In the previous implementation it shipped
  as a normal authenticated zambda, i.e. anyone with a project token could spend model budget scoring
  arbitrary text. Keep it in `tools/`.

### 7.2 Cost and reliability observability — build it into the endpoints

An LLM feature without per-call accounting produces a surprise invoice. Return, from every model call:

- **usage**: provider, model, input tokens, output tokens, cache-read and cache-write tokens, thinking
  tokens. Cache figures are what tell you whether the static-prefix ordering (Phase 3.3) is actually
  working — without them you cannot tell a cached prefix from a re-billed one.
- **escalation**: did the primary model fail, how many attempts were made, and a coarse reason category
  (`timeout` / `empty-response` / `truncated` / `unparseable` / `rejected-by-validation` / `error`).
  This is how you learn that the cheap model is failing 30% of the time instead of discovering it in a
  bill.

Also worth copying: for each **deterministic trigger** that forces the model to address something (e.g.
"the narrative mentions follow-up but no disposition is charted"), report both *whether the trigger
fired* and *whether the model then complied*. Without the pair you cannot distinguish "the guard never
fired" from "the guard fired and the model ignored it" — which are opposite bugs with the same symptom.
Report counts and pattern labels only, never narrative text (Phase 3.5).

---

## Phase 8 — Things to leave out of v1 (and why)

- **A precomputed-plan cache keyed on a free-text chart summary.** The previous design had the client
  and the server independently build a summary string that had to match **byte for byte** to hit. That
  will diverge, and the only symptom is "the cache always misses", which is invisible. Note this is a
  caveat about the **key**, not about the feature: requirements section 4 does ask for generation to
  start immediately, so if you drop the precompute for v1 you are deferring a requirement and should say
  so. See Phase 6b for how to key it safely if you keep it.
- **A second LLM surface for single commands** — see Phase 3.
- **Auto-applying review-proposed deletions.** Additions can be highlighted in place; a deletion cannot
  (the item is gone). Route removals through explicit confirmation.
- **Prompt text generated from the registry.** Assemble prompt *sections* from registry `promptDoc`
  strings, but expect to hand-tune the surrounding instructions against eval runs, and pin the tuned
  bytes with tests. Generating the whole prompt trades measured quality for tidiness.

---

## Phase 9 — Rollout details that were missing last time

- **Put the page behind a feature flag.** The previous implementation shipped it as a plain route
  guarded only by the UI's role check. There was no way to enable it for one practice, or turn it off
  without a deploy.
- **Decide who may see a visit transcript.** The ambient recording's transcript is stored as a
  DocumentReference on the encounter and is surfaced in the UI. It is the rawest PHI in the feature —
  confirm the intended audience is the same as for the note, and that it is covered by whatever
  retention rule applies to recordings.
- **All timestamps display in the viewer's local timezone** (transcript chips, recording times). This
  is in the product requirements and is easy to lose when a value arrives as a bare ISO string.
- **Know the model-cost envelope before enabling it broadly.** With the usage reporting from Phase 7.2,
  measure cost per charted visit on the eval corpus and decide the acceptable ceiling *before* rollout,
  not after.

---

## Acceptance checklist

Feature is not "done" until all of these hold:

- [ ] `ACTION_KINDS` ≡ `Action['kind']` proven by type assertion
- [ ] Every action: registry entry, prompt mention (tested), handler (typed table), write target
- [ ] Renaming a property on the write DTO breaks the build
- [ ] No `type: 'number'` in any response schema; numeric coercion tested
- [ ] Every endpoint: user-token + role check, and encounter access verified with the caller's token
- [ ] No model response body, transcript, or FHIR bundle content in logs
- [ ] Diagnosis codes validated against the terminology service; hallucinated codes cannot be charted
- [ ] Any length/mass unit accepted; all converted server-side; unrecognised unit reported, not defaulted
- [ ] Implausible height/dose asks instead of charting or guessing
- [ ] Multi-reading input produces multiple actions (regression: `patient is 5'8", weighs 130lb`)
- [ ] Every step reports applied / skipped-with-reason / failed
- [ ] Every AI-written item marked, attributed (quote or "inferred"), individually correctable
- [ ] Hand-editing a field clears its AI mark
- [ ] Chart reads go through the shared `useChartData`; no parallel read layer
- [ ] Several field sets fetched as separate queries, merged in ONE memoized selector
- [ ] Shared `useSaveChartData` accepts an explicit `encounterId` and returns created-resource ids
- [ ] Section parity with the progress note enforced by test
- [ ] Sign-blocking rules shared with the sign button, not duplicated
- [ ] Practice progress-note config honoured (MDM required, disposition defaults, vitals unit order)
- [ ] UI: both entry points (tracking-board button + command palette); independently scrolling columns
- [ ] UI: AI items tinted, provenance on hover, click-to-correct; inferred visually distinct from sourced
- [ ] UI: settled plans persist in the thread with per-step ✓/⏭/✗; every free-text section hand-editable
- [ ] UI: all 28 note sections present, in the documented order; token tally under the composer
- [ ] Transcripts: both sources chipped and labelled; non-ASCII text decodes correctly
- [ ] "Used" mark is durable (survives reload), written by patch, and never set on a failed generation
- [ ] Recording upload → transcript appears without a reload (bounded poll, pending state shown)
- [ ] Recorder popover survives being closed mid-recording; recording is saved on navigate-away
- [ ] Conversation keeps context: a follow-up resolves against the previous turn
- [ ] A question returns an answer and charts nothing; a follow-up does not re-chart earlier items
- [ ] Provenance questions answered from stored provenance, not re-generated by the model
- [ ] Eval harness runs from committed fixtures and reports a fidelity number
- [ ] Deterministic scorer exists and runs without a model; LLM judge lives in `tools/`, not deployed
- [ ] Every model call returns token usage (incl. cache figures) and escalation info
- [ ] A signed/read-only visit disables the assistant with a visible reason, and cannot be written to
- [ ] Page is behind a feature flag; timestamps render in the viewer's timezone

---

## Suggested order

| # | Work | Blocks |
|---|------|--------|
| 1 | Registry + type assertions + derived schemas | everything |
| 2 | Eval harness skeleton with 5 fixtures | prompt tuning |
| 3 | `chart-plan` endpoint + auth + PHI-safe logging | client work |
| 4 | Server guards: codes, units, plausibility, quotes | trustworthy output |
| 5 | Client: shared read hook + thin write layer, handler table, step machine, provenance | usable feature |
| 6 | Note pane from the shared section manifest + shared sign blockers | sign-off parity |
| 6a | UI frame, entry points, AI-item treatment (Phase 6a is a baseline to match, not to improvise) | usable by a provider |
| 7 | `chart-review` endpoint | last — needs a measured main flow |

Auth and PHI logging belong to step 3. Retrofitting them later means auditing every call site twice.
