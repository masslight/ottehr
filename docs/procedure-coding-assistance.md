# Procedure coding assistance

When a provider documents an in-office procedure, the chart suggests the CPT/HCPCS codes for what
was documented, and checks the codes already selected against that same documentation.

## What it does (the whole feature in six lines)

1. The suggestion is computed from **structured answers** on the procedure form — dropdowns,
   checkboxes, numbers. Free text stays on the form for narrative but never determines a code.
2. If an answer that decides the code is missing, the system **names what is missing and suggests
   nothing**. It never guesses.
3. Codes the provider has selected — suggested or searched manually — are checked back against the
   answers and flagged with a reason when the documentation does not support them.
4. Daily unit limits and code pairs that cannot be billed together are flagged.
5. Fifteen procedure families are decided by rules. Six other types (x-ray, wound care, tick
   removal, staple removal, oral rehydration, nasal lavage) keep the older **AI suggestions**, which
   carry no documentation checking.
6. Every rule comes from a published source, and the sources are linked next to the rules
   themselves — see [Where the rules come from](#where-the-rules-come-from).

Everything else — which question each family asks, which code wins in which band — is in the rules,
not in prose. Read the rule book below rather than this document.

## The two directions: suggest and defend

They are separate entry points and separate panels. Do not mix them up when debugging.

|                     | Suggestion                                                                                                                                    | Defence (documentation check)                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Question it answers | "what should be billed?"                                                                                                                      | "is what is already billed supported?"                                                                       |
| Entry point         | `suggestCode()` in `packages/utils/lib/procedure-coding/evaluate.ts`                                                                          | `defendCodes()` in the same file                                                                             |
| Rules per family    | `suggest()` in `packages/utils/lib/procedure-coding/families/*.ts`                                                                            | same family model, `documentationChecklist` and the same `suggest()` result compared with the selected codes |
| On screen           | "CPT code — from your documentation" (or "Possible CPT codes — AI suggestions") — `components/procedures/coding-assist/CodingAssistPanel.tsx` | "Documentation check" — `components/procedures/coding-assist/DocumentationCheck.tsx`                         |
| Verdicts            | a code, a shortlist, or "needs more documentation"                                                                                            | supported / not supported (with reason) / not assessed                                                       |

Both run from one hook, `apps/ehr/src/features/visits/in-person/hooks/useProcedureCoding.ts`: local
rules settle ~0.5 s after the last edit; an AI request waits 5 s and is cached. The form fields
themselves are generated per family by `components/procedures/StructuredCodingFields.tsx` from the
family's field list, and the answers are saved as `structuredFacts` on the ServiceRequest.

The AI path (`recommend-billing-codes` zambda, parsing in `packages/utils/lib/procedure-coding/ai/`)
only ever suggests. It marks every selected code "not assessed" — AI may flag, never bless.

## Where the rules come from

Nothing in this feature is invented. Each family module states its sources in the file header and
cites them again at the decisions that use them — CMS NCCI Policy Manual 2026 chapters, the Medicare
Claims Processing Manual, MAC articles, the MPFS RVU file, the NCCI PTP and MUE tables, plus
specialty-society corroboration where CMS is silent. Bundled code pairs live in `medicare-ptp.ts`
and daily unit limits in `cpt.ts`; a code absent from the limits table means "no limit confirmed by
a source", not "no limit".

The same links are gathered, section by section and in plain language, in the rule book:

**`packages/utils/lib/procedure-coding/coding-scenarios.ts`**

That file needs no programming knowledge. Every entry is one visit: what was picked in "Procedure
type", what was answered (written with the labels printed on the form), and which codes must be
suggested — plus a "Read the rules" block per section with the public pages that decide those codes.
A biller can check a rule there without opening any code, and change it by editing one line.

For developers, the logic is easiest to read through the tests:

- `packages/utils/lib/procedure-coding/feature.test.ts` — runs every line of the rule book, both
  directions. Start here to see what the engine actually promises.
- `packages/utils/lib/procedure-coding/evaluate.test.ts` — family detection, grouping, exclusions.
- `apps/ehr/tests/component/ProcedureCodingHooks.test.tsx` — when the engine answers, when AI is
  asked, debounce, caching, stale-response handling.
- `apps/ehr/tests/component/ProceduresNewCodingAssist.test.tsx` — what the two panels render.

## Checking it by hand (no programming needed)

Open a visit → **Procedures** → **Procedure**, tick consent, and pick the procedure type. The
suggestion appears under the form as you answer; give it a second to settle.

| #   | Do this                                                                                           | Expect                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Laceration Repair (Wound Closure)** → wound 1: Site `trunk`, Length `2`, Closure `single layer` | Suggestion **12001**, with a one-line reason. "Add" puts it in the visit's CPT codes, same list as manual search.                                                                  |
| 2   | Same wound, but clear **Closure**                                                                 | No code. Message: _Additional documentation needed to suggest a code — Wounds 1: Closure_                                                                                          |
| 3   | Same wound with Closure back, then search and add **12004** by hand                               | Documentation check: 12004 is not supported — the answers produce a different code. The code is flagged, never removed or blocked.                                                 |
| 4   | **Impacted Cerumen Removal** → impaction established, then _irrigation_ for **both** ears         | Suggestion **69209-50** (one bilateral line). Switch the left ear to _instruments_ and it becomes two lines, **69210-LT** and **69209-RT** — the method decides the code, per ear. |
| 5   | **Incision & Drainage of Abscess** → needle, _Distinct collections_ `5`                           | Suggestion **10160 × 5**, plus a warning that 5 exceeds the usual daily allowance of 3 — quantity left as documented.                                                              |
| 6   | **Diagnostic EKG** → component furnished _tracing and report_, then add **93005** by hand         | Suggestion 93000; documentation check says the documentation supports the full recording while a component-only code is selected.                                                  |
| 7   | **Burn Treatment / Dressing** → _partial thickness_, 3% body surface                              | Suggestion **16020**.                                                                                                                                                              |
| 8   | **X-Ray** (an AI type) → write anything in the narrative, wait ~5 s                               | Spinner, then "Possible CPT codes — AI suggestions" marked _Clinician review required_. Nothing is marked supported — AI does not check documentation.                             |
| 9   | Save any of the above, reopen the procedure                                                       | Answers come back as saved and the same suggestion is recomputed; the saved answers also appear in the visit summary and the visit-note PDF.                                       |
| 10  | Apply a quick-pick or a template that has procedure answers                                       | The form prefills; the suggestion recomputes from what is on the form, not from what was saved.                                                                                    |

If a row above does not behave as written, the bug is real: the same expectations are asserted in
the rule book, so a failing rule fails the test suite too.

## Known limits

- Payer-specific behaviour is shown as advisory notes, not applied automatically from the patient's
  insurance.
- Those six AI types have suggestions only — no missing-documentation prompts, no code checking.
- Fracture-treatment codes are not suggested: when a splint is part of definitive fracture care the
  splint code is withheld and the message points at the CPT search.
