# Self-Service PDF Forms: Follow-On Work

Two enhancements deliberately left out of the initial feature. Neither blocks it; both were identified while
building it, and are recorded here so the reasoning survives into the tickets rather than being rediscovered.

**Part I** covers binding a group of form fields to a variable-length collection from the encounter —
medications, labs, diagnoses — with the concrete instance chosen at fill time. **Part II** covers letting a
model propose an initial mapping for an admin to review.

---

## Part I — Collection bindings

### 1. The gap

A binding today is one PDF field to one token, resolving to a scalar. That covers everything whose cardinality
is known when the admin authors the mapping: a name, a date of birth, a member ID.

It does not cover anything generated per encounter and variable in length — medications prescribed, labs
ordered, diagnoses made, procedures performed. The catalog currently handles diagnoses by flattening:
`diagnosis.allDisplays` joins every diagnosis into one comma-separated string and hopes the field is wide
enough. That is the degenerate form of what this part describes, and should become a fallback rather than the
mechanism.

### 2. What the forms actually ask for

Two distinct shapes, both present in the same corpus, and they are not equally hard.

| Shape | Evidence | What it needs |
| --- | --- | --- |
| **Pick-one** — a group of scalar fields describing a single chosen instance | CA prior auth: `Medication Name:`, `Dose/Strength:`, `Quantity:`, `Length of Therapy/#Refills:`. Texas: `Requested Drug Name:`, `Strength:`, `Quantity:`, `NDC` | A group id, member tokens, and a picker |
| **Fill-a-table** — N rows fed from N list items | Texas: `NDC #_Row_1…6`, `Quantity_Row_1…6`, `Drug Name_Row_n`, `Strength_Row_n` | All of the above, plus repeat detection and an overflow rule |

Pick-one is most of the value for a fraction of the work, and fill-a-table is the same machinery repeated.
They should ship in that order rather than as one thing.

### 3. Shape of the solution

A second binding axis: today `field → token`, adding `field-group → collection`, with member tokens inside the
group. The existing architectural seam is unchanged — it gains a parallel structure.

| | Static, known at mapping time | Per encounter, resolved at fill time |
| --- | --- | --- |
| Scalars (today) | `TOKEN_CATALOG` in `utils` | `TOKEN_RESOLVERS` in zambdas |
| Collections (proposed) | Collection descriptors: key, label, member-token shape | The list of instances |

`checkCompatibility` carries over untouched: a member token still has a type and still has to meet a field of
some type, so the whole existing validation path applies to group bindings for free.

### 4. The invariant that must not be broken

**Selection is per fill, not per mapping.** The mapping records that a group binds to a collection and which
member token fills each field. *Which* medication the provider picks is transient fill state and must never be
written into `FormTemplateMapping`.

A mapping is encounter-independent — that property is the only reason an admin with no patient in scope can
author one at all. A picker that persists its choice back into the mapping quietly converts a reusable
template into a one-patient artifact, and nothing in the type system would catch it.

### 5. What is hard

1. **Declaring the group.** For pick-one this is nearly free: tag several fields with a group id and give each
   a member token, which is the existing per-field binding UI plus one attribute. Tables need the repeat
   structure. We already persist `position: {page, x, y, width, height}` per field, so rows are inferable by
   clustering on shared y-bands with matching x-offsets. The Texas form names its fields `_Row_n`; that is
   luck, not a mechanism, and must not be relied on.

2. **Cardinality mismatch** (tables only). Six rows in the PDF, nine medications in the chart. This needs an
   explicit overflow rule and it must be visible to the provider. Silently dropping the seventh drug from a
   prior-authorisation form is the same failure class the field overlay exists to prevent: output that looks
   correct and is wrong. Under-fill is harmless.

3. **The picker is a new surface** in the fill flow, which does not exist until prefill ships. This work is
   therefore strictly downstream of it.

### 6. Collections available

From `AllChartValues`: `prescribedMedications`, `inhouseMedications`, `medications`, `diagnosis`, `procedures`,
`radiologyOrders`, `externalLabResults`, `inHouseLabResults`, `cptCodes`, `conditions`, `surgicalHistory`,
`instructions`, `episodeOfCare`, `birthHistory`, `allergies`.

**Immunizations are not in `AllChartValues`.** If immunization tables are in scope, that data lives elsewhere
and needs its own lookup — worth confirming before it is promised anywhere.

### 7. Open questions

- What is the overflow rule, and how is it surfaced?
- Default ordering for tables — chart order, or provider-arranged?
- Should a pick-one group prefill a default (most recent? the one the visit is about?) or start empty?
- Can one form carry two groups bound to the same collection, and does anything break if it does?

---

## Part II — LLM-assisted initial mapping

### 1. The problem

Mapping a form is a long sit — the CA prior-authorisation form has 90 fields. Roughly half of the mappable
fields on a typical form correspond to no chart concept at all, so the admin is also absorbing the cost of
deciding what *cannot* be mapped.

### 2. Why this belongs at mapping time

The inputs are the field inventory (labels, types, options, positions) and the token catalog (keys, labels,
types). Both describe **structure** — a blank form and a schema. There is no patient and no encounter, because
the admin authoring a mapping has neither in scope by construction.

**No PHI reaches the model.** That keeps a whole class of compliance questions off the table, and it is a
property to preserve deliberately rather than one to enjoy by accident: this must not drift into a fill-time
feature, where the model would be looking at chart values on their way onto a form.

### 3. Inputs already exist

`FormFieldInfo[]` is produced by analysis and persisted on the DocumentReference extension; `TOKEN_CATALOG` is
plain data in `utils`. Assembling the request requires nothing new.

### 4. Proposal, never application

The model proposes and the admin confirms. Suggestions are never auto-saved.

Two mechanical filters run before a suggestion is ever shown:

- `checkCompatibility` rejects any binding whose token type cannot meet the field type. The model proposes, the
  matrix filters — this is already built.
- Fields no catalog token could bind to are already excluded from the mapping UI.

### 5. Where it helps, and where it is dangerous

It helps most on forms that are long but unambiguous. It is dangerous in exactly the place that motivated
building the PDF overlay. Measured on the CA prior-authorisation form:

| | |
| --- | --- |
| Total fields | 90 |
| Distinct `/TU` labels | 74 |
| Labels appearing more than once | 10, covering 26 fields |

The collisions are `First Name:` ×2, `Last Name:` ×2, `Address:` ×2, `City:` ×2, `State:` ×2, `Zip Code:` ×2,
`Phone Number:` ×2, `Patient ID Number:` ×2 — patient and prescriber blocks, distinguishable only by which
part of the page they sit on. A model given labels alone will bind the prescriber's address to the patient's,
producing a form that looks right and is wrong.

Two consequences: field positions must be part of the model's input, not just labels; and the overlay is what
makes a wrong suggestion cheap to catch, so this feature depends on it.

### 6. Evaluating it

There is a corpus of real forms to work against. Hand-map one or two as a gold standard, then measure proposals
against it. **Precision matters more than recall**: a missing suggestion costs the admin a few seconds, while a
wrong suggestion that gets accepted goes to a payer.

### 7. Open questions

- Is a confidence signal surfaced per suggestion, or is it accept/reject per row?
- Does this run in a zambda, and which model?
- Re-run automatically when a template's PDF is replaced? Replacement currently reconciles bindings by field
  name, which is exactly where a proposal would be most useful and most likely to be wrong.
