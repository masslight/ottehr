# Self-Service PDF Forms: Follow-On Work

Work deliberately left out of the initial feature. None of it blocks shipping; all of it was identified while
building, and is recorded here so the reasoning survives into the tickets rather than being rediscovered.

**Part I** covers binding a group of form fields to a variable-length collection from the encounter —
medications, labs, diagnoses — with the concrete instance chosen at fill time. **Part II** covers letting a
model propose an initial mapping for an admin to review. **Part III** covers extending the provenance guard,
built for the forms flow, to the general document upload path that currently bypasses it. **Part IV** records
why completed forms are kept out of the fax packet, and what including them would take.

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

---

## Part III — Bringing the generic document upload under the provenance guard

Shipped in the forms flow, deliberately not extended to the rest of the application. Recorded here because
the gap is a disclosure risk rather than a tidiness problem.

### 1. What is guarded today

| Path | Guarded |
| --- | --- |
| Forms card → *Return completed* | Yes. `create-completed-form-upload-url` writes nothing; `save-completed-form` reads the stamp, compares it to the patient resolved from the appointment, and creates the `DocumentReference` only if they agree. |
| Patient Documents explorer → upload | No. `create-upload-document-url` mints the presigned URL **and** creates the `DocumentReference` in the same call, before any bytes exist. Nothing reads the stamp. |

A provider who uploads a completed form through Patient Documents out of habit bypasses the check
completely — and that provider is the one the control exists for. The card's wording and the "Saved to
chart" marker nudge toward the guarded path; neither prevents the other one.

### 2. Why the existing endpoint cannot simply be extended

Every upload path in the codebase is presign-then-direct-to-storage: `create-upload-document-url`,
`upload-patient-condition-photo`, `upload-audio-recording` and `upload-dot-vision-document` all hand back a
URL, and the browser PUTs to it. **The server never sees an uploaded file.** At the moment the endpoint
runs there is nothing to inspect, so the check cannot live inside it as written.

### 3. Two ways to close it

**Adopt the inverted pattern.** Split the endpoint the way the forms flow is split: presign writes nothing,
and a second call verifies and then creates the record. Removes the guard gap and, as a side effect, a
pre-existing bug — a failed PUT currently leaves a `DocumentReference` on the chart pointing at an object
that was never written, with no cleanup anywhere. The cost is a contract change for every caller of
`create-upload-document-url`.

**Add a verification call after the PUT.** Cheaper, and it leaves the contract alone, but it is a
compensating control: the wrong document exists on the chart until the second call removes it, and a client
that skips the call is unprotected.

The first is the better shape and the one the forms flow now models.

### 4. What it does not need

No new stamp format, no per-type configuration, and no change to the guard's logic. `DocumentProvenance`
and its read/write helpers live in `packages/zambdas/src/shared/`, outside the forms feature, and the guard
keys on the stamp's presence rather than on what kind of document it is. A workflow adopts it by changing
the shape of its upload, not by registering with anything.

### 5. Open questions

- Does an unstamped upload stay silently accepted forever, or is stamping eventually expected of everything
  this system generates?
- Should a refused upload be recorded — an attempt to file another patient's document onto a chart is
  arguably an auditable event, and today it leaves only a log line.

---

## Part IV — Completed forms and the fax packet (decided against, for now)

Recorded because "why aren't completed forms faxed?" is a question the code does not answer on its own.

### 1. What happens today

Completed forms are **not** included in the "Fax Patient Docs" packet. They can be faxed **individually**
from the documents list.

The two paths are built on different rules, and each is right for its job:

| Path | Rule |
| --- | --- |
| Fax packet (`findVisitDocuments`) | A closed enum of five kinds, each found by an explicit `type` code — progress note, discharge summary, lab results, radiology results, patient education. |
| Per-document fax (`isDocumentFaxable`) | Permissive: everything qualifies whose stored attachment is a format a fax can carry, minus two type codes that would fail downstream. |

### 2. Why they miss the packet

Every packet kind is keyed on `type`. Completed forms deliberately have no fixed type code — clinical type
varies per template, so `type` is inherited from the template and `category` carries the "this is a form
instance" fact. The decision that keeps forms flexible is the same one that makes them invisible to a
type-keyed collector; they would have to be found by `category` + `docStatus`, an axis no other kind uses.

### 3. Why it stays that way

The packet's value is that its contents are predictable. Admin-authored forms are heterogeneous — some
belong with a records request, some emphatically do not — and sweeping them in would mean an unrelated form
travelling to a payer because it happened to be returned on the same visit. Individual faxing already
covers the cases that need sending, so nothing is stuck.

Revisit if product asks for custom forms in the packet explicitly.

### 4. What including them would take

A sixth `FaxDocumentKind`, a label, an entry in `FAX_DOCUMENT_ORDER`, and one search keyed on category
rather than type. Three things would need deciding first:

- **Drafts must be excluded** — `docStatus: final` only. The `hide-while-preliminary` tag does not help
  here; the collector would need its own filter. Faxing a half-filled prefilled draft to a payer is the
  failure to avoid.
- **One checkbox or several.** All completed forms under a single kind makes a visit with three returned
  forms all-or-nothing, which is exactly the imprecision that argued against inclusion.
- **`related` vs `encounter` scoping.** Form instances set `context.encounter`, but the progress note is
  found by `related=Appointment`, so confirm which the dialog scopes by.
