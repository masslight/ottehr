# Procedure Coding Assistance — technical design

## 1. Purpose and product contract

Procedure Coding Assistance is an advisory feature on the EHR procedure page. It solves two related
problems for one procedure entry:

1. **Code Suggestion** derives the CPT/HCPCS code supported by the documented facts. If a required
   determinant is missing, it asks for that fact instead of guessing.
2. **Documentation Defense** checks every selected code against the same facts and reports whether
   the code is supported, unsupported, or outside the implemented rules.

The feature is deterministic TypeScript. It replaced the previous AI recommendation call and does
not make network requests.

The product contract is:

- the provider remains responsible for the chart and must explicitly add a suggested code;
- the feature never changes documentation or selected codes automatically;
- a finding never blocks Save;
- a green status means that the note supports the code within this engine's modeled CPT rules;
- green does not promise payer acceptance or complete payer-specific audit readiness;
- unmodeled and ambiguous cases are reported as **not assessed** rather than inferred;
- guidance is phrased as documentation completeness, not as encouragement to select a higher-paying
  code.

`CPT_RULES_VINTAGE` is included in every evaluation result so a result can be tied to a ruleset. Its
current value is `CPT 2026`. This label is version metadata, not evidence that every rule has received
an independent external review.

## 2. Supported scope

The registry contains eleven rule-based procedure families and four fixed-code models. The fixed-code
models share one source module.

| Family                             | Assessed codes or ranges                                                                                                                                           | Important exclusions                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Laceration repair                  | 12xxx simple, intermediate, and complex repair tables, including applicable add-ons; G0168 may be shown as a payer-dependent alternative for adhesive-only closure | Cases that cannot be placed in a modeled site, class, or length band                                  |
| Incision and drainage              | 10060, 10061                                                                                                                                                       | Site-specific or different services such as 10080/10081, 10140, 26010/26011, 46050/46060, 69000/69005 |
| Splinting and strapping            | The application and strapping table in `families/splinting.ts`, including thumb spica 29125/29126                                                                  | Supplies and DME billing are not inferred                                                             |
| Foreign-body removal               | 10120/10121, 30300, 65220/65222, 69200                                                                                                                             | 30310, 65205, 65210, 67938, 69205 and other unmodeled sites/settings                                  |
| Impacted cerumen removal           | 69209 for irrigation/lavage; 69210 for instrumentation                                                                                                             | Non-impacted cerumen and services outside these two methods                                           |
| Injection, hydration, and infusion | 96372, 96374, 96360/96361, 96365/96366                                                                                                                             | Administration types and timing rules not represented by this family                                  |
| Diagnostic EKG                     | 93000, 93005, 93010                                                                                                                                                | 93040–93042                                                                                           |
| Burn treatment                     | 16020, 16025, 16030 for partial-thickness treatment                                                                                                                | 16000 and full-thickness treatment                                                                    |
| Benign lesion destruction          | 17110, 17111                                                                                                                                                       | Skin tags, vascular lesions, and premalignant lesions                                                 |
| Urinary catheterization            | 51701, 51702                                                                                                                                                       | Complicated catheterization 51703                                                                     |
| Nasal packing/cautery              | 30901, 30903, 30905                                                                                                                                                | 30906                                                                                                 |
| Nursemaid's elbow reduction        | Fixed model: 24640                                                                                                                                                 | Other reductions                                                                                      |
| Nail trephination                  | Fixed model: 11740                                                                                                                                                 | Other nail procedures                                                                                 |
| Nebulizer treatment                | Fixed model: 94640                                                                                                                                                 | Other respiratory services                                                                            |
| IV catheter placement              | Fixed model: 36000                                                                                                                                                 | Other vascular-access services                                                                        |

X-Ray and every other unsupported procedure type are outside this feature. An unsupported selected
code cannot pull an explicitly excluded procedure type into a supported family.

Detailed code tables belong beside their family rules and tests. This table defines feature scope; it
is not a substitute for the executable mapping.

## 3. System overview

```text
Procedure form state
        |
        v
procedureFactsFromPageState -> ProcedureFactsInput
        |
        v
detectProcedureFamily
  exact display -> explicit exclusion -> unique regex -> selected-code fallback
        |
        v
ProcedureFamilyModel
  suggestCode (forward) + defendCodes (inverse)
        |
        v
EvaluationResult
  family + outcome + findings + per-code assessments + payer notes + rules vintage
        |
        v
Coding Assist UI
```

The engine is in `packages/utils/lib/procedure-coding` and has no React or FHIR dependency. The EHR
projects form state into a plain input object, evaluates it after a short debounce, and renders the
common result contract.

### Main modules

| Module                        | Responsibility                                                             |
| ----------------------------- | -------------------------------------------------------------------------- |
| `model.types.ts`              | Input, evidence, finding, outcome, assessment, and family contracts        |
| `family-routing.ts`           | Supported display aliases, fallback patterns, and explicit exclusions      |
| `evaluate.ts`                 | Family registry, routing order, forward/inverse entry points, metadata     |
| `extract.ts`                  | Shared text normalization and extraction primitives                        |
| `family-support.ts`           | Common finding and defense composition helpers                             |
| `families/*.ts`               | Family-specific fact extraction, decision tables, code metadata, and rules |
| `fields.ts`                   | Conditional structured-field visibility and cleanup                        |
| `procedurePageState.ts`       | EHR page state to `ProcedureFactsInput` projection                         |
| `useProcedureCoding.ts`       | Debounced evaluation and temporal UI state                                 |
| `CodingAssistPanel.tsx`       | Suggestion and defense presentation                                        |
| `CodingFindingList.tsx`       | Entry- and code-scoped finding rendering                                   |
| `ConditionalCodingFields.tsx` | Length, repair-depth, and infusion-time controls                           |

## 4. Input model and sources of facts

`ProcedureFactsInput` is a read-only snapshot used by the engine. It does not create a second medical
record. It projects values already held by the procedure page:

- selected Procedure Type;
- body site and side;
- technique, supplies, medication, performer, response, and instructions;
- free-text Procedure details;
- selected CPT codes;
- the feature's conditional structured fields.

Rules can use both structured fields and narrative text. Structured values are preferred where a
family explicitly defines that precedence. When a structured value and narrative disagree, the
family can create an entry-level contradiction instead of silently choosing one.

Every extracted fact used in a finding records provenance:

- `EvidenceSource.Text` contains the matched snippet;
- `EvidenceSource.Field` identifies the structured field;
- `EvidenceSource.Absence` represents a missing fact that has nothing to quote.

This prevents a field-derived assertion from being displayed as a quotation from the note.

## 5. Procedure-family routing

Procedure Type is currently stored and passed to the engine primarily as display text. Deployments may
offer different ValueSet displays, so routing cannot rely on only one UI label.

`family-routing.ts` contains one deployment-neutral catalog:

- normalized exact display aliases for supported families;
- family-specific fallback regular expressions;
- exact and pattern-based exclusions for known out-of-scope procedures.

Matching is case-insensitive after normalization. The router uses this order:

1. exact supported display;
2. explicit not-assessed display or exclusion pattern;
3. exactly one family pattern match;
4. selected-code fallback for blank, legacy, or otherwise unknown types.

If multiple family patterns match, routing fails closed and returns not assessed. It never selects the
first regex by array order.

The catalog includes the known current and archived Procedure Type displays present in committed
configuration snapshots. Tests enforce normalized exact-label uniqueness, registry parity, separation
between supported and excluded labels, and at most one family-pattern match for the known labels.

The engine does not import deployment configuration at runtime. Therefore a new or renamed display in
a deployment configuration must also be added to the routing catalog and its tests. The preferred
long-term contract is a stable canonical family identifier stored with Procedure Type configuration;
display aliases and regex routing should then remain only as legacy compatibility.

## 6. Family model and rule flow

Every family implements `ProcedureFamilyModel`:

- detection by Procedure Type and selected code;
- `structuredFieldsFor` for conditional form inputs;
- `suggestCode` for forward evaluation;
- `defendCodes` for inverse evaluation.

A rule-based family normally has four internal stages:

1. extract typed medical facts from fields and text;
2. resolve conflicts and missing determinants;
3. apply family-specific decision tables;
4. compose the shared outcome, findings, and code assessments.

Rules such as repair class, anatomical group, length band, infusion duration, or EKG interpretation
elements are family-specific. Shared helpers provide mechanics such as evidence, finding scope,
negation guards, length parsing, and assessment composition; they do not decide the medical mapping.

The laceration family also contains family-specific wound-length reconciliation and repeat-value
deduplication. That heuristic must not be treated as a generic multi-procedure algorithm.

## 7. Forward result contract

The forward outcome is a discriminated union. Exactly one variant is present:

| Outcome                    | Meaning                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `Determined`               | All determining facts support one primary suggestion                                    |
| `DeterminedWithAlternates` | One primary suggestion plus an explicitly explained payer/setting-dependent alternative |
| `Open`                     | Determinants are missing; candidates and a summary explain what can narrow the set      |
| `NotAssessed`              | The entry is outside or too ambiguous for the modeled rules                             |
| `NoCode`                   | Documented facts affirmatively support no code in the family                            |
| `NotApplicable`            | This evaluation direction does not answer a forward-suggestion question                 |

The union prevents invalid combinations such as an open result with no candidates, an unexplained
alternative, or a not-assessed result with no reason. UI switches are exhaustive: adding a new outcome
variant causes a TypeScript error until its presentation is implemented.

## 8. Defense, findings, and green support

The inverse direction evaluates selected codes. Each selected code receives exactly one assessment:

- `Supported`;
- `Unsupported`;
- `NotAssessed`.

Findings explain the assessment. A finding has a requirement level:

| Level           | Effect                                                                               |
| --------------- | ------------------------------------------------------------------------------------ |
| `determines`    | Missing or conflicting fact prevents a supported verdict because it selects the code |
| `required`      | Missing documentation required to support the selected code prevents green           |
| `contradiction` | Documented facts conflict with the selected code and prevent green                   |
| `bestPractice`  | Reminder only; it can appear together with green                                     |

Findings are either `Entry` scoped or `Code` scoped. Entry findings describe the procedure record as a
whole, such as disagreement between a structured field and narrative. Code findings are grouped under
the selected CPT code they evaluate.

The confirmed documentation policy for the less obvious elements is:

| Family                  | Blocks green                                                                  | Reminder only                                       |
| ----------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------- |
| Splinting               | Pre- and post-procedure neurovascular examinations                            | Splint material                                     |
| I&D                     | Documented complexity for selected 10061                                      | Dressing, lesion size, anesthesia                   |
| Foreign body            | Complete removal, post-removal examination, laterality where applicable       | Family-specific nonessential details                |
| EKG                     | Rate, rhythm, axis, intervals, ST-T assessment, impression for interpretation | None of these six elements                          |
| Urinary catheterization | Catheterization type must match 51701/51702; documented outcome               | Indication                                          |
| Nasal packing/cautery   | Laterality and hemostasis                                                     | Non-determining details                             |
| Burn                    | Depth, size, and treatment type                                               | Location when size and depth are already documented |
| Lesion destruction      | Location, lesion count, and destruction method                                | Anesthesia                                          |

The principal cross-direction invariant is: when `suggestCode` determines a code from a set of facts,
`defendCodes` must not contradict that same code for the same facts. Contract tests run this invariant
across the registry. Best-practice reminders do not violate it because they do not make the code
unsupported.

## 9. Free-text extraction

The current extractor is regular-expression and rule based. It supports known clinical terms,
abbreviations, units, and selected shorthand. Shared normalization includes Unicode NFKC and common
typographic/unit normalization.

Negation handling uses bounded clause windows around a match. It checks both sides so phrases such as
`undermining was not performed` and `no instrumentation; irrigation only` do not become positive
facts. These are conservative heuristics, not general clinical-language understanding. Typos,
dictation artifacts, unusual grammar, distant context, and unseen terminology can still be missed or
misclassified.

The safe behavior for an unresolved text fact is to ask for structured clarification or return not
assessed. A regex match alone is never evidence that arbitrary real-world clinical prose is fully
understood.

`MAX_ANALYZED_TEXT_LENGTH` is currently applied by shared normalization helpers, but not every family
passes narrative through the same path. There is also no UI warning when text is truncated. Global
normalization at the projection boundary plus an explicit truncation flag is a remaining technical
improvement.

## 10. Conditional structured fields

The feature adds three conditional field groups:

| Field                   | Visibility                                                                         | Storage                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Wound/lesion size in cm | Laceration, I&D, and foreign-body families                                         | ServiceRequest extension `length-cm`, `valueDecimal`                                               |
| Repair depth            | Laceration family                                                                  | ServiceRequest extension `repair-depth`, `valueString`                                             |
| Infusion start and stop | Timed hydration or therapeutic infusion entries; not IM injection, IV push, or I&D | ServiceRequest extensions `infusion-start-time` and `infusion-stop-time`, `valueString` in `HH:mm` |

The source requirements visually nested infusion times under I&D, but their medical and implemented
scope is the injection/infusion family. I&D never exposes infusion timing fields.

`family.structuredFieldsFor()` declares what the current entry needs. `procedureFieldVisibility()`
combines that declaration with persisted values so historical data remains visible on read-only
surfaces. When an editable entry changes family, irrelevant hidden values are cleared rather than
saved as stale data.

These fields are implemented by shared EHR code, not by each deployment's Procedure Type ValueSet.
No per-deployment form-layout change is required, but the selected Procedure Type display must route
to the correct family.

## 11. Persistence and downstream surfaces

The conditional values are provider-entered clinical facts, not facts created by regex extraction.
They are persisted because the same documentation must survive reloads and appear throughout the
record.

The implementation carries them through:

- procedure page state and drafts;
- ServiceRequest FHIR serialization and reading;
- save-chart-data validation;
- Quick Picks;
- Global Templates;
- progress and follow-up notes;
- visit-note and discharge-summary PDFs.

Quick Pick application merges CPT codes without duplicate codes, preserves the selected reusable
procedure configuration, combines supported `Other` values, omits encounter-specific data, and clears
structured values that are not relevant after the resulting family is known. Persistence happens
after the React state update rather than during render.

Infusion times currently use FHIR extension `valueString` because the entire existing boundary uses
validated `HH:mm` strings. A future migration to `valueTime` would require coordinated reader/writer
compatibility; it is not an isolated type replacement.

## 12. Payer-dependent behavior

The engine receives neither payer nor claim setting. It therefore does not calculate payer-specific
eligibility, modifiers, bilateral rules, units policy, or NCCI bundling.

When a modeled rule has a payer-dependent branch, the base CPT result remains intact and the unresolved
part is exposed as informational `payerNotes` or an explained alternate. `CodingFindingList` deduplicates
identical payer notes before rendering. This does not imply that the feature knows the payer.

G0168 is the primary current example: it may be shown next to the applicable repair code as a
payer/setting-dependent alternative, but the feature does not choose the claim-specific answer.

## 13. UI behavior

`useProcedureCoding` evaluates the same snapshot in both directions after a 500 ms debounce. Its
temporal state is a union:

- `Evaluating`, optionally carrying the previous result only when it belongs to the same family;
- `Ready`, carrying both current suggestion and defense results.

This prevents a result from the previous procedure family flashing after Procedure Type changes.

The UI is family-agnostic. It renders the shared outcomes, assessments, evidence, findings, and payer
notes; medical decisions remain in family modules. Adding a family does not require a medical-family
switch in React. Adding a new shared outcome or evidence variant does require its renderer to be
implemented, and exhaustive switches enforce that at compile time.

## 14. Tests and invariants

The test suite is organized around boundaries rather than only individual examples:

- family tests cover extraction, decision tables, suggestions, and defense findings;
- `family-contract.test.ts` checks shared contracts and cross-direction consistency;
- `family-routing.test.ts` checks alias uniqueness, exclusions, ambiguity, and registry parity;
- `valueset-contract.test.ts` checks the committed base Procedure ValueSet against known routing and
  intentionally unused values;
- EHR component tests cover conditional fields, debounce state, add-code action, and finding rendering;
- persistence tests cover FHIR, Quick Picks, Global Templates, notes, and PDFs.

Required invariants are:

1. The same input and ruleset produce the same result.
2. A forward-determined code is not contradicted by inverse evaluation of the same facts.
3. Unknown, excluded, or ambiguous cases do not receive a supported verdict.
4. `determines`, `required`, and `contradiction` findings block green; `bestPractice` does not.
5. Text evidence carries its snippet; field evidence identifies its field.
6. Entry findings are not assigned to an arbitrary selected code.
7. Payer uncertainty does not change the base CPT verdict without payer input.
8. Evaluation never mutates form input and never blocks Save.
9. Hidden irrelevant fields are cleared from editable state; persisted historical values remain
   available to read-only surfaces.

## 15. Known limitations and next design steps

These limitations are real and should not be hidden by test coverage:

1. **Narrative extraction is brittle.** Regex and clause-window heuristics cannot robustly parse all
   clinical prose. A future extractor may use an AI model to produce typed facts, while retaining the
   deterministic routing, medical rule tables, evidence contract, defense logic, and advisory UI.
2. **Routing still depends on display text.** The exact alias catalog is safer than regex-only routing,
   but configuration drift is possible. Add a stable canonical family identifier to Procedure Type
   configuration and persist it for new records; keep aliases and selected-code fallback for legacy
   records.
3. **Configuration tests are snapshots.** They validate committed configurations known to this
   repository, not future deployment changes. Configuration generation or CI should validate new
   displays against the catalog.
4. **Text length handling is inconsistent.** Normalize and cap narrative once before family
   evaluation, propagate whether truncation occurred, and show a neutral UI warning.
5. **No payer context exists.** Do not expand payer-specific claims until payer and claim-setting input
   and authoritative rules are available.
6. **Rules vintage needs a review process.** Updating `CPT_RULES_VINTAGE` must accompany reviewed rule
   tables, code metadata, and tests; changing the string alone is insufficient.
7. **Infusion time storage is string-based.** Keep strict boundary validation until a deliberate FHIR
   migration is implemented.

## 16. Extending the feature

For a new family or code range:

1. define the exact supported procedure types, assessed codes, exclusions, determining facts,
   green-blocking requirements, reminders, and payer-dependent boundaries;
2. add family-local code constants, metadata, and decision tables;
3. implement the `ProcedureFamilyModel` and register it in `evaluate.ts`;
4. add exact display aliases and a narrow fallback pattern to `family-routing.ts`;
5. add structured fields only when existing form data cannot represent a required provider-entered
   fact;
6. test forward and inverse behavior together, including ambiguous text, negation, exclusions, and
   the cross-direction invariant;
7. if a new field is necessary, update every persistence and presentation boundary listed in section
   11;
8. obtain coding review for the medical mapping before changing the rules vintage.

Do not start a family by accumulating regexes. Start with a decision table that separates facts that
select a code, facts required to defend it, reminders, contradictions, and explicitly unassessed
cases. The extractor is an input adapter to that table, not the medical rule itself.
