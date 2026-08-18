# Easy Chart — instructions for the next iteration

Hand this file to the agent. It states what is already done (verified by reading the code, not by
assumption), what is left, and in what order.

## Read

- `docs/easy-chart-orders-worklist.md` — **part two, section 6** is your work. Part one is done; skim it
  only for the two follow-ups listed below.
- `docs/easy-chart-rebuild-plan.md` — **section 4.5a** for the principle that governs all of this, and
  Phase 5.5 for how provenance is meant to work.

Everything else in the doc set is background you have already used.

---

## Already done — do not redo

Verified in `hooks/useCatalogue.ts`, `hooks/useChartWriter.ts` and `executor/handlers.ts`:

- in-house lab catalogue and order;
- send-out lab catalogue, with the ordering office resolved from the encounter and the payment method
  derived (workers' comp → insurance → self-pay);
- radiology catalogue and order;
- `supports.labOrders` / `supports.radiologyOrders` are real readiness checks, not hard-coded;
- the `undefined` vs `[]` distinction is respected throughout.

This part is good work. Two loose ends only:

### A. `consentObtained: true` is still hard-coded

`useChartWriter.ts`, in `orderRadiology`. Nothing in a dictation establishes that consent was obtained,
and this is the one value in the order paths that is invented rather than derived — the exact thing the
rest of the feature is built to avoid. Either derive it from something real, or leave it unset so the
order carries the same default a manually placed one would. If leaving it unset blocks the order, that is
a question to raise, not a value to fill in.

### B. The modality regression is untested

`tests/unit/easy-chart-executor.test.ts` covers an X-ray resolving to a CPT, but not the guard. Add the
case: **"venous duplex ultrasound" must produce no radiology match.** In the previous implementation that
exact string resolved to CPT 73590, "X-ray of lower leg" — a wrong study charted with full confidence,
because partial-word matching found the body part. Test the string, not the concept.

---

## The work: five catalogues, cheapest first

All five currently answer "add it in the regular chart". Full detail in the worklist, section 6; the
order matters because the first two are nearly free and the last is not.

1. **Surgical history** — `SURGICAL_HISTORY_OPTIONS` is a static `CPTCodeDTO[]` already in the repo
   (medical-history tab). Import, fuzzy-match, write. Same shape as `examFindings`.
2. **Hospitalizations** — `HospitalizationOptions`, likewise static. Writes to `episodeOfCare`.
3. **Allergies** — `oystehr.erx.searchAllergens({ name })`, the sibling of the `searchMedications` call
   already implemented in the same file. Copy that branch, change the call. Filter out query terms under
   3 characters: the eRx and ICD searches reject them.
4. **Conditions** — check first whether a catalogue is needed at all. The server already validates ICD
   codes (`easy-chart-shared/guards.ts`, including code-and-display-from-one-row), and `add-diagnosis`
   charts from the validated code with no client catalogue. The question is why `add-condition` doesn't
   take the same path.
5. **Procedures** — the only one where deferring is defensible; see below.

**Why these are not like the labs.** For a send-out lab the missing value (payment method) genuinely is
not in the dictation and must be derived. For a past surgery the dictation contains the entire input — the
procedure name — and the rest is a list already sitting in the repository. The "not resolvable from a
dictation" reasoning does not carry over.

---

## Procedures — decide, then write the decision down

If you wire it, three details from the previous implementation are worth copying verbatim. Each exists
because it broke:

1. **Deduplicate the quick-pick's linked codes.** A quick-pick carries its own diagnoses and CPT codes.
   Save only those not already charted, and link the procedure to the *existing* resource for the rest.
   Re-saving produced duplicate diagnoses. Flag the genuinely new template-derived codes as `inferred`.
2. **Get the procedure's `resourceId` by diffing the `procedures` array**, not from a generic
   "newly created ids" list. On a fresh chart the second save also reports the first save's dx/CPT as new,
   so a generic list yields a *diagnosis* id and the provenance attaches to the wrong resource.
3. **Capture the source quote before the `await`.** The pending-provenance reference is overwritten by the
   next plan step, so a quote read after the save belongs to a different item.

Provenance is **per field**: only the fields the template actually filled go into the review set; each
carries a visible "default, verify" marker with its own confirm; editing a field clears it. A
whole-procedure confirm on top of that is fine — the provider has seen the markers. Per-*item* provenance
with no per-field marks is not: one click would accept ten unspoken clinical assertions, including
`complications`, `patientResponse` and `timeSpent`, which are billing and legal claims.

If you defer procedures, that is a reasonable sequencing call — but **write the decision down** and make
the skip message name the dictated procedure. A dropped procedure loses a billable item.

---

## Definition of done for this iteration

- [ ] `consentObtained` no longer hard-coded
- [ ] "venous duplex ultrasound" has a regression test asserting no match
- [ ] Surgical history, hospitalizations and allergies resolve and chart
- [ ] `add-condition` either charts through the validated-code path or carries a written reason
- [ ] Procedures wired with per-field provenance, or deferred in writing
- [ ] Every remaining skip names the item that was dictated, so nothing voiced disappears silently
