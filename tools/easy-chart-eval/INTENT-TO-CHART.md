# From "chart this" to a row in Ottehr: the pipeline, its guards, and where intent is lost

This answers a question the section scores do not: **given that the model wants to chart something,
how reliably does that become a supported Ottehr chart change?** The eval's recall and precision
measure the model's clinical judgement against a gold note. They say nothing about the plumbing —
whether an action the model correctly decided on survives validation, matching and writing.

Every figure below is from `run-OK396`: 396 screened-good cases, configuration B,
`gemini-3.1-flash-lite`, review pass on. Reproduce with the commands at the end.

**Headline: the model emitted 6,268 chartable intents; 422 never reached the chart — 6.7%.** Of
those, 45 are an eval artifact production does not have, leaving **6.0%**, and only about 108 are
genuine intent-to-chart conversion failures — **1.7%**. Most of what is dropped is the system
correctly refusing a wrong action rather than failing to convert a right one.

### How the denominator is built

An intent is one action the model emitted and the pipeline had to deal with. It is NOT the `actions`
array alone: `applyGuards` splits its input into survivors and rejections, so `actions` is already
post-guard, and the review pass's applied actions are not in that array at all — they are folded into
the simulated chart carrying `source: "review"`.

```
                       emitted   rejected by guards   reached the executor / applied
plan                      5,190                 114                           5,076
review                    1,078                 146                             932
                        -------              ------
intents                   6,268                 260
executor skipped (both stages)                                                   162
never reached the chart                          422  = 6.7% of intents
```

Counting `422 / 5,076` instead — the post-guard plan count — is wrong in both directions at once: it
omits the rejected actions from the denominator and omits review's 1,078 entirely. That error is the
difference between 8.3% and 6.7%.

---

## 1. What defines "what can be charted"

The agent's entire world model is one file: `packages/utils/lib/easy-chart/registry.ts`. Each
capability entry is the single source for four things that must not drift apart:

| field | what it drives |
|---|---|
| `surfaces` | which calls may emit this action at all (plan, review, and the per-section stages) |
| `required` | fields without which the action is rejected server-side before anything else runs |
| `chartField` | which part of the chart snapshot the action reads and writes |
| `promptDoc` / `authoringDoc` | the prose the model reads describing the action |

This coupling is deliberate and was not free: in the first implementation five actions existed in the
response schema while being described in no prompt, so the model could never emit them. Anything
added to the vocabulary now arrives with its own description or it does not exist.

`authoringDoc` is rendered only for surfaces that COMPOSE a note; the review surface sees
`promptDoc` alone. That split exists because guidance about writing content from scratch, given to an
audit pass, measurably degrades it — three separate leaks cost a run each.

**Where this is thin.** The registry describes each action's *shape* well. What it describes only in
prose, and therefore only as well as the prose is written, is Ottehr's *semantics*: that a ROS finding
stores polarity in the field key rather than a boolean, that exam findings are positive observations
only, that a lab order needs a diagnosis on the chart first. Each of those is a real constraint of the
data model expressed as an English sentence the model may or may not follow — and each has a guard
behind it precisely because prose alone was not reliable.

---

## 2. The path an intent takes

```
narrative
  │
  ├─ 1. PROMPT ASSEMBLY        buildPrompt(surface, tail) — static prefix + per-call tail
  │                            utils/lib/easy-chart/prompt.ts
  │
  ├─ 2. MODEL CALL             structured output against a per-surface JSON schema
  │                            zambdas/src/ehr/easy-chart-shared/model.ts
  │                            retry ×2, then escalate to a backup model
  │
  ├─ 3. PARSE + COERCE         numeric fields declared as strings, coerced back
  │                            utils/lib/easy-chart/schema.ts
  │
  ├─ 4. SERVER GUARDS          applyGuards — deterministic, before the client sees anything
  │                            zambdas/src/ehr/easy-chart-shared/guards.ts
  │
  ├─ 5. CLIENT EXECUTION       runPlan → per-kind handler → catalogue match → writer
  │                            apps/ehr/src/features/easy-chart/executor/
  │
  └─ 6. CHART                  FHIR rows via the Oystehr SDK
```

Steps 4 and 5 are where intent is lost, and they lose it for very different reasons.

---

## 3. Step 2-3: the model call itself

The response schema is built per surface from the registry, so the model can only name actions that
surface offers. Two traps shaped it, both discovered by runs going wrong:

- **numerics declared as strings.** A numeric field invited a digit loop that ran to the output cap;
  every number is declared as a string and coerced afterwards (`coerceNumericFields`).
- **per-field `maxLength` caps.** Same failure in prose fields. Note that **Gemini does not enforce
  `maxLength`** — measured: a `newText` capped at 8,000 characters ran past 50,000. The cap documents
  intent; it does not prevent the loop. A repetition loop inside one string field is still the single
  largest source of wasted output.

**Measured loss here:** 18 planner calls and 25 review calls out of ~400 each needed the backup model
(`error` in most cases — transient network — plus 3 truncations). A retry recovers the call; nothing
is silently dropped. This stage is not where intent goes missing.

---

## 4. Step 4: server-side guards — 260 rejections

These run before the client and are deterministic. Each rejection is returned to the caller with a
reason, so nothing vanishes silently — but the intent does not reach the chart.

### Plan and stage surfaces: 114 rejections

| count | reason | reading |
|---:|---|---|
| 37 | `"X" asserts a normal rather than an abnormality` | model tried to chart a normal as an abnormal exam finding |
| 28 | `no reading for vital-temperature was given` | a vital named with no number anywhere in the dictation |
| 13 | `"X" is a negative — exam findings are positive observations only` | same confusion as the first row, stated the other way |
| 9 | `CODE asserts "X", which the visit does not describe` | etiology qualifier guard: a code claiming a cause the note never gives |
| 6 | `the chart is empty, so there was nothing to remove` | removal against an empty chart |
| 5 | `"X" is a negative, which agrees with the charted normal` | removal that would have deleted a correct normal |
| 5 | `no ICD-10 code could be confirmed` | code lookup failed |

By kind: `add-exam-finding` 50, `set-vital` 38, `remove-exam-finding` 11, `add-condition` 8,
`add-diagnosis` 7.

**Two thirds of plan-side rejections are one misunderstanding**: the exam section stores positive
observations only, and the model keeps trying to chart negatives and normals into it. That is a
semantic property of Ottehr's exam model that the prompt states and the model still gets wrong 50
times in 396 visits. This is exactly the concern made concrete — the definition is prose, the
model does not reliably honour it, and a guard catches it afterwards.

### Review surface: 146 rejections

| count | reason |
|---:|---|
| 128 | `"X" is not something the dictation says, so it was not charted` |
| 11 | `"X" does not say whether the patient reports or denies it` |
| 3 | `CODE asserts "X", which the visit does not describe` |

The 128 are the verbatim guard on review's ROS check: review may only chart a negative whose words
appear in the dictation. Without it, review invents the "classic" negatives for the complaint. This
guard is doing the most work of any single guard in the system, and it is a *correctness* guard, not a
plumbing one — those 128 intents were wrong and should have been dropped.

---

## 5. Step 5: client execution — 162 skips

Here the action was well-formed and allowed, and still did not become a row.

| count | reason | what it means |
|---:|---|---|
| 75 | `no review-of-systems finding in the catalogue matches "X"` | **the biggest real plumbing loss** |
| 45 | harness-only: bulk mode refused to disambiguate | eval artifact, see below |
| 14 | `no procedure in the catalogue matches "X"` | same class as the ROS misses |
| 10 | `"X" is already on the chart` | correct no-op |
| 7 | `"X" needs a diagnosis on the chart before it can be ordered` | ordering constraint |
| 5 | `no charted procedure matches "X"` | update against a procedure that was never created |
| 4 | `"X" is not on the chart, so nothing was removed` | |

By kind: `add-ros-finding` 75, `remove-diagnosis` 49, `add-diagnosis` 10, `add-procedure` 9,
`add-radiology` 7, `update-procedure` 5, `add-surgical-history` 5.

### The 75 ROS catalogue misses are the clearest answer to the question

The model decided to chart a symptom, the decision was clinically right, the guards passed it — and
the ROS catalogue has no entry for that wording, so it was dropped. The ROS catalogue is a fixed list
of configured symptoms; the provider's vocabulary is not. This is a pure intent-to-chart conversion
loss, and it is the largest one in the system.

The exam section has a mitigation the ROS section lacks: when no exam leaf matches, the text is
written into that exam card's free-text note instead of being dropped (24 times in this run). ROS has
no such fallback.

### The 45 "bulk mode" skips are an eval artifact, not a product loss

In the app, an ambiguous match opens a picker and the provider chooses. The harness has no provider,
so it throws. `AMBIGUITY_RATIO = 0.75`: a runner-up scoring within 75% of the top match is treated as
genuinely ambiguous. In production these 45 become a question to the user; in the eval they become a
loss. **Any conversion-rate number from the harness understates production by these 45**, and
conversely, production pays for them in provider clicks rather than in dropped intents.

### `removeTargetMissing` — 50

A `remove-*` step naming something that is not on the chart. The prompt tells the model to copy the
wording from the ALREADY ON THE CHART block; when it names what it is *correcting* instead of what is
*listed*, the removal points at nothing. Measured across a corpus, most misses shared not one word
with any charted line.

---

## 6. Where the losses are, ranked

| rank | loss | count | is it a plumbing failure? |
|---:|---|---:|---|
| 1 | review ROS verbatim guard | 128 | No — these intents were wrong |
| 2 | ROS catalogue has no match | 75 | **Yes — pure conversion loss** |
| 3 | exam positives-only confusion | 50 | Semantic: the model misunderstands the data model |
| 4 | removal target not on the chart | 50 | Semantic: the model names the wrong string |
| 5 | ambiguity, no one to ask | 45 | Harness only; production asks the provider |
| 6 | vital named with no reading | 32 | Mostly the dictation genuinely lacks a number |
| 7 | procedure/radiology catalogue miss | 26 | **Yes — conversion loss** |
| 8 | code lookup failed | 7 | Conversion loss |

**Genuine intent-to-chart conversion losses: ~108 of 6,268 intents, about 1.7%.** The rest are either
the system correctly refusing a wrong action (260 guard rejections, of which the 128 review-ROS ones
are the guard doing its job), or an eval artifact (45).

Arithmetic, so it can be checked: 114 plan-side rejections + 146 review rejections + 162 executor
skips = 422 dropped, against 6,268 intents. `stageRejected` is 0 because this was a monolith run with
no per-section stages.

---

## 7. Honest limits of this measurement

- **The harness stubs some catalogues.** eRx, labs and imaging resolve a dictated name to itself, so
  their real-world match failures do not appear here. Exam and ROS use the REAL matchers, which is why
  their losses are visible and trustworthy; the 26 procedure/radiology misses come from real static
  lists, but the lab and medication conversion rate is **not measured at all** by this run.
- **Production has a provider in the loop.** The 45 ambiguity skips, and some share of the catalogue
  misses, become questions rather than losses.
- **These counts are one run.** Guard counts are deterministic given the same model output, but the
  model output is not deterministic; single-digit differences between runs should not be read as
  changes.
- **The 7.7% figure counts actions, not clinical significance.** One dropped diagnosis matters more
  than ten dropped ROS rows, and this document does not weight them.

---

## 8. What would move the number

1. **Give ROS the fallback exam already has.** 75 losses, the single largest conversion failure, and
   the exam section already demonstrates the fix works.
2. **Make the exam positives-only rule structural rather than prose.** 50 rejections come from the
   model charting negatives into a positives-only section. A separate action kind for a negative
   finding — which the ROS vocabulary already has — would make the mistake unrepresentable rather than
   caught after the fact.
3. **Measure the stubbed catalogues.** The medication and lab conversion rate is currently unknown,
   and eRx is the path where a failure is most visible to a provider.
4. **Enforce `maxLength` after parsing.** The provider ignores the declared cap; a looped string that
   finishes under the output limit currently reaches the chart intact.

---

## Reproducing

```bash
# the run these numbers come from
npx tsx tools/easy-chart-eval/run-harvested.ts --quality OK --concurrency 8 --out <dir>

# per-run report: sections, voiced/unvoiced composition, planner → review split
npx tsx tools/easy-chart-eval/report-run.ts <dir>

# the loss tally in sections 4 and 5 reads `rejected`, `stageRejected`, `reviewRejected`
# and `state.skipped` out of <dir>/*.result.json
```
