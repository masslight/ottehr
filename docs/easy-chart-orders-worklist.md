# Easy Chart — wire up the actions that still say "do it in the regular chart"

Two parts: **orders** (labs, imaging) below, and **the remaining catalogues** (allergies, conditions,
surgical history, hospitalizations, procedures) in section 6 at the end. They are in one document because
they share a failure mode: an action that skips with a polite message looks handled, and a voiced item is
gone.

---

## Part one — lab and imaging orders

**Status:** these three actions currently skip with "not available on this page yet":
`add-in-house-lab`, `add-external-lab`, `add-radiology`. They must place real orders, as the previous
implementation did. This document is the work order.

**Read this first, because it changes the premise.** The current code carries this rationale:

> An external lab order requires a payment method chosen for the visit, and an in-house one requires the
> practice's test catalogue — neither is resolvable from a dictation alone […] A radiology order is
> created by CPT code, not study name.

Every factual clause there is true. The conclusion is not. **None of those values were ever supposed to
come from the dictation.** They come from the encounter, the patient's coverage, and the practice's own
catalogues — resolved deterministically, exactly the way the regular Labs and Radiology tabs resolve
them. The dictation supplies only the *name of the test or study*.

This was working in the previous implementation. What follows is how it did it.

The principle to hold onto: **"never guess in a medical record" means never invent a value. It does not
mean refuse to act.** Resolve from real data; ask when genuinely ambiguous; and when resolution truly
fails, skip the step *with the test or study named in the reason* so a voiced order is visible rather
than lost. Declining to support the action at all is not the safe option — it silently loses a voiced
order, which requirements section 5 calls out specifically.

---

## What is already right — do not rebuild it

The scaffolding is in the right shape. Only the leaves are missing.

| Piece | State |
|---|---|
| `addFromCatalogue` in `executor/handlers.ts` | Correct. One generic implementing confident / ask / skip-with-reason. Do not special-case orders around it. |
| `CatalogueResult = CatalogueMatch[] \| undefined` | Correct and worth preserving: `undefined` = "not available here", `[]` = "searched, nothing matched". They produce different messages. |
| `catalogue.labs` / `catalogue.radiology` | Stubbed as `UNAVAILABLE`. **Implement.** |
| `writer.orderLab(match, inHouse)` / `orderRadiology(match)` | Signatures in place, bodies throw. **Implement.** |
| `writer.supports.labOrders` / `radiologyOrders` | `false`. **Flip to a real capability check** and delete the comments quoted above. |

Follow the idioms already in `useCatalogue.ts`: return `undefined` when the client isn't ready, `[]`
when a real search found nothing, and score matches so only ordering and the top-two ratio matter.
`CatalogueMatch.payload` is opaque to the executor — put whatever the write path needs in it.

---

## 1. In-house lab

**Catalogue.** Fetch the practice's test catalogue for this encounter, then score the dictated name
against test names.

- source: `getCreateInHouseLabOrderResources({ encounterId })` → `labs` (`DataEntryTestItem[]`)
- name field: `.name`
- client not ready → `undefined`; catalogue fetched but nothing matched → `[]`
- put the test item in `payload` — the order call needs the item, not just its name

**Ordering.** Two zambda calls in total: `get-create-in-house-lab-order-resources` to fetch the
catalogue, then `create-in-house-lab-order` with the matched item. In this codebase's split that is one
call in the catalogue and one in the writer, so each side makes exactly one.

*(Correction to an earlier draft of this document, which claimed a mandatory follow-up "dispatch" call
after creation. There is no such call — the pair is resources-then-create. Do not go looking for a third
step.)*

**Ambiguity is expected here** and the generic already handles it: "flu test" legitimately matches
Flu A / Flu B / Rapid Influenza. Typed request → ask. Bulk plan execution → best match, marked
low-confidence. Do not auto-pick silently in the interactive case.

---

## 2. Send-out (external) lab

More moving parts, all of them derived rather than chosen by the model.

**Preconditions — each is a `skipped` with a reason, never a throw:**

- **At least one charted diagnosis.** With none:
  `Send-out lab "<name>" needs at least one diagnosis — add the assessment first, then re-order.`
- **A lab-enabled ordering office.** Resolution order: the encounter's own location if it is
  lab-enabled, else the single lab-enabled office if there is exactly one. If neither:
  `No lab-enabled ordering office for this visit — place "<name>" from the Labs tab.`

**Catalogue.** Two steps, because the catalogue is scoped to the connected labs:

1. `getCreateExternalLabResources({ patientId, encounterId })` → `orderingLocations`; keep those with a
   non-empty `enabledLabs`; pick the office as above; build the lab-org id list from
   `office.enabledLabs[].labOrgRef`;
2. `getCreateExternalLabResources({ search: <dictated name>, labOrgIdsString })` → `labs`; score against
   `.item.itemName`.

`patientId` comes from the Encounter's `subject`; the location id from its `location[]`.

**Payment method — derive, do not ask and do not invent:**

```
appointment is workers' comp        → WorkersComp
else patient has ≥1 coverage        → Insurance
else                                → SelfPay
```

This is the same defaulting the regular Labs tab applies, and the provider can change it on the order
afterwards. `getCreateExternalLabResources` returns both `appointmentIsWorkersComp` and `coverages`, so
no extra fetch is needed.

**Order** with: the matched catalogue item, the resolved office, the charted diagnoses, and the derived
payment method.

---

## 3. Radiology

**Catalogue.** The CPT comes from the practice's imaging study catalogue, matched on the dictated study
name. The model never supplies a CPT.

- source: the imaging study config (each entry has a display and its CPT code)
- put the CPT in `payload`
- no match → `[]`, and the skip reason should name the study

**Modality guard — this is not optional.** If the query text mentions ultrasound, duplex, doppler,
sonogram/sonography, echocardiogram, CT / cat scan, MRI / magnetic resonance, nuclear, or the bare
tokens `us`, `ct`, `v/q`, **refuse to match at all** while the catalogue is X-ray-only. Return `[]` with
a reason that says the in-clinic catalogue covers X-rays only and to use the Radiology tab.

Why it is not optional: without it, *"venous duplex ultrasound"* resolved to CPT 73590, **"X-ray of
lower leg"** — a wrong study charted with full confidence, because partial-word matching found the body
part. Across modalities, no match is strictly safer than a good-looking match.

**Precondition.** An imaging order needs a linked diagnosis: prefer the primary, else the only one.
With none, skip with `Add a diagnosis first — an imaging order needs a linked diagnosis.`

**Order** with: the encounter, the diagnosis code(s), the CPT from the catalogue match, the study name as
dictated, and a short clinical-history string built from the study plus the diagnosis display.

**One thing to do differently from the previous implementation.** It sent `consentObtained: true` as a
constant. Nothing in a dictation establishes that consent was obtained, and hard-coding it is exactly
the class of invention this feature is supposed to avoid. Either derive it from something real or leave
it unset so the order carries the same default a manually placed one would. If leaving it unset blocks
the order, that is a question for the product owner, not a value to fill in.

---

## 4. Flip the capability flags honestly

`supports.labOrders` and `supports.radiologyOrders` should become real readiness checks in the same
style as the neighbouring flags (`Boolean(oystehrZambda)` and friends) — not hard-coded `true`. The
existing note in that file is worth keeping in spirit: **a `supports` flag that lies is a loud bug**, so
the throwing bodies should stay as the backstop after the real implementation lands.

Delete the two rationale comments quoted at the top of this document once the paths work; leaving them
would tell the next reader that this is impossible.

---

## 5. Tests

Unit-test the catalogue matchers and the preconditions without a network:

- in-house: exact name matches; `[]` when the catalogue has no such test; several near-equal names
  cluster so the executor asks;
- external: no diagnosis → skipped with the test named; no lab-enabled office → skipped with the test
  named; payment method resolves correctly for all three branches (workers' comp / coverage /
  self-pay);
- radiology: a dictated X-ray resolves to the right CPT; **"venous duplex ultrasound" returns no match**
  (regression — this exact string once charted CPT 73590); no diagnosis → skipped;
- for all three: `undefined` (catalogue unavailable) and `[]` (nothing matched) produce *different*
  provider-facing messages, and neither is reported as a failure.

There is a committed corpus of twenty synthetic dictations in `docs/easy-chart-eval-cases.md`; several
order labs or imaging and are useful end-to-end checks once the paths work.

---

## Acceptance

- [ ] A dictated in-house test places a real, dispatched order (both calls made)
- [ ] A dictated send-out test places an order with a derived payment method and the encounter's office
- [ ] A dictated X-ray places an order with the CPT taken from the catalogue
- [ ] "venous duplex ultrasound" does **not** resolve to an X-ray
- [ ] Every unresolvable case skips with the test or study **named** in the reason
- [ ] No precondition failure surfaces as an error or a thrown exception
- [ ] `consentObtained` is not hard-coded to `true`
- [ ] The three actions no longer say "not available on this page yet"

---

## Part two — the five remaining catalogues

`allergies`, `conditions`, `surgicalHistory`, `hospitalizations` and `procedures` are still `UNAVAILABLE`,
so those actions skip with "add it in the regular chart". Unlike the order paths, four of the five need
almost nothing. They are listed cheapest first — do them in this order.

**Note the asymmetry with orders.** For a send-out lab, the missing value (payment method) genuinely is
not in the dictation and has to be derived. For a surgical history, the dictation contains the *whole*
input: the procedure name. There is nothing to derive and nothing to guess — only a fuzzy match against a
list that is already in the repository. The "not resolvable from a dictation" reasoning does not transfer
to these.

### 6.1 Surgical history — a static array already in the repo

`SURGICAL_HISTORY_OPTIONS` (in the medical-history tab's `SurgicalHistory/surgicalHistoryOptions.ts`) is a
`CPTCodeDTO[]`: display plus code, hand-curated. Import it and fuzzy-match the dictated name, exactly the
way `examFindings` and `rosFindings` already match against their static lists. No API call, no auth, no
async work. Put the option in `payload`; the write is a `surgicalHistory` entry.

### 6.2 Hospitalizations — likewise

`HospitalizationOptions` (in the in-person `hospitalization/hospitalizationOptions.ts`) is a
`HospitalizationDTO[]` with display and code. Same treatment; writes to `episodeOfCare`.

### 6.3 Allergies — the sibling of a call you already make

`medications` is already implemented in `useCatalogue.ts` via `oystehr.erx.searchMedications({ name })`.
Allergens are the same API's sibling: `oystehr.erx.searchAllergens({ name })`, same shape of result, same
scoring, same "first search term wins on ties" rule. Copy the medications branch and change the call.

One inherited detail worth keeping: **the eRx and ICD searches reject a query shorter than 3 characters**,
so filter short terms out before calling rather than letting the request fail.

### 6.4 Conditions — probably needs no catalogue at all

Conditions are ICD-10, and the server already validates ICD codes against the terminology service
(`easy-chart-shared/guards.ts`, including the rule that code and display must come from **one**
terminology row). `add-diagnosis` already relies on that and charts from `action.code` without a
client-side catalogue.

So the first question is not "how do I build a conditions catalogue" but "why is `add-condition` not
taking the same path as `add-diagnosis`". If the server guard covers it, this action needs a handler, not
a catalogue. Check before building anything.

### 6.5 Procedures — a different shape of work, not just a harder catalogue

**Why the other four are small and this one is not.** For the four above, one value goes in and one row
comes out: a dictated name is matched, and a single entry is written. Provenance is trivial — the row is
AI-written, here is the quote, here is the correct-it affordance.

A procedure is one dictated phrase in and a **ten-field clinical form** out. The practice's quick-pick
pre-fills all of it:

```
bodySite  bodySide  medicationUsed  technique  suppliesUsed
procedureDetails  complications  patientResponse  postInstructions  timeSpent
```

**The provider said none of those.** They said "I did a laceration repair". Every field value came from a
template.

#### The danger, which is the actual reason to treat this separately

Apply the normal provenance model — mark the item AI-written, provider confirms it — and **one click
silently accepts ten unspoken clinical assertions**. Among them:

- `complications`, typically pre-filled "none";
- `patientResponse`, typically "tolerated well";
- `timeSpent`, which feeds billing.

Those are not descriptive fields. They are legal and billing claims about what happened to the patient.
A provider who said four words would be attesting that there were no complications, that the patient
tolerated the procedure well, and to a duration they never stated.

So a procedure needs **per-field provenance**, not per-item:

```ts
interface ProcedureProvenance {
  sourceText?: string;         // the procedure itself — dictated
  inferredFields: Set<string>; // these values — template defaults, each needing its own verification
}
```

The entry lives while any field is unverified; confirming or editing a field removes it from the set; the
entry clears when the set empties. Each field is marked "default, verify" and can only be accepted
individually. There is no bulk-confirm for a procedure.

#### And `update-procedure` is a different matching problem

"Change the technique to sterile" has to identify **which** of several procedures on the encounter, i.e.
matching against already-charted items rather than against a catalogue. It also needs a field-name synonym
map, because a provider will say "site", "location" or "bodysite" for the same field.

#### What this means for sequencing

Not "this is also hard" but "this is a subsystem": a composite write, plus a new provenance shape, plus a
second action with its own matching problem. The other four are one matcher function each.

Deferring it is defensible. **Deferring it silently is not** — a dropped procedure loses a *billable*
item, which is worse than most things this feature can drop. If it ships last, write that decision down,
and make the skip message name the procedure that was dictated so the provider can see what to add.

### Acceptance for part two

- [ ] A dictated past surgery charts from the static option list, with its code
- [ ] A dictated past hospitalization charts from the static option list
- [ ] A dictated allergy resolves through the eRx allergen search; queries under 3 characters are not sent
- [ ] `add-condition` either charts through the server-validated code path or has a documented reason not to
- [ ] Procedures: either wired, or explicitly deferred in writing with the per-field provenance noted
- [ ] None of the five still answers "add it in the regular chart" without a reason that survives review
