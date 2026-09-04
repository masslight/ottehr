# Self-Service PDF Forms

Moving the Forms section of the patient chart from a deploy-time list of checked-in PDFs to a set of form
templates that EHR admins author themselves.

This document is written in parts. **Part I** covers admin authoring of form templates: upload, storage, the
FHIR data model, and the chart-side read path; everything but the UI for defining a mapping scheme from the
encounter context, which is considered separately. **Part II** deals with the design for defining a mapping
between the available encounter context and the fields detected in the PDF form, prefilling the form when it
is opened by a provider, and persisting the completed form.

---

## 1. What exists today

The Forms section is a ~33-line component and one PDF checked into the repo. There is no PDF machinery of our
own anywhere on this path.

| Piece | Where |
| --- | --- |
| The card | `apps/ehr/src/features/visits/shared/components/FormsCard.tsx` |
| Mount (telemed/shared Plan tab) | `apps/ehr/src/features/visits/shared/components/plan-tab/PlanTab.tsx:43` |
| Mount (in-person Plan page) | `apps/ehr/src/features/visits/in-person/pages/Plan.tsx:38` (hidden for follow-ups) |
| Row rendering | `plan-tab/components/ExcuseLink.tsx` — a MUI `Card component={Link} target="_blank"` |
| The list | `packages/utils/lib/ottehr-config/forms/index.ts` — one hardcoded entry |
| Types / zod | `packages/config-types/config/forms.ts` |
| The file | `apps/ehr/public/dwc073.pdf` (259 KB, contains an `/AcroForm` dictionary) |
| Feature flag | `formsEnabled` → `apps/ehr/src/constants/feature-flags.ts:12` |

The single configured entry is `Texas Workers Compensation Form DWC073` → `/dwc073.pdf`.

**How the "fill it out in the browser" experience actually works today:** it isn't ours. Because `ExcuseLink`
uses `target="_blank"`, the row is a plain full navigation to a static asset in `apps/ehr/public`. The
browser's built-in PDF viewer renders the AcroForm fields baked into the file and handles typing and saving.

- **No prefill.** Nothing from the chart, patient, or encounter reaches the PDF. The provider retypes everything.
- **No persistence.** The filled copy lands in the user's Downloads folder. The card's own body text tells the
  user to upload it back manually via Patient Documents (`FormsCard.tsx:20-24`).
- **No backend.** No zambda participates in the Forms section.

### Why change it

Adding or changing a form requires a code change, a PR, and a deploy — and the resulting list is the same for
every Ottehr instance. Customers need to manage their own forms.

---

## 2. Scope of Part I

**In:** an admin page to upload, edit, draft/publish, and remove form templates; storage of the PDF and its
metadata; the chart-side read path that replaces `FORMS_CONFIG`.

**Out, deliberately:**

- **Filtering / categorization of forms by encounter context** (state, service mode, visit type, employer).
  The list is global for v1. `DWC073` is a Texas-specific workers-comp form and is currently shown on every
  visit in every state — that is a real defect, but choosing the right abstraction for splitting forms into
  system-defined categories is deferred rather than guessed at. The data model below reserves the slots this
  will need, so adding filters later is extra search params and predicates, not a re-architecture.
- **Ejecting Locations-style TF management.** Desirable, not a v1 blocker. The seeded DWC073 ships via a
  starter-seed path that does not touch Terraform (§7). *(This could maybe just be removed for most projects.
  It seems specific to a certain practice — one that does workers comp in TX.)*

---

## 3. Data model

Form templates are org-level, not patient-level: a **subject-less `DocumentReference`** whose PDF lives in a
non-patient Z3 bucket. This mirrors the existing **Approved Patient Education** feature
(`packages/zambdas/src/ehr/save-approved-patient-education/index.ts`), which is the closest working precedent
in the codebase.

### 3.1 Field mapping

| Concern | DocumentReference Field | Value / notes |
| --- | --- | --- |
| Set membership (**the query**) | `category` (0..*) | `https://fhir.ottehr.com/CodeSystem/document-category\|form-template` |
| Domain kind | `type` (0..1) | unset — reserved to allow attaching LOINC codes if desired (hidden in v1, but point here is that we are using `category` rather than `type` to identify these DRs as belonging to a general system module and leaving `type` to serve its intended semantic purpose, avoiding a mistake made in the patient education feature modeling) |
| Stable business key | `identifier` (0..*) | Ottehr system, one per template |
| Title | `content[0].attachment.title` | |
| Description | `description` | |
| Draft vs. published | `docStatus` | `preliminary` → `final` |
| Soft delete | `status` | `current` → `superseded` |
| The PDF | `content[0].attachment.url` | Z3 URL, `contentType: application/pdf` |
| Subject | — | absent |

### 3.2 Rejected: an index `List` resource

Patient education registers each approved DocumentReference in a singleton `List` with a well-known
identifier, and queries that List with `_include`. We are not doing this. `type`/`category`-style searches are
well-trodden here (`type` is the most-used DocumentReference search param in the zambdas, 8 call sites), so
the List buys nothing but a second resource that must be kept transactionally in sync on every create/delete.

### 3.3 Draft and delete semantics

`docStatus` and `status` are different fields and do different jobs:

- **`docStatus`** describes the *document*. R4B binds it to `preliminary | final | amended | entered-in-error`.
  The repo already has the convention we want: `PdfDocumentReferencePublishedStatuses` at
  `packages/zambdas/src/shared/pdf/pdf-utils.ts:44-54` maps `unpublished → preliminary`, `published → final`,
  with an `isDocumentPublished()` helper. Non-published DocRefs will be excluded from the list in the patient
  chart. *(Note: not a query param; in-memory filter handle only.)*
- **`status`** describes the *reference*, and is a FHIR modifier element. `current → superseded` gives
  soft-delete essentially for free. Hard delete stays a separate, guarded action that also removes the Z3
  object. Non-current DocRefs will be excluded from the chart.

---

## 4. Storage

The PDF goes to a **non-patient** Z3 bucket. `makeZ3FileUrl`
(`packages/zambdas/src/shared/presigned-file-urls/helpers.ts:28`) is the non-patient variant — it omits the
`patientID` path segment that `makeZ3Url` requires. Precedents for org-level buckets already exist in
`BUCKET_NAMES` (`packages/utils/lib/fhir/constants.ts:599`): `PATIENT_EDUCATION_ADMIN`,
`SCHOOL_WORK_NOTE_TEMPLATES`.

Add `FORM_TEMPLATES: 'form-templates'` to `BUCKET_NAMES`.

**Upload transport: presigned URL + direct `PUT` from the browser**, as Patient Documents does
(`create-upload-document-url` → `apps/ehr/src/hooks/useGetPatientDocs.ts:623-688`). Not the
base64-through-the-zambda approach that `save-approved-patient-education` uses — PDFs with embedded fonts run
large and base64 payloads hit the Lambda request-body limit.

---

## 5. Backend (proposed)

New zambdas under `packages/zambdas/src/ehr/`:

| Zambda | Job |
| --- | --- |
| `create-form-template-upload-url` | Validate, mint the Z3 URL + presigned upload URL, create the `DocumentReference` in `preliminary` (see validation notes below) |
| `list-form-templates` | Search by `category`, resolve presigned download URLs, return items |
| `update-form-template` | Title / description / `docStatus` transitions |
| `delete-form-template` | Soft delete (`status: superseded`) by default; guarded hard delete also removes the Z3 object |

`list-form-templates` serves both the admin page (all templates, including `preliminary`) and the chart
(published only) — the caller's context decides the filter, not two separate endpoints.

---

## 6. Frontend

### 6.1 Admin page

A new entry in `adminNavGroups` (`apps/ehr/src/features/admin/adminNav.tsx`), modelled on
`apps/ehr/src/features/admin/patient-education/`. **Admin-only** for v1 — the nav item's `allowedRoles` stays
unset, which is admin-tier by default. Widening to Manager later is a one-line change.

### 6.2 Chart-side `FormsCard`

`FormsCard` stops reading `FORMS_CONFIG` and reads published templates from `list-form-templates` instead.

⚠️ One behavioural consequence: with the PDFs in Z3 rather than `apps/ehr/public`, the row's target becomes a
**fetched presigned URL** rather than a static path.

The `formsEnabled` flag continues to gate the chart card, and gates the admin page too while this ships.

---

## 7. Seeding and migration

Self-service **with optional pre-configuration**. `FORMS_CONFIG` is not merged into the chart-side list at
runtime; instead it becomes a one-time starter seed that lands in FHIR on first run, after which the entry is
editable and deletable like any other template. Existing instances keep their DWC073; new instances get it as
a starting point rather than a fixture.

Ejecting this from Terraform management entirely is desirable but explicitly deferred past v1.

---
---

# Part II — Mapping and Prefill

Part I gets admin-authored templates into the system. Part II makes them useful: the admin defines a
**mapping** from chart context to the form's fields, and the form arrives at the provider already populated.

The provider still completes and saves the form in the browser's own PDF viewer, exactly as today — this
feature prefills that form, it does not replace it. §12 records what that leaves unsolved.

---

## 8. What Part II adds

1. **Field discovery** — read the fillable fields out of an uploaded PDF.
2. **A context contract** — a stable, documented set of tokens drawn from the encounter graph.
3. **A mapping** — admin-authored pairs of (context token → PDF field), stored on the DocRef representing the
   form.
4. **Prefill** — apply the mapping to produce a populated form for a specific encounter.

---

## 9. Upload-time triage

Not every PDF can be filled, and one kind cannot even be *displayed*. All four cases must be detected when the
template is uploaded, not when a provider clicks it.

**XFA** is Adobe's deprecated XML form technology. Two flavors, opposite consequences:

- **Static / hybrid XFA** carries both a conventional AcroForm (with real page content and appearance streams)
  and an XFA copy. Chrome, Preview and pdf-lib all work off the AcroForm layer, so it renders and prefills
  correctly. ⚠️ But **Acrobat prefers the XFA representation**, so a form we filled via AcroForm looks perfect
  in Chrome and blank in Acrobat. Mitigation: strip the `/XFA` entry from the AcroForm dictionary on our
  stored copy, forcing every viewer down the AcroForm path.
- **Dynamic XFA** is a shell whose only page content is the familiar *"Please wait… if this message is not
  eventually replaced…"* placeholder; the real form is generated at open time by Acrobat. Chrome's PDFium has
  never shipped XFA support and Preview has none, so **it does not render in a browser at all**.

Detection needs no heuristics: `/XFA` present in the AcroForm dict means XFA-flavoured, and
`/NeedsRendering true` at the document catalog means **dynamic**.

| State | Renders in browser | Prefillable | Action on upload |
| --- | --- | --- | --- |
| AcroForm, no XFA | ✅ | ✅ | Accept — the ideal case |
| AcroForm + XFA, no `/NeedsRendering` | ✅ | ✅ | Accept, strip `/XFA` |
| `/NeedsRendering true` (dynamic XFA) | ❌ | ❌ | **Reject** with an explanatory message |
| No `/AcroForm` (scanned / flattened) | ✅ | ❌ | Accept as a plain printable; disable mapping and say why |

The last row is deliberately not a rejection: a form with no fields is still a useful printable handout.

---

## 10. The mapping layer

Six pieces sit between an uploaded PDF and a populated form. Together they are the bulk of Part II's effort.

### 10.1 Field inventory

At upload, parse with pdf-lib and extract `[{ name, alternateText?, type, options?, maxLength?, page }]`.

Three properties of AcroForm fields shape what the inventory has to capture:

- **`name` is the field's fully-qualified name** — its parent chain joined by dots, which is what
  `PDFField.getName()` returns. Production forms therefore carry names like
  `topmostSubform[0].Page1[0].f1_01[0]`. They are frequently meaningless to a human, which is the whole
  argument behind open decision §13.1 (list-based vs. visual mapper).
- **`alternateText` is the field's `/TU` entry** — the accessibility/tooltip string, which form authors
  often *do* fill in with something readable ("Employee's last name") even when the field name is mangled.
  Where present it is by far the best human-facing label available, and capturing it is what makes a
  list-based mapper tolerable. pdf-lib has no getter for it, but it is on the field's dictionary
  (`field.acroField.dict`, same lookup pattern as the built-in `T()`). Cheap to capture and not always
  populated, so treat it as a bonus rather than a replacement for `name`.
- **`options` must record each choice's export value**, not just its label. A checkbox's "on" state is
  whatever key appears in that widget's appearance dictionary — `/Yes`, `/On`, `/1`, anything; only `/Off` is
  universal. A mapping that writes a plausible-looking value the field does not recognise produces a
  **silently blank** field, which is the single most likely failure in this feature. Capturing export values
  at upload is what lets §10.6 write a valid one.

### 10.2 The context contract

The interface derived from the Encounter resource graph **already exists**: `ProgressNoteInput` in
`packages/zambdas/src/shared/pdf/types.ts`, assembled by `assembleProgressNoteInput()`
(`packages/zambdas/src/shared/pdf/assemble-progress-note-input.ts`). It fans out across `getChartData`,
medication orders, immunizations, eRx pharmacies, encounter signatures and follow-ups, and flattens the result
into typed shapes — `PatientInfo`, `VisitInfo`, `EncounterInfo`, `VisitDetailsForProgressNote`,
`ChiefComplaint` and the rest. Its own docstring claims single-source-of-truth status: the visit-note
subscription and the outbound-fax collector both call it precisely so the two cannot diverge.

**Building a second projection of the encounter graph is the main avoidable mistake in this feature.** Reuse
this one.

What it does not provide is a token namespace — it is nested, shaped for rendering a note, and its property
names are internal.

⚠️ It also holds **display strings, not atoms.** `ProgressNoteInput` is shaped for rendering prose, so its
values arrive pre-formatted and pre-concatenated: `PatientInfo` (`types.ts:381-394`) carries `fullName` and
`suffix` but no given/family parts, `VisitInfo.date`/`.time` are formatted strings, and
`VisitDetailsForInitialVisit.address` is a single line. Forms need the opposite — a name decomposed across
three boxes, a date across MM / DD / YYYY comb fields, an address across street / city / state / ZIP. The labs
path already hit this and solved it locally: `LabsData` (`types.ts:150-155`) declares `patientFirstName` /
`patientMiddleName` / `patientLastName` as separate properties because a requisition is form-shaped. We should
not decompose a fourth time in a fourth place — `packages/utils/lib/helpers/paperwork/prePopulation.ts`
already carries its own `patientAddressLine1` / `patientCity` / `patientState` / `patientPostalCode`.

The fix costs nothing, because the raw FHIR is already in hand at the same moment:
`assembleProgressNoteInput()` *takes* a `FullAppointmentResourcePackage`, which carries `patient`, `encounter`,
`appointment`, `coverage`, `insurancePlan`, `practitioners` and `location`
(`visit-details-pdf/types.ts:18-33`). So the token catalog resolves against **both**:

```ts
type FormFillContext = {
  note: ProgressNoteInput;                   // ready-made display strings
  resources: FullAppointmentResourcePackage; // raw FHIR, for atoms
};
```

Each token draws from whichever side suits it. No extra fetching and no duplicated assembly logic, so the "no
second projection" rule holds.

### 10.3 The token catalog

A **token** is one named, typed, human-labelled handle on a single piece of encounter context — the unit an
admin picks when mapping a PDF field. The **catalog** is the set of every token the feature offers. It is
hand-written code, not admin configuration and not generated from the shapes above: those shapes constrain
what a resolver may reach, but deciding that `patient.firstName` is worth offering, that its label reads
"First name," and that it is a `string` are editorial choices no generator can make.

It lives in two halves, joined by the key:

```ts
// packages/utils — a plain constant, imported directly by the EHR to build the mapping UI
export const TOKEN_CATALOG = [
  { key: 'patient.firstName',   label: 'First name',      group: 'Patient', type: 'string' },
  { key: 'patient.dateOfBirth', label: 'Date of birth',   group: 'Patient', type: 'date'   },
  { key: 'visit.date',          label: 'Date of service', group: 'Visit',   type: 'date'   },
] as const;

// packages/zambdas — never ships to the browser; runs at prefill against a real encounter
export const TOKEN_RESOLVERS: Record<TokenKey, (ctx: FormFillContext) => unknown> = {
  'patient.firstName':   (ctx) => ctx.resources.patient?.name?.[0]?.given?.[0],
  'patient.dateOfBirth': (ctx) => ctx.resources.patient?.birthDate,
  'visit.date':          (ctx) => ctx.note.visitInfo?.date,
};
```

The split is forced: `ProgressNoteInput` and `FullAppointmentResourcePackage` live in `packages/zambdas`,
which the EHR cannot import — but the mapping UI needs the token list to render its picker. Descriptors are
therefore serializable and dependency-free; resolvers stay server-side. **No zambda serves the catalog**; the
admin page authoring a mapping has no patient and no encounter in scope, and imports the constant at build
time. (A zambda that resolves tokens against a chosen encounter would be a *preview* feature — useful, not
required.)

⚠️ **The key is the only thing that persists.** Stored mappings record keys, never labels or resolvers. Labels
and groups can therefore be reworded freely, but keys are append-only: deprecate, never delete or repurpose.
Repurposing a key silently rewires every mapping already using it, with no error anywhere.

⚠️ **A token may resolve to `undefined`** — chart data is routinely absent, so this is a normal result, not an
error. The fill service must treat it as *leave the field untouched*, never as an error and never as the
string `"undefined"`.

ℹ️ A descriptor with no matching resolver is a token an admin can pick that always produces a blank field. A
test asserting the two key sets are identical makes that unshippable.

#### 10.3.1 Types and binding compatibility

Four types are enough: `string`, `date`, `boolean`, `number`. Their value is that the mapper can compare a
token's declared type against the PDF field's type from §10.1 and reject an incoherent binding **at authoring
time** — which matters because a bad binding, absent chart data, and a mismatched export value all produce
exactly one symptom at fill time: a silently blank field.

The verdict is three-valued, not yes/no:

| Token type | Field type | Verdict |
| --- | --- | --- |
| `string` | text | ✅ direct |
| `string` | checkbox / radio / dropdown | ⚠️ only if the value matches an export value (§10.1) |
| `boolean` | checkbox / radio | ✅ writes the field's own export value, never the literal `"true"` |
| `boolean` | text | ⚠️ needs a transform — "Yes"/"No"? "X"/""? |
| `date` | text | ⚠️ **always** needs a format transform; may fan out across MM / DD / YYYY |
| `date` | checkbox / radio | ❌ |
| `number` | text | ⚠️ formatting |

The ⚠️ rows are where this meets §10.5: a binding that needs a transform is *known to be incomplete*, so the
mapper can demand one at binding time rather than accepting a half-specified mapping. Keep the matrix as an
editable constant — real forms will eventually justify loosening a rule.

#### 10.3.2 Choosing the starter set

Map DWC073 end to end; whatever that requires is v1's catalog, plus anything obviously worth tokenizing that
turns up alongside it.

`packages/utils/lib/helpers/paperwork/prePopulation.ts` is the best source to raid — 1,600 lines that already
enumerate what this organization pulls off the chart (name parts, address parts, DOB, birth sex, pronouns,
language, phone, reason for visit, service category, plus employer and occupational-medicine employer blocks
at `:1089` and `:1194`, which are the first place to look for a workers-comp form). Note that it is also the
pattern we are replacing: it hard-codes the mapping in a `linkId` if-chain, so every new field is a PR. We are
not extending it.

⚠️ Expect fields with **no chart source at all** — claim number, date of injury, carrier details. Those stay
unmapped and the provider types them. "Fully mapped" is not the goal; "mapped wherever the chart actually
knows the answer" is.

### 10.4 The mapping artifact

The mapping lives in an extension on the template's own `DocumentReference`, as JSON. No separate resource is
introduced: the mapping is read only by our own fill service, and co-locating it with the PDF gives one
resource per template — atomic updates, and no way for the field inventory (§10.1) and the bindings to drift
apart. Config stored as `valueString: JSON.stringify(...)` is an established convention here — provider
notification preferences, medication administration and the RCM outreach producers all do it.

ℹ️ Because the mapping travels inside the DocumentReference, list views must fetch with **`_elements`** to
exclude it — Oystehr honours it. Otherwise listing 20 templates drags 20 mappings nobody asked for. Applies to
`list-form-templates` (§5) on both the admin and chart-side call paths.

⚠️ **Replacing a template's PDF silently breaks its bindings.** Bindings reference AcroForm field names, so a
corrected form whose publisher renamed `f1_01` to `f1_02` invalidates every mapping naming it — with no error
until a provider opens a blank form. Template replacement needs an explicit re-validation step: re-extract the
inventory, diff it against the bindings, and show the admin what broke *before* publishing.

### 10.5 Transforms

Real mappings immediately need date formatting, name concatenation, boolean → checkbox-state, and a
fallback/default. Ship those as a **small fixed, typed set**.

⚠️ Explicitly resist a general expression language. Every interface engine grows one eventually, and then the
team owns a language: parser, sandbox, debugger, and a permanent support burden. Let real mappings demonstrate
what is missing first.

### 10.6 Writing values into the AcroForm

`pdf-lib@1.17.1` and `@pdf-lib/fontkit` are already root dependencies, so writing into the AcroForm adds no new
dependency.

Four implementation rules, each of which exists because getting it wrong fails silently rather than loudly:

1. **Write through the typed setters** — `CheckBox.check()`, `RadioGroup.select()`, `Dropdown.select()` —
   never by setting a raw field value. They resolve the export values from §10.1; hand-written values do not.
2. **Embed a Unicode font via fontkit and generate appearances.** What a viewer *draws* is a separate
   appearance stream, not the value, so a value written without a regenerated appearance can render blank.
   pdf-lib regenerates on `save()` by default, but its default font is Helvetica/WinAnsi and it **throws on
   characters it cannot encode** — an accented patient name is enough. This must be wired up from the first
   commit, not discovered in production.
3. **Set `/NeedAppearances true`** in the AcroForm dictionary as well, so viewers regenerate appearances
   themselves. Belt and braces with (2); Chrome honours it.
4. **Never flatten.** `form.flatten()` bakes values into the page and deletes the fields, which would leave the
   provider unable to complete the form. Flattening is only appropriate later, for an archival copy of a
   finished document, and possibly for archiving what was prefilled for debugging/auditability purposes.

---

## 11. Prefill and delivery

Fill the AcroForm server-side and open the populated PDF in a new tab. The browser's own viewer handles typing
and saving, exactly as today. The provider completes the form, saves it locally, and uploads it back to the
chart.

**Flow:** provider clicks the form → zambda fetches the template, runs `assembleProgressNoteInput`, applies the
mapping, fills the fields (**not** flattened), stamps provenance (§11.1), uploads the instance to a
patient-scoped Z3 bucket and creates a `DocumentReference` → chart opens the presigned URL in a new tab.

Server-side, because the context assembly is server-side and expensive, pdf-lib is already used server-side,
the template sits behind a presigned Z3 URL, and it keeps PHI assembly out of the browser.

### 11.1 Provenance stamping — required, not optional

⚠️ **The save-back gap is a wrong-patient disclosure risk, not merely an inconvenience.** Every patient
receives the same template, so every download lands in the provider's Downloads folder under the same name:
`dwc073.pdf`, `dwc073 (1).pdf`, `dwc073 (2).pdf` — a pile of identically-named files, each containing a
different patient's PHI, distinguished only by an ordinal suffix. The provider is then asked to pick the right
one from a native file dialog and attach it to a chart. Wrong-patient errors in the wild are overwhelmingly
file-handling errors, and this is close to the expected failure rather than an exotic one. A misfiled form
subsequently sent to a third party (a workers-comp carrier, for DWC073) is an impermissible disclosure.

The structural problem: **manual upload has no binding between the file and the patient.** Everything else in
this codebase binds structurally — `packages/zambdas/src/shared/fax/collect-visit-documents.ts` finds
documents by searching `encounter` + `type`, so a fax packet physically cannot pick up another patient's
record. The upload-back step is the one place where the binding is a human intention rather than a query.

Because prefill is server-side, we can close most of that gap:

1. **Stamp the instance.** Write the encounter ID, patient id, and source DR id into a read-only AcroForm field
   (or a footer) at prefill time. *(`meta.version` for the source DR would make sense to record as well.)*
2. **Name the download per encounter**, not per template — `dwc073_smith-john_2026-08-11_enc-1234.pdf`.
3. **Verify on upload-back.** The upload handler parses the AcroForm, reads the stamp, and rejects or warns on
   a mismatch with the target chart. It writes a DR that references back to the source DR via the `relatesTo`
   property.
4. **Detect the never-returned case.** We know an instance was generated; encounters with no returned document
   can be flagged. That control does not exist today at all.

This converts "trust the user to self-document" into "verify the artifact." It is defeatable by someone
determined — flatten it, re-fill it — but it is not defending against determination; it is defending against a
busy Friday afternoon.

⚠️ Residual risk that stamping does **not** close: a provider who fills the form and simply never uploads it.
We can flag it; we cannot prevent it.

---

## 12. Known limitations

The browser's PDF viewer has **no save-back channel**. When the provider finishes typing and saves, a modified
copy goes to their local disk and we cannot capture it. Three consequences follow, and none of them are
fixable within this design:

- **The chart's copy is our prefilled one, not the provider's completed one.** Persisting the instance (§13.2)
  creates an artifact that is by construction incomplete.
- **Returning the finished form to the chart stays a manual step.** §11.1 makes that step *verifiable* — a
  stamped instance uploaded to the wrong chart can be caught, and a form that never comes back can be flagged
  — but it cannot be made automatic.
- **Nothing is captured as structured data.** The answers exist only as marks in a PDF: not queryable, not
  reportable, and not reusable to prefill anything later.

Whether that is acceptable is a per-form question rather than a technical one, and it is sharpest for forms
whose purpose is to be sent to a third party.

ℹ️ Where a workflow genuinely needs structured capture — queryable answers, validation while filling, an audit
trail of what was answered — the right vehicle is admin-authored questionnaires, not this feature. Forms exists
to make an existing PDF arrive prefilled; it is not a form builder.

---

## 13. Open decisions

1. **Mapping UI: list or visual?** Picking from a list of `topmostSubform[0].Page1[0].f1_01[0]` (§10.1) is
   technically sufficient and genuinely miserable on a real government form. Click-a-field-on-the-rendered-PDF
   is far better and costs a pdf.js render plus widget-rectangle overlay. ⚠️ A field and an on-page box are not
   1:1 — one field can own several widget annotations (that is how one value renders on multiple pages, and how
   radio groups work), so a visual mapper must handle one selection highlighting in several places.
2. **Persist the prefilled instance, or generate it ephemerally per click?** Persisting creates a chart artifact
   that is by construction incomplete — and is also what makes the §11.1 never-returned detection possible.

---

## 14. Next iteration: AI-assisted mapping

Mapping a 60-field government form by hand is the least pleasant part of this feature, and it is the part an
LLM should be good at. Worth building second, once the pieces below exist.

The task is a **constrained match between two enumerated lists** — the field inventory (§10.1) and the token
catalog (§10.3) — not open-ended generation. The model is handed field names, `/TU` alternate text, field
types and options on one side, and token keys, labels, groups and types on the other, and proposes pairings.

Three properties of the design make this unusually tractable:

- **No PHI is involved.** The inventory is derived from the *blank* template and the catalog is a static
  constant in the codebase, so suggestion runs entirely on template metadata and a code-defined vocabulary.
  No patient, no encounter, no chart data reaches the model. This falls out of §10.3's decision to keep the
  catalog static and separate from resolution.
- **The type matrix is a hard filter, not a prompt instruction.** Every proposal is checked against §10.3.1
  before it is shown and incoherent bindings are discarded programmatically. The model proposes; the matrix
  disposes.
- **It is cheap.** One admin-initiated pass per template, latency-insensitive, run once and then edited by
  hand.

**Suggest, never apply.** Proposals arrive as a reviewable set the admin accepts, edits, or rejects, ordered
by confidence; nothing publishes unreviewed. That is the same posture as §11.1 — verify the artifact rather
than trust the step.

ℹ️ Bearing on §13.1: opaque field names are the main argument for the expensive visual mapper. Capturing
`/TU` (§10.1) and adding decent suggestions may make a plain list mapper good enough, so it is worth landing
both before committing to a pdf.js overlay.

---

## 15. Functional requirements

Derived from the design above, not written alongside it. **Where the two disagree the design section
governs** — these are a view onto it for planning and acceptance-testing purposes, and each carries the
section it comes from so a design change makes the affected requirements obvious.

Each requirement is stated to be independently verifiable.

### 15.1 Template management

| ID | Requirement | Design |
| --- | --- | --- |
| FR-1 | An administrator can upload a PDF file to create a new form template. | §2, §4 |
| FR-2 | A template carries a title and a description, both editable after creation. | §3.1 |
| FR-3 | Templates are organization-level and are not associated with any patient. | §3 |
| FR-4 | A newly created template is unpublished. | §3.1, §3.3 |
| FR-5 | An administrator can publish an unpublished template and unpublish a published one. | §3.3 |
| FR-6 | An administrator can delete a template; it then disappears from all lists while its record is retained. | §3.3 |
| FR-7 | Permanent deletion is a separate, explicitly confirmed action that also removes the stored PDF file. | §3.3 |
| FR-8 | An administrator can replace a template's PDF file with a new version. | §10.4 |
| FR-9 | The template list is global; templates are not filtered by location, state, or visit type. | §2 |

### 15.2 Upload validation and field discovery

| ID | Requirement | Design |
| --- | --- | --- |
| FR-10 | On upload the system determines whether the PDF's fields can be filled programmatically. | §9 |
| FR-11 | A PDF that cannot be displayed in a browser is rejected with an explanation of why. | §9 |
| FR-12 | A PDF carrying a redundant secondary form representation is accepted, and that representation is removed from the stored copy. | §9 |
| FR-13 | A PDF with no fillable fields is accepted as a printable-only template, with mapping disabled and the reason shown. | §9 |
| FR-14 | On upload the system records an inventory of every fillable field: identifier, human-readable label where present, type, permitted values, length limit, and page. | §10.1 |
| FR-15 | Replacing a template's PDF re-derives the inventory, compares it against existing bindings, and shows the administrator which bindings no longer resolve before the change is published. | §10.4 |

### 15.3 Mapping authoring

| ID | Requirement | Design |
| --- | --- | --- |
| FR-16 | An administrator can bind a discovered field to an item of encounter context. | §8, §10.3 |
| FR-17 | Available context items are presented with human-readable labels, organized into groups. | §10.3 |
| FR-18 | The system prevents binding a context item to a field whose type cannot accept it. | §10.3.1 |
| FR-19 | Where a binding cannot be applied without a conversion, the system requires that conversion to be specified before the mapping is saved. | §10.3.1 |
| FR-20 | Supported conversions include date formatting, name composition, yes/no representation, and a fallback value. | §10.5 |
| FR-21 | Fields may be left unbound; a complete mapping is not required to publish a template. | §10.3.2 |
| FR-22 | A template's mapping is stored with that template and is retrieved with it. | §10.4 |
| FR-23 | The available context items are sufficient to map every field of DWC073 that the chart can answer. | §10.3.2 |

### 15.4 Chart-side presentation

| ID | Requirement | Design |
| --- | --- | --- |
| FR-24 | The Plan section of the patient chart lists every published, undeleted template. | §3.3, §6.2 |
| FR-25 | Unpublished and deleted templates never appear in the patient chart. | §3.3 |
| FR-26 | Selecting a form opens it in a new browser tab, where the provider can complete and save it. | §6.2, §11 |
| FR-27 | Instances already using the pre-configured DWC073 template retain it after the migration. | §7 |

### 15.5 Prefill

| ID | Requirement | Design |
| --- | --- | --- |
| FR-28 | Opening a form from a patient chart produces a copy populated from that encounter according to the template's mapping. | §11 |
| FR-29 | Population is performed by the backend; no patient data is assembled in the browser for this purpose. | §11 |
| FR-30 | A bound field whose context value is unavailable is left blank rather than populated with a placeholder or an error. | §10.3 |
| FR-31 | A populated form remains editable by the provider; no field is locked as a side effect of population. | §10.6 |
| FR-32 | Populated values display correctly in the browser's PDF viewer, including names containing accented or non-Latin characters. | §10.6 |
| FR-33 | Populated checkboxes, radio buttons and dropdowns display as selected in the browser's PDF viewer. | §10.1, §10.6 |

### 15.6 Provenance and return to chart

| ID | Requirement | Design |
| --- | --- | --- |
| FR-34 | Every populated form carries a record of the encounter, patient and template version it was produced from. | §11.1 |
| FR-35 | The downloaded file is named distinctly per encounter rather than identically per template. | §11.1 |
| FR-36 | When a completed form is uploaded to a chart, the system checks its provenance record against that chart and refuses or warns on a mismatch. | §11.1 |
| FR-37 | A stored completed form is linked to the template it was produced from. | §11.1 |
| FR-38 | Encounters for which a form was produced but no completed form was returned can be identified. | §11.1 |
| FR-39 | Returning a completed form to the chart is a manual action by the provider; the system does not capture it automatically. | §12 |

### 15.7 Access control and configuration

| ID | Requirement | Design |
| --- | --- | --- |
| FR-40 | Template management and mapping authoring are available only to users holding the Administrator role. | §6.1 |
| FR-41 | The entire feature, in both the chart and the admin area, is controlled by a single feature flag. | §6.2 |

### 15.8 Explicitly out of scope

| Item | Why | Design |
| --- | --- | --- |
| Filtering forms by encounter context (state, service mode, visit type, employer) | Deferred; the data model reserves the slots | §2 |
| Removing template configuration from Terraform management | Deferred past v1 | §2, §7 |
| Automatic capture of the provider's completed form | Not achievable with browser-native form filling | §12 |
| Structured capture of what was answered | Belongs to admin-authored questionnaires, not this feature | §12 |
| AI-assisted mapping suggestions | Next iteration | §14 |

### 15.9 Undetermined

Two behaviours are deliberately unspecified above because the design has not settled them. Requirements will
be added once they are:

- Whether the mapping interface presents fields as a list or as a rendered, clickable PDF (§13.1).
- Whether a populated form is stored as a chart document at the moment it is opened, or generated on demand
  and stored only when the completed version is returned (§13.2).
