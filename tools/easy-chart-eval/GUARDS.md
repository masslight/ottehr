# The guards: what each one does, why it exists, and how often it fires

Guards are the deterministic layer between the model's raw output and the chart. They run
server-side, before the client executor sees anything, and they either **repair** an action, **reject**
it with a reason returned to the caller, or **append** one the model forgot.

Nothing is dropped silently: every rejection carries a human-readable reason and travels back in
`rejected`, so a provider (and the eval) can see what the assistant tried to do and why it did not
happen.

Two files hold them:

- `packages/zambdas/src/ehr/easy-chart-shared/guards.ts` — everything both surfaces share
- `packages/zambdas/src/ehr/easy-chart-review/index.ts` — three guards only the review pass needs

**Firing counts are from `run-OK396`**: 396 screened-good cases, 6,268 emitted intents, 260 rejected
by guards (114 plan-side, 146 review-side). They are one run; single-digit differences between runs
are noise, the shape is not.

---

## Order of operations

`applyGuards` runs in a deliberate order — cheap shape checks first, then per-kind semantics, then the
invariants that can only be judged with the whole action list in hand.

```
for each raw action:
  1. coerceNumericFields      undo the digit-loop workaround
  2. isActionKind             is this an action this build knows?
  3. field stripping          drop fields this kind does not declare (with a salvage step)
  4. verifiedSourceText       the provenance quote must really occur in the narrative
  5. missingRequiredFields    the registry's `required` list
  6. per-kind guard           vitals / diagnoses / E&M / CPT / exam / ROS / removals
then, across the whole list:
  7. enforceDiagnosisInvariants   no duplicates, exactly one primary
  8. applyBackstops               append what the model reliably forgets
  9. buildTriggerReports          compliance checks over the final set
```

---

## 1. Shape guards (`guardOne`)

### 1.1 `coerceNumericFields` — repair

Every numeric field is declared in the response schema **as a string**, because a numeric field
invited a digit loop that ran to the output cap. This undoes that: numbers are parsed back. A value
that will not parse is **deleted**, so the required-fields gate below rejects it honestly rather than
charting `NaN`.

### 1.2 Unknown action kind — reject

> `"X" is not an action this build knows`

The model named an action that does not exist on this surface. Rare, because the response schema
restricts `kind` to that surface's vocabulary.

### 1.3 Field stripping — repair, with salvage

Fields a kind does not declare are stripped. Not cosmetic: an `add-diagnosis` for a forehead
laceration arrived carrying `updates: [{field:'code', value:'S01.81XA'}]` — `update-procedure`'s
shape, holding the code the model actually meant — while its own `code` field named an unrelated
condition. A field the executor does not read for this kind can only mislead; one it reads under a
*different* kind can change what gets charted.

**Salvage before stripping:** when a diagnosis has no `code`, a code-shaped value found in a leaked
field is promoted to a candidate. It then goes through the same terminology confirmation as any other,
so a bad salvage is rejected by the normal path. This matters because code lookup is reliable while
description search is not — the S-chapter injury codes are effectively unreachable by description.

### 1.4 `verifiedSourceText` — repair

The provenance quote is checked against the narrative. A quote that is not really there is **dropped**,
and the action is then honestly marked inferred rather than carrying a fabricated citation. Runs
before everything else so no later rejection reason can quote a fabrication.

### 1.5 Required fields — reject

> `the assistant did not supply <field> and <field>, so this could not be charted`

Straight from the registry's `required` list. `set-vital` is exempt here because it has its own
recovery path (2.1).

---

## 2. `guardVital` — 36 rejections

### 2.1 Reading recovery — repair

The model is inconsistent about optional fields and will emit a `set-vital` with no display at all.
Before rejecting, the guard re-reads the provider's own words for a reading of that vital.

### 2.2 No reading anywhere — reject — **32 firings**

> `no reading for vital-temperature was given, and none could be found in the dictation`

35 firings, of which **28 are temperature**; the rest are weight (3), oxygen saturation (2), height
and heart rate (1 each). Reading: the model hears "she felt warm" and reaches for a vital that has no
number behind it. Correct rejection — a vital without a value is not chartable.

### 2.3 Unparseable, implausible, or missing units — reject

> `could not read a number from "99.4 orally" for vital-heartbeat` — 1 firing

Deliberately does **not** silently reinterpret. A blood pressure that parses as a single number, or a
temperature of 986, is refused rather than guessed at.

---

## 3. `guardDiagnosisLike` — 16 rejections

Runs for `add-diagnosis` and `add-condition`.

### 3.1 Code sniffing — repair

The model omits the code often enough to be worth one deterministic look: narratives write
"Acute otitis media, right ear (H66.91)" with the code right there. A code-shaped token that is really
a **speaker tag** ("DOCTOR X31") is refused — that was the single most embarrassing miscode this
system produced.

### 3.2 Terminology confirmation — reject — **7 firings**

> `no ICD-10 code could be confirmed for "X", so it was not charted`

Validated against the same terminology service the EHR picker uses. The rule that matters:
**the charted `{code, display}` pair must come from ONE terminology row.** Never a model code with a
searched display or vice versa — that is how a note ends up asserting a condition whose code says
something else.

### 3.3 Etiology qualifier — repair first, then reject — **12 firings**

> `H66.005 asserts "serous", which the visit does not describe`

A code whose display carries a cause the narrative does not support is the *wrong* code even though it
is a real one — "Gonococcal vulvovaginitis" for a yeast narrative, "serous" otitis media for a purulent
one. **Repair is attempted first**, because the condition is usually right and only the qualifier
wrong; refusing outright would throw away a correct finding. Only an unrepairable one is rejected.

### 3.4 Personal-history code on a current problem — reject — **1 firing**

> `Z87.01 is a personal-history code, but the visit describes a current problem`

`add-condition` may legitimately record past history. A visit *diagnosis* may not.

---

## 4. `guardEmCode` and `guardCpt` — code validation

Shape check, then terminology confirmation, then the charted display is replaced with the
terminology's own.

### The `degraded` distinction — deliberate non-rejection

```
undefined  the service answered and the code is not real   → drop it
'degraded' the service could not be reached                → KEEP the model's code
```

Collapsing both into "drop" would mean a terminology outage silently strips billing from every visit
for as long as it lasts, and nobody notices until the invoices are short. An unvalidated billing code
for the duration of an outage is the lesser harm, so the outage goes to Sentry and the code is kept.

---

## 5. `guardExamFinding` — 55 rejections, the most-fired guard on the plan side

> `"no wheezing" is a negative — exam findings are positive observations only, so nothing was charted`
> `"lungs clear" asserts a normal rather than an abnormality`

**The exam section stores positive observations only.** A negated finding must not produce one — and
must not *remove* the matching normal either, because it AGREES with it. Matching is on **polarity,
not on the keyword**.

| reason | firings |
|---|---:|
| asserts a normal rather than an abnormality | 37 |
| is a negative — exam findings are positive only | 13 |
| is a negative, which agrees with the charted normal (removal) | 5 |

This is the single largest concentration of guard activity, and it is not a plumbing failure — it is
the model repeatedly misunderstanding a semantic property of Ottehr's exam model that the prompt
states in prose. 55 rejections across 396 visits. A separate action kind for a negative finding, as
the ROS vocabulary already has, would make the mistake unrepresentable instead of caught afterwards.

---

## 6. `guardRosFinding` — 11 rejections

> `"Fever" does not say whether the patient reports or denies it`

ROS records both positives and negatives and carries polarity in the display text. A finding with
neither verb cannot be filed with the right polarity, so it is **rejected rather than guessed**.
On success the guard also normalises `finding` to `denies` / `reports`.

---

## 7. `guardRemoval` — 6 rejections

> `the chart is empty, so there was nothing to remove` — 6 firings

The second branch — `"X" is not on the chart, so nothing was removed` — did not fire server-side in
this run. The four rejections carrying that wording came from the **client** executor's own
`removeCharted`, which repeats the check against the live chart after the guard has seen only the
chart-state summary. Both layers exist because they see different things: the guard sees a text
summary sent with the request, the executor sees the chart itself.

A `remove-*` may only target something actually listed in ALREADY ON THE CHART. Where several
plausible matches exist the **client** asks the provider rather than deleting the first substring
match; this guard only refuses removals matching nothing at all, so the step reports a reason instead
of quietly doing nothing.

**`remove-exam-finding` and `remove-ros-finding` route through here too**, and that was a late fix.
They previously stopped at the polarity check, so the chart-membership rule enforced for allergies,
conditions, medications, surgical history, hospitalizations and diagnoses was *not* enforced for the
two kinds that make up almost every removal the findings stage emits. Measured: 18 removals, 14 of
which matched nothing, against 2 on the monolith. What they targeted explains why polarity alone
cannot catch it — the chart held "Denies fever" and the stage asked to remove "REPORTS fever", the
opposite entry, never charted. Polarity-valid, chart-invalid.

---

## 8. `enforceDiagnosisInvariants` — cross-action, 1 rejection

Two halves, and only one is about the model behaving badly.

### 8.1 No duplicate diagnosis — reject — **1 firing**

> `Unspecified asthma with (acute) exacerbation was already charted in this plan, so the duplicate was dropped`

### 8.2 At most one primary — repair, not reject

A second `isPrimary` is **demoted, not dropped**, with a `caution` explaining why: the diagnosis is
real, only the flag is wrong, and a note that loses a secondary diagnosis is worse than one with a
demoted flag.

### 8.3 At least one primary — repair

Fixes a measured **0 out of 13**: the prompt says "exactly ONE isPrimary=true" and the model simply
never emitted the flag, so every note came out with no primary diagnosis — which is billing-invalid,
since the E&M code attaches to it. It cannot be fixed in the response schema either: all action kinds
share one flat object schema, so making `isPrimary` required would force it onto every action of every
kind. Deterministic promotion is the only place left.

**Incremental exception:** when the chart already carries a primary, an addendum's new diagnoses are
additions, never usurpers — "allergic reaction to amoxicillin" from a phone-call addendum must not
demote the visit's actual primary.

---

## 9. `applyBackstops` — append what the model forgets

These do not reject anything; they add actions. Each is additive and visible, carrying the sentence it
came from so the provider reviewing it sees exactly why it is there.

| # | backstop | why |
|---|---|---|
| 1 | **Vitals sweep** | the model reports the first reading and drops rechecks — most often the second of two serial blood pressures, or a vital phrased indirectly ("slightly tachycardic at 115"). Only an *identical* reading is skipped, never the whole field, because the recheck case is the point |
| 2 | **Already-performed test → provider note** | a test the narrative reports as done *with a result* must not be re-ordered. The prompt says so; the model re-orders anyway in roughly two cases in three (rapid strep, rapid flu), so the order becomes a note quoting the sentence |
| 3 | **eRx reminder** | the narrative says a prescription is being sent, a medication was charted, and nothing tells the provider that easy-chart does not transmit scripts |
| 4 | **Numeric junk strip** | the model attaches readings to steps that have none (`value: 0.0012` on a patient instruction) — removed so it never leaks into a payload or a log |

---

## 10. Review-only guards — 146 rejections

### 10.1 `rosActionIsVerbatim` — **128 firings, the busiest guard in the system**

> `"Denies sinus pain" is not something the dictation says, so it was not charted`

Runs **first**, before a round-trip is spent on anything else. Review may only propose a ROS negative
whose every substantial word appears in the dictation. The prompt demands a near-verbatim quote and
the model still fabricates the classics for the complaint — "Denies sinus pain" on an eye visit.
Prose cannot enforce this; a word check can.

Note what this means for the numbers elsewhere: these 128 are the guard working, not a conversion
loss. Those intents were wrong.

### 10.2 `dropOrphanedRemovals` — **1 firing**

> `the replacement for "X" could not be charted, so it was left in place`

A correction card is a **pair** — remove the wrong item, add the right one. When a guard refuses the
addition, the removal must go with it. Left alone it becomes a bare removal that takes the item off the
chart and puts nothing back: reproduced twice on the corpus as a note left with **zero diagnoses**,
which is billing-invalid and strictly worse than the wrong code it "fixed". Surgical rather than
dropping the whole card, so a valid unrelated action on the same card survives.

### 10.3 `swapCancelsItself` — drops the whole card

> `the replacement diagnosis resolved to the same code it would replace, so nothing changed`

A swap whose replacement re-resolves to the code it replaces would churn the chart and change nothing.
It happens when the ICD search was itself the reason the first code was wrong.

### 10.4 Empty suggestion — dropped

A card whose every action was refused has nothing left to offer, so it is not shown as a question the
provider cannot act on. The refusals still surface in `rejected`.

---

## Summary: where guard activity concentrates

| guard | firings | is the model wrong, or the pipeline? |
|---|---:|---|
| `rosActionIsVerbatim` (review) | 128 | model — fabricated negatives |
| `guardExamFinding` | 55 | model — misunderstands a positives-only section |
| `guardVital` | 36 | mostly the dictation genuinely has no number |
| `guardDiagnosisLike` (etiology + lookup + history) | 20 | model — wrong qualifier or unconfirmable code |
| `guardRosFinding` | 11 | model — polarity not stated |
| `guardRemoval` | 6 | model — removal against an empty chart |
| `enforceDiagnosisInvariants` | 1 reject + silent repairs | model — duplicate or missing primary flag |
| `dropOrphanedRemovals` (review) | 1 | protects the chart from a half-applied swap |

**Every one of these is a rejection the system got right.** None of the 260 is a case of a correct
intent failing to convert — those live one layer further on, in catalogue matching, and are counted in
[INTENT-TO-CHART.md](./INTENT-TO-CHART.md).

---

## Reproducing the counts

```bash
# the run
npx tsx tools/easy-chart-eval/run-harvested.ts --quality OK --concurrency 8 --out <dir>

# the counts read `rejected`, `stageRejected` and `reviewRejected` out of <dir>/*.result.json,
# grouping by reason with quotes and codes normalised away
```
