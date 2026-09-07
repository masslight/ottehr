# Easy Chart evaluation harness

A **local tool**, deliberately not a deployed endpoint. In the previous implementation the LLM judge
shipped as a normal authenticated zambda, which means anyone holding a project token could spend
model budget scoring arbitrary text. Everything that costs model budget lives here.

## What is in the corpus, and what is not

`cases/` holds **twenty synthetic provider dictations** covering common urgent-care presentations.
They were written by hand rather than taken from real visits, and **there are no gold notes for any
of them.** So they cannot answer "did the planner match what a clinician wrote".

What they can answer, cheaply and on every change, is _"is the output internally correct and
clinically sane"_: are the codes real, is there exactly one primary diagnosis, did the negated
findings stay out, did the units convert, did a stated follow-up produce a disposition, did every
step report an outcome. `expectations.ts` records the per-case facts that are derivable by reading
the narrative — nothing there is a judgement about what a clinician would have charted.

The heavier loop — real (transcript, gold note) pairs — **does not transfer.** That corpus was PHI:
it lived in gitignored directories and was never committed, correctly. Harvesting real cases again
needs access to a live environment and whatever approval that carries, so treat it as a task with a
lead time, not a script you run on day one. **The ignore rules for the corpus directories are
already in place** (`harvested-cases/`, `harvested-results/`, `results/`) — they were added before
the first harvest, not after.

## Running it

```bash
# every case against a local zambda server
npx tsx tools/easy-chart-eval/run.ts --url http://localhost:3000 --token "$TOKEN"

# one case
npx tsx tools/easy-chart-eval/run.ts --case case-07 --token "$TOKEN"

# keep the raw plans for inspection (gitignored output directory)
npx tsx tools/easy-chart-eval/run.ts --token "$TOKEN" --out tools/easy-chart-eval/results
```

## Start the server WITHOUT file watching

```bash
cd packages/zambdas && NODE_OPTIONS='--preserve-symlinks' \
  npx tsx src/local-server/index.ts -- secrets=.env/zambda-secrets-local.json
```

NOT `npm run zambdas:start`. That runs `tsx watch --include './src/**/*'`, so editing anything under
`packages/zambdas/src/` restarts the server — and a restart mid-run kills every remaining case with
`fetch failed`. It happened twice while this harness was being built, once from each side of the
keyboard, and cost about sixty paid cases: the first thirty minutes of a run survive and the rest is
gone. Changing the model constant to start a second experiment is exactly the edit that does it.

The trade is that a model or prompt change now needs a manual restart to take effect. For eval runs
that is the right way round — a restart you asked for beats one that lands halfway through forty
billable cases.

## Comparing runs

```bash
# terminal tables + a self-contained HTML page written into the current run's directory
npm run easy-chart:eval:report -- <baselineRunDir> <currentRunDir>

# several runs against one baseline, terminal only
npm run easy-chart:eval:report -- run-a run-b run-c --no-html
```

Every view is a DELTA, because a single number cannot tell you whether a change helped: a run that
lifts diagnosis recall while dropping four exam findings improves the headline and worsens the note.
The per-case table is the one to read — a total that moves by +0.002 has, in practice, been fourteen
of twenty cases moving between -0.19 and +0.33.

It reads `summary.json` and `*.score.json` and never `*.result.json`, which is where the clinical text
lives; the score files are counts and case ids only. The HTML it writes is therefore free of patient
data, and it still lands in a gitignored directory on purpose.

Authenticate with a `client_credentials` token for the project's test M2M client: the endpoints
recognise it and skip the role check, because a service client has no user profile and could never
pass one.

The runner exits non-zero when any deterministic check fails, so it can gate a prompt change.

## Where the checks live

The scorer itself is `packages/utils/lib/easy-chart/eval-scorer.ts`, with its own unit tests over
committed fixtures — so the rules run in CI without a model or a live environment, and this runner
only supplies real plans to score. That split is deliberate: the deterministic scorer earns its keep
before the LLM judge does, and it must never be the thing that is skipped because a hardcoded path
did not exist on someone's machine.

## Still to build (Phase 7, in order of value)

1. **A harvester** for real (transcript, gold note) pairs from a live environment, plus a
   deterministic gold-note renderer so the two are comparable. Needs approval; has a lead time.
2. **A transcript-derivability pass** that stamps each harvested gold item with whether it was even
   _hearable_. A gold note contains PMH, intake medication lists and clicked exam findings the
   ambient recording never heard; scoring the planner against those produces a meaningless number
   that never improves. The headline fidelity score must count derivable items only.
3. **The LLM judge** (prompt in `docs/easy-chart-prompts.md`, schema in
   `docs/easy-chart-code-to-carry-over.md` §6), for free text and semantics only. It must also report
   `extra[]` — what the planner charted that the gold note does not contain. Misses alone will not
   show you over-charting.
4. **A replay harness** running captured actions through the real client matchers, with assertions,
   over committed fixtures. This is where exam/ROS mismatches show up. The previous version printed
   to the console, asserted `expect(true).toBe(true)`, and was skipped unless a hardcoded
   `/private/tmp/…` path from one developer's machine existed. Do not repeat that.
5. **A chart-wipe script** for an encounter, so a re-run does not start dirty.

## Running another implementation's prompt through this stack

`EASY_CHART_PROMPT_FILE=<path>` replaces the static instructions for the `plan` surface only — the
stages and the review pass keep their own prose, so a stage can never be served a prompt written for a
different vocabulary. Unset everywhere but a local experiment; see the doc comment on `promptOverride`
in `packages/utils/lib/easy-chart/prompt.ts` for why it must stay that way.

```bash
# serve a foreign prompt
cd packages/zambdas && EASY_CHART_PROMPT_FILE=/abs/path/prompt.txt \
  NODE_OPTIONS='--preserve-symlinks' npx tsx src/local-server/index.ts -- secrets=.env/zambda-secrets-local.json
# confirm it took: the server logs "prompt <n> chars" per call
```

Two caveats that decide whether the comparison means anything:

- **Check the action vocabulary first.** A foreign prompt that names fields our response schema lacks
  will have them silently dropped. Dump both schemas and diff the `kind` enums and the property names
  before spending a run. Against `dabrams/otr-2811-easy-charting` the enums matched (33 vs our 34, the
  extra being `reply`), but their `set-vital` carries structured `value`/`systolic`/`diastolic`/`unit`
  where ours carries a `display` string parsed server-side — so their vital prose cannot be evaluated
  through this hook at all.
- **A number from another branch's harness is not comparable to a number from this one.** Different
  scorer, different voiced-tagging, different denominators. The only comparable measurement is the
  foreign _prompt_ run through _this_ harness, which is what the hook is for.

### Why dabrams scored higher, settled: THINKING WAS OFF

The gap was not the prompt, the scorer, the corpus, the resolvers or the model. It was one missing key
in `generationConfig`.

`packages/zambdas/src/ehr/easy-chart-shared/model.ts` sent no `thinkingConfig` at all. That does not
mean "let the model decide" — on `gemini-3.1-flash-lite` the provider default reports
`thoughtsTokenCount: 0`. Verified across four 40-case runs made after `thinkingTokens` started being
recorded: planner `think=0`, review `think=0`. The planner was extracting an entire visit in one
forward pass with no reasoning, and so was the review pass. The dabrams implementation has carried
`thinkingConfig: { thinkingBudget: 2048 }` (alongside `maxOutputTokens: 16384`) the whole time.

Same model, same corpus, same harness, `plannerOnly` scope, `exam` excluded — one line of config:

|                       | F1        | gold matched | diagnoses | ROS    | ROS actions emitted |
| --------------------- | --------- | ------------ | --------- | ------ | ------------------- |
| dabrams `run40`       | 0.399     | 89           | 13        | 69     | 104                 |
| ours, before          | 0.332     | 72           | 9         | 59     | 76                  |
| **ours, thinking on** | **0.403** | **93**       | **18**    | **72** | 93                  |

In `final` scope the same change takes 0.354 → **0.427** and 82 → **104** matched items, ahead of their
0.404 / 94. It costs 62k planner thinking tokens per 40 cases, and considerably more on review — that
pass also went from 40 to ~48 calls and its output tokens rose several-fold. Budget for it.

**How the other hypotheses ruled themselves out**, all on `gemini-3.1-flash-lite`, 40 cases:

| experiment                                                       | F1        | verdict                                                     |
| ---------------------------------------------------------------- | --------- | ----------------------------------------------------------- |
| their static prose verbatim (`run-40-H-theirprose`)              | 0.355     | +0.023, from diagnoses and E&M — not ROS, which got _worse_ |
| empty free-text-field worklist in the tail (`run-40-I-worklist`) | 0.340     | inside noise; diagnoses +4, ROS −4                          |
| narrative first in the tail, their layout (`run-40-J-narrfirst`) | 0.267     | clear regression — our narrative-last layout is better      |
| **thinking budget 2048 (`run-40-K-thinking`)**                   | **0.403** | the cause                                                   |

Two things worth keeping from the prose comparison, both ported:

- `set-em-code` gained their operational hint — _"most visits where you start an antibiotic, give an
  injection, do a procedure, or order an x-ray lean level 4"_. Gold is 30/40 level 4, and this moves
  planner-scope E&M exact from 4 to 7 (`run-40-L-final`) at a ~0.005 F1 cost elsewhere. Revert the one
  parenthetical in `registry.ts` if that trade stops being worth it.
- The PATIENT STATUS line now names the E&M family it implies, not just the status. The two branches
  were asymmetric in the worst direction: the branch with no information spelled out which family to
  use, and the branch that knew the answer stated a bare fact.

**Their E&M number is not a like-for-like target, and the runner now matches their input anyway.**
`inferPatientStatus(gold)` in their runner reads `gold.billing.emCode.code` and maps `9920x → new`,
`9921x → established` — the family half of the code being scored, handed to the model as input. It
matches gold exactly: 35 new / 5 established. Hence zero family errors against our 16. On the 23 cases
where our corpus carries a real `meta.patientStatus`, their exact-match rate is 11/23 — identical to
ours before any of this work, which is the number that actually compares the two implementations.

`resolvePatientStatus` in `run-harvested.ts` now falls back to the same gold-family inference for the 17
cases that have no harvested status, because the alternative measures our own fallback rather than the
model: the harness has no encounterId and runs against a simulated chart, so there are no prior
encounters for the endpoint to count even in principle, and nothing about the family can be recovered
offline. It cannot leak the LEVEL — the last digit is the whole of what this metric scores — but it is
weaker evidence than a harvested status, so **read the `harvested` column, not the total.** `report.ts`
splits E&M by `patientStatusSource` (`harvested` / `gold-family` / `none`) for exactly this reason. The
total is now comparable to their 20/40; the `harvested` subset is what says whether anything improved.

Note also that thinking _hurt_ E&M on that honest subset (11/23 → 7-8/23) while helping every other
section. E&M is the one metric that needs its own investigation rather than more reasoning.

### The review pass now WRITES, and what that does to `final`

Review used to return questions the provider read in the chat panel and acted on by hand. It now applies
what it finds, through the same per-intent handlers the planner uses — so the note a provider signs is
the reviewed one, and `final` scope is measuring the product rather than a hypothetical.

`final` was already computed this way in the harness (review's actions have always been folded into the
state with `source: 'review'`), so the SCOPE did not change. What changed is that the harness and the app
now agree on the one action they treat differently:

- **`edit-note-text` on a field that already has prose is NOT applied**, on either side. It becomes a
  card the provider confirms. The shared predicate is `overwritesWrittenNoteField` in
  `utils/lib/easy-chart/note-fields.ts`, and both callers use it so they cannot drift; the harness counts
  the queued ones in `counters.pendingNoteEdits`, which read 0 on every run before this because nothing
  ever wrote to it. It is now ~18 per 40 cases, i.e. review's two text-rewriting checks (1 and 6) were
  being credited to `final` as if a provider had accepted them sight unseen.

Three deterministic filters were added on the review surface, each for a failure this corpus produced.
They are unit-tested in `packages/zambdas/test/easy-chart-review-apply-guards.test.ts`:

| filter                             | what it stops                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| verbatim gate on `add-ros-finding` | a "classic" negative for the complaint that the provider never voiced                                   |
| `dropOrphanedRemovals`             | a swap whose replacement a guard refused, leaving a BARE removal — how a note ended with zero diagnoses |
| `swapCancelsItself`                | a replacement that re-resolved to the code it replaces, churning the chart for nothing                  |

**Two reporting bugs were fixed, and they change how old numbers read:**

- `triggers` were computed PER SUGGESTION and only the first card's set was kept, so `complied` was
  whatever the first card happened to do. Compliance is a property of the whole response and is now
  computed over every surviving action, plus the raw model output (a disposition proposed and then
  dropped by a guard still answered the trigger).
- review's `fired` keyed off disposition language in the narrative alone. That is the right question for
  the planner, which starts from an empty chart, and the wrong one for review: when the plan had already
  charted the disposition, review correctly said nothing and the report called it "the trigger fired and
  the model ignored it". Six of six, every run — `fired&declined 6` in every historical summary in
  `harvested-results/` is this bug, not a model failure. Review now reports the trigger it was actually
  given (`mustAddress`), and the runner lets a later surface override only when its own trigger fired.

### A developer note reached the model

`set-em-code`'s `promptDoc` is assembled verbatim into the plan, coding AND review prompts. A note
documenting the level-tiebreak trade-off — including our own eval counts, and a restatement of the rule
we had decided _not_ to adopt — was written inside that template literal rather than above it. It is a
`//` comment now.

**Measured: it made no difference to the scores** (`run-40-Q-reviewapply` carried it,
`run-40-R-noteleak` is the same tree without it; E&M exact 6/23 either way on the honest subset). Fix it
anyway — a note about our eval numbers is not something to send a model — but the level drop that ran
alongside it was the tiebreak, not the note. See below.

The lesson is still cheap to state: **`promptDoc` is prompt text.** A note about the prompt goes above
the string, never inside it.

### The E&M level tiebreak does not belong on the review surface

`set-em-code`'s `promptDoc` is shared by all three surfaces, so _"When torn between two levels choose
the LOWER"_ was also being handed to the review pass — whose check 4 exists specifically to catch an E&M
that came out too low. Review was given a rule to round down and a check that asks it to round up, and
the corpus says which side won: on the 23 cases with a known patient status, 15 of the 16 misses were
under-codes. The dabrams review prompt carries no such tiebreak; theirs is inline and planner-only.

The tiebreak now lives in `PLAN_RULES` and `CODING_RULES` (`prompt.ts`) — the surfaces that AUTHOR a
code — and `easy-chart-review-coherence-swap.test.ts` pins that it is absent from review. Paired runs on
the same tree, 40 cases:

|                                             | E&M exact, planner → final | level match, final | primary dx, planner → final | dx  | CPT   | ROS |
| ------------------------------------------- | -------------------------- | ------------------ | --------------------------- | --- | ----- | --- |
| tiebreak on all three surfaces (`run-40-R`) | 6 → 9                      | 10                 | 11 → 12                     | 17  | 4     | 71  |
| tiebreak on plan/coding only (`run-40-S`)   | 8 → **13**                 | 14                 | 8 → 8                       | 15  | **7** | 75  |
| the same, repeated (`run-40-S2-repeat`)     | 8 → **13**                 | 13                 | 7 → 8                       | 16  | **7** | 73  |

**+4 exact E&M in final scope, reproduced, and the mechanism is the one predicted:** review can now
correct an under-coded level instead of being told not to. It leaves the planner's billing-conservative
policy exactly where it was, which is the point — that policy is a deliberate choice (see the
`set-em-code` comment in `registry.ts`), and this change does not touch it.

The repeat is why the pair is worth running. Primary dx read 12 in `run-40-R` and 8 in both `S` runs,
which looks like a cost of the change until you notice `R` is the outlier: 8 is also what `run-40-P` and
the dabrams run both land on, and planner-scope primary dx has ranged 5–13 across `harvested-results/`
with nothing aimed at it. CPT (+3) and E&M (+4) reproduce; the primary-dx "regression" does not exist.

### What is still behind the dabrams run, honestly

On the 23 cases with a harvested patient status — the only E&M comparison that is not measuring the
gold-family fallback — theirs is 11/23 and ours is 7-8/23. That difference is the planner's level
tiebreak, and it is the trade-off already documented on `set-em-code`: replacing _"choose the LOWER"_
lifts the honest subset to ~13/23 and costs ~3 primary diagnoses. It is a billing-policy decision, not
an engineering one, and it is the one lever left on E&M.

Everything else in `final` scope is at or ahead of theirs: diagnoses 15-16 vs 14, ROS 73-75 vs 72, CPT
7 vs 1, primary dx 8 vs 8, disposition trigger 6/6 answered vs 5/5. (`exam` is not comparable — see
above.)

### Metric parity with the dabrams harness

The scorer is a faithful port, so it computes the same things on both sides. What differed was what the
RUNNER handed it. Diffing their `run40/summary.json` against ours key by key turned up nine
discrepancies; six were ours to fix, three were correct as they stood.

**Fixed — the runner was dropping data the scorer already knew how to aggregate:**

- **Escalation, both phases.** The scorer keys its bucket on `primaryFailed` and `reason`; the runner
  set neither, so every case fell through to "the primary was fine" and `reasons` stayed empty — a run
  that escalated to the backup on half the corpus reported the same escalation summary as a clean one.
  Review was worse: its `escalation` object came out empty and all 40 cases landed in `noData`, so the
  surface that writes into the note could not report a failure at all. `escalationRecord()` now maps
  `EscalationInfo` onto the shape the aggregate reads, for planner and review alike.
- **Disposition patterns.** `dispositionTrigger.matchedPattern` was being filled with the TRIGGER's
  name, so `firedByPattern` had exactly one key and could say that some disposition language went
  unaddressed but never which kind. It now carries the pattern's own label, and the summary reads
  `fired by pattern: referral 1, emergency-care 1, follow-up 1` the way theirs does.
- **`patientStatusSent`** is recorded per case, so E&M can be read on the subset where the family was
  knowable without recomputing it by hand. See the E&M section.
- Review token usage and `thinkingTokens` (both phases) — see the thinking section; every earlier run's
  cost was short by a whole LLM pass.

**Correct as they stood, and worth not "fixing":**

- `freeText.additionalInformation.predictedPresent` and `mechanismOfInjury.predictedPresent` read 0 for
  us against their 4-5. The sim writes any field in `NOTE_TEXT_FIELDS`; the model simply never emits
  `edit-note-text` for those two. The zero is the measurement working.
- `medsCombined.intentMatched` is derived inside the scorer from intent-voiced gold. Ours is 0 because
  no predicted medication matched one, not because it is unwired.
- `usage.planner.cacheWriteTokens` reads 20911 for them and 0 for us. Their Gemini branch does not set
  it either — that figure comes from the three cases that escalated to the ANTHROPIC backup, which is
  the only provider reporting cache-creation tokens. Zero is right for a run with no escalations.

**Still a gap, and a product one rather than a measurement one: `counters.examComments`** reads 17 for
them and 0 for us, and it will keep reading 0 until the executor grows the write path. When the exam
catalogue returns no match — or the finding is a negation whose only matches are abnormal checkboxes, or
the best match falls below their confidence floor — their client writes the dictated wording into the
exam section's FREE TEXT. Ours calls `skipped()` in `addFromCatalogue`: the provider is told the finding
was skipped and has to type it themselves. Nothing on our side exists to build on — no section
inference, no exam-comment write target, no type — so this is a feature, not a wiring fix. Its size is
measured: 17 dictated exam findings across 40 visits that we currently drop.

### A correction this turned up

With the loose regex the disposition trigger fired 6 times in 40 cases and the model proposed a
disposition on 0 of them, which read as the model ignoring a deterministic guard. With
`detectDispositionLanguage` wired in, it fires on real instructions only and the model complies every
time (`fired&proposed 3, fired&declined 0` over the first 10 cases). The guard was crying wolf; the
model was not disobeying.

### Monolith vs one stage (`--add-stages findings`)

Same tree, 40 cases. The `findings` stage runs after the monolith and owns exam, ROS and vitals.

|                                | monolith | hybrid `+findings` | + review-seeding fix | dabrams, fresh run |
| ------------------------------ | -------- | ------------------ | -------------------- | ------------------ |
| E&M exact, planner → final     | 8 → 12   | 8 → **17**         | 8 → 16               | 10 → 19            |
| E&M exact, harvested-status 23 | 7/23     | **10/23**          | 9/23                 | 11/23              |
| E&M level, final               | 13       | **18**             | 17                   | 19                 |
| primary dx, final              | 8        | 9                  | 8                    | 7                  |
| diagnoses matched              | 16       | 13                 | 14                   | 14                 |
| ROS matched                    | 74       | **91**             | 90                   | 72                 |
| exam matched                   | 31       | **43**             | 43                   | 15                 |
| CPT matched                    | 7        | 5                  | 5                    | 1                  |
| removeTargetMissing            | 2        | 14                 | 14                   | 8                  |
| planner calls                  | 40       | 81                 | 81                   | 40                 |

**One stage buys exam and ROS, and its E&M advantage turned out to be an artifact.** Re-run on the
corrected review prompt (see the saturated-metric section), the ordering on E&M REVERSES:

| corrected-prompt run | E&M exact | discriminating | review's E&M contribution | primary dx | dx     | ROS    | exam   |
| -------------------- | --------- | -------------- | ------------------------- | ---------- | ------ | ------ | ------ |
| monolith             | **26/40** | **3/5**        | **+19**                   | 10         | 13     | 65     | 28     |
| hybrid `+findings`   | 22/40     | 1/5            | +15                       | **12**     | **16** | **82** | **38** |

With the weaker prompt the stage looked worth +5 exact E&M (12 → 17), because review needed the fuller
exam and ROS to judge complexity at all. Once review can read the level off the MDM directly, the
monolith is AHEAD on E&M — and the stage's real contribution is what it actually charts: +17 ROS,
+10 exam, +3 diagnoses, +2 primary dx, for double the planner calls.

So the two are not ranked, they are a choice: the stage buys note completeness, not coding accuracy.

`exam` is not comparable to theirs (see above) — but ROS is, and 90 against their 72 is a real lead.

**The `findings` stage's removals are almost all wasted, and it is a polarity bug.** All 18 remove-\*
actions in the hybrid come from that stage (the monolith emits none), and 14 miss. Looking at what they
target: the chart holds `Denies fever` and the stage emits `remove-ros-finding` for **`Reports fever`** —
the opposite polarity, which was never charted. Likewise `Reports ear pain`, `Reports sore throat`,
`Reports headache` against charts holding the `Denies` form. It also emits
`remove-exam-finding "Nontender"`, and a normal is not a chartable exam finding at all (the catalogue
leaves are abnormal — which is why the review prompt forbids charting exam negatives).

So the stage reads "the patient denies fever" and proposes deleting a positive finding nobody charted.
`FINDINGS_RULES` asks it to reconcile a template's contradicted **exam normals** and says nothing about
ROS, yet 12 of the 18 removals are `remove-ros-finding`. Each wasted one surfaces to the provider as
"X is not on the chart, so nothing was removed". Not yet fixed; it is the obvious next thing on the
staged path, and it is cheap to test because the failure is deterministic.

For the record, this was NOT the review-seeding bug. Seeding review from the accumulated `state` instead
of the monolith's chart is a real fix (it matters in full `--stages` mode, where a stage charts the
diagnoses review corrects), but it leaves removeTargetMissing at 14 — measured, not assumed.

### TRAP 3: the string loop — why review cost 20x what it should

Review was burning **238,398 output tokens per 40 cases against the dabrams run's 11,240**, and 18% of
its calls ended at `MAX_TOKENS` (their 0%). It was not verbosity. Dumping a truncated body — 49,210
characters — showed one repeated token:

```json
{ "kind": "add-diagnosis", "display": "Acute otitis externa",
  "text": "Acute otitis externa, unspecified ear (primary diagnosis updated ...).
           (primary) (primary) (primary) (primary) ..."      <- ~5,000 times, to the cap
```

Two conditions produced it:

- **The flat action shape** (trap 2) offers `text` on `add-diagnosis`, which has no use for it. The
  guard strips such a field — but only after a parse that never happens.
- **`(primary)` is a token from our own chart-state format**, and check 2 said "the add MUST restate the
  removed item's isPrimary status (ALREADY ON THE CHART marks it `(primary)`)" — an invitation to
  express primacy as PROSE. At temperature 0 it self-reinforced.

This is the string analogue of trap 1. The digit-loop guard bounds numeric fields because a JSON number
has no closing token; a JSON string HAS one, but constrained decoding is under no obligation to emit it.

**The fix, three parts:**

1. Every string in every schema carries a `maxLength` (`CAP` in `schema.ts`), so a loop terminates
   inside a valid value instead of destroying the response. Caps are per field and ~4x the longest real
   value, so they can only bite a runaway. `schema.test.ts` pins that no string anywhere — nested arrays
   and the review card included — is left uncapped.
2. `isPrimary` is REQUIRED on the review action shape, giving the model the right place to answer.
3. Check 2 now says to set the boolean and _"never write that marker into any text field"_.

**Measured, same 40 cases, monolith:**

|                          | before  | after      | dabrams |
| ------------------------ | ------- | ---------- | ------- |
| review output tokens     | 238,398 | **14,374** | 11,240  |
| review primary failures  | 7 (18%) | **0**      | 0       |
| E&M exact                | 20/40   | **24/40**  | 19/40   |
| E&M discriminating       | 1/5     | **3/5**    | 4/5     |
| removeTargetMissing      | 3       | **0**      | 8       |
| primary dx               | 10      | 10         | 7       |
| disposition voiced       | 5/6     | **6/6**    | 5/6     |
| meds commitment coverage | 8/12    | **10/12**  | 11/12   |

**-94% output tokens AND better scores**, including the discriminating E&M column — so this is not the
mode collapse the earlier check-4 rewrite produced. The mechanism explains it: a truncated response
threw, retried, and escalated to the backup model, so 18% of visits were reviewed by a different model
on a mangled attempt.

There is a real lesson about the corpus here too: the runaway only fires when a chart-state token is
quotable back into a free-text field. Any prompt that tells the model to "restate" a marker we print is
a candidate for the same failure.

### The prompts, compared line by line

Both implementations' prompt builders are pure functions, so the honest comparison is to build them
with IDENTICAL per-visit inputs and diff the result — that makes the diff a diff of the INSTRUCTIONS
rather than of whatever data each harness happened to render. Sizes:

|               | ours                | theirs              |
| ------------- | ------------------- | ------------------- |
| plan prompt   | 443 lines / 34.8 KB | 558 lines / 48.6 KB |
| review prompt | 295 lines / 22.3 KB | 202 lines / 15.9 KB |

**The review prompt is the interesting one, and it is upside down.** Ours is 93 lines LONGER overall
while carrying HALF the check guidance — 79 lines of checks against their 150. Every one of the ten
checks is shorter in ours:

| check                 | theirs  | ours   |         |
| --------------------- | ------- | ------ | ------- |
| 1 med-name            | 8       | 7      | -1      |
| 2 diagnosis           | 12      | 7      | -5      |
| 3 pertinent-negative  | 17      | 9      | **-8**  |
| 4 em-level            | 13      | 6      | **-7**  |
| 5 secondary-dx        | 10      | 5      | -5      |
| 6 med-reconcile       | 13      | 6      | **-7**  |
| 7 disposition         | 14      | 6      | **-8**  |
| 8 cpt                 | 13      | 5      | **-8**  |
| 9 coherence           | 29      | 15     | **-14** |
| 10 dropped-commitment | 21      | 13     | **-8**  |
| **total**             | **150** | **79** | **-71** |

So ~170 of our 295 lines are something other than the checks. That something is the ACTION SHAPES
block, which is generated from the registry's `promptDoc` strings — and those are shared with the
planner. The review surface is therefore reading planner instructions it cannot act on:

- `add-cpt`'s promptDoc tells it _"emit the add-medication for the drug AND an add-cpt for the
  administration code"_, with the full in-clinic injection/HCPCS table. `add-medication` is not in
  review's vocabulary — `capabilitiesForSurface('review')` has ten kinds and that is not one of them.
- `edit-note-text`'s promptDoc is a page on how to AUTHOR an MDM from scratch, ending with _"every
  patient-FACING part still needs its own add-patient-instruction"_ — also not in review's vocabulary.
  Review only ever uses `edit-note-text` for a targeted correction (checks 1 and 6).
- The per-visit tail renders `AVAILABLE TEMPLATES in this practice: … Do NOT emit apply-template` on a
  surface that has no `apply-template`. (The zambda passes review the real template list, too.)

Grepping the prompt text for action kinds makes it concrete: our review prompt names `add-medication`,
`add-patient-instruction` and `apply-template`; theirs names none of the three. This is the same defect
class as the level tiebreak above — shared `promptDoc` leaking planner-only guidance into the audit —
and that one was worth +4 exact E&M when fixed.

**What the missing check lines actually contained** is the operative detail, not padding. Check 4 is the
clearest case, and E&M is exactly where we are behind:

> theirs: _"…The MDM-complexity logic is identical in both families (the last digit is the level): e.g.
> if a NEW prescription was given (prescription drug management = moderate risk) and the charted code is
> the family's level-3 code (99213 established / 99203 new), suggest the SAME family's level-4 code
> (99214 / 99204); if documentation clearly supports a different level, suggest it."_
>
> ours: _"assess the charted E&M against the documented complexity, WITHIN the correct family for the
> patient's status … If the charted code is in the wrong family, suggest the same-level code in the right
> one."_

Ours states the family rule and omits the LEVEL rule entirely. Theirs names the single mechanism that
turns a 99203 into a 99204 — and 30 of the 40 gold codes are 99204. Same pattern in the others: their
check 7 enumerates the `dispositionType` values and the interval conversion ("in 1 week" → 7), their
check 8 enumerates the billable procedures (splinting, laceration repair, ear lavage, FB removal, I&D,
rapid strep/flu/COVID/RSV, in-office nebuliser), their checks 2 and 9 give worked code swaps
(H66.003 → H66.006, N76.0 → B37.3).

**On the plan prompt** theirs is 115 lines longer, but on `apply-template` — where that length mostly
sits — the two are at PARITY, and an earlier version of this section said otherwise. The mistake was
comparing their whole block against our ORDERING line while ignoring `apply-template`'s 18-line
`promptDoc`. Topic by topic, ours covers strong/specific match only, laterality = the side DIAGNOSED not
examined, bilateral only when both sides are involved, a past problem on the other side being history,
matching by diagnosis rather than by whether imaging happened, and concrete do-NOTs — plus two things
theirs lacks: "never invent a template name" and the generic-category exception (a "Headache" template
for a migraine, paired with an add-diagnosis for the specific code). The only thing theirs has and ours
does not is worked title examples ("AOM Right", "Ankle Sprain"), deliberately not copied: those titles
are from their practice, and the real ones are already listed in our per-visit tail.

Theirs does interpolate the template titles into the TOP of the static instructions, next to the rule
that refers to "the AVAILABLE TEMPLATES above" — which costs them prompt caching, since the prefix is
then per-practice. Ours keeps titles in the per-visit tail and the prefix cacheable.

### E&M exact is a SATURATED metric on this corpus — read `discriminating`

Gold is the family's level-4 code (99204 or 99214) in **35 of the 40 cases**. So a predictor that does
no clinical reasoning at all — "always emit level 4 of the family I was told" — scores **34/40**, above
every implementation ever measured here. That makes the headline number nearly useless on its own: a
rise is equally consistent with better coding and with collapsing onto the mode, and those are opposite
outcomes.

This is not hypothetical. Restoring the level rule to review's check 4 (see the prompt comparison below)
produced this:

|                                     | exact     | on the 35 modal-gold cases | on the 5 cases where gold is NOT level 4 |
| ----------------------------------- | --------- | -------------------------- | ---------------------------------------- |
| monolith, before                    | 12/40     | 10/35                      | 2/5                                      |
| monolith, after the check-4 rewrite | **29/40** | **29/35**                  | **0/5**                                  |
| dabrams, fresh run                  | 19/40     | 15/35                      | **4/5**                                  |
| trivial "always level 4"            | 34/40     | 35/35                      | 0/5                                      |

The 29/40 is mode collapse, not skill: it wins nearly every easy case and loses every case that
distinguishes a coder from a constant. The dabrams run scores lower overall and is **better at the only
cases that discriminate**. The cause was wording added beyond theirs — "an E&M left a level below what
the note supports is under-billing, and correcting it is this check's whole purpose", plus extra
level-4 triggers — which reads as a standing instruction to escalate. Their check 4 states the
level-4 example and then simply says "if documentation clearly supports a different level, suggest it".

Removing that editorialising and adding the downward case explicitly ("Level 3 is right for a
straightforward, low-complexity visit"; "JUDGE THE LEVEL, do not default to one … emit nothing here
when the charted code is already right") recovers the discrimination:

| monolith run      | exact | discriminating | modal | prediction distribution |
| ----------------- | ----- | -------------- | ----- | ----------------------- |
| old prompt        | 12/40 | 2/5            | 10/35 | spread                  |
| over-corrected    | 29/40 | **0/5**        | 29/35 | collapsed — 99204 x32   |
| check 4 corrected | 26/40 | **3/5**        | 23/35 | 99204 x23, 99203 x12    |
| dabrams, fresh    | 19/40 | 4/5            | 15/35 | spread                  |

Better than the old prompt on BOTH axes and no longer degenerate. Against the dabrams run it is ahead
on the headline and one case behind on the discriminating five, which on a five-case sample is parity,
not a win. `easy-chart-review-coherence-swap.test.ts` pins both halves of the level rule so the
escalation bias cannot come back silently.

**Review's own contribution** (`final` minus `plannerOnly`) is the view that removes planner variance,
and it shows the change is a trade rather than a free win:

| monolith run      | E&M     | primary dx | dx     | ROS | CPT |
| ----------------- | ------- | ---------- | ------ | --- | --- |
| old prompt        | +4      | +1         | **+5** | +3  | +7  |
| over-corrected    | +23     | +1         | +1     | +4  | +4  |
| check 4 corrected | **+19** | -1         | **-2** | +3  | +6  |
| dabrams, fresh    | +9      | 0          | +1     | +2  | +1  |

Review now contributes +19 E&M corrections against their +9, and its diagnosis contribution went from
+5 to -2 — i.e. it removes slightly more matching diagnoses than it adds. Single runs on a 69-item gold,
so that -2 needs a repeat pair before it is called a regression; the worked code swaps added to checks 2
and 9 are the obvious suspect if it holds.

`report.ts` now prints a `discriminating` column beside the headline, over the cases whose gold is not
a level-4 code. **Read that column first.** Five cases is a thin sample, so treat it as a guard against
collapse rather than a precise measure — but a run that gains on the headline while losing the
discriminating cases has not improved.

What would actually fix the measurement: a corpus with a spread of E&M levels. The current one cannot
distinguish these hypotheses, and no amount of prompt work on our side changes that.

### E&M, taken apart

Gold `emCode` is `chart.emCode` straight off the signed chart — the code the provider actually billed.
Its distribution over the 40 cases is lopsided: **99204 x30**, 99214 x5, 99203 x3, 99205 x1, 99202 x1.

The headline number is two unrelated failures added together, and they have to be read separately:

|                         | cases | exact | wrong FAMILY | right family, wrong level |
| ----------------------- | ----- | ----- | ------------ | ------------------------- |
| patient status supplied | 23    | 11    | 1            | 11                        |
| patient status absent   | 17    | 1     | 15           | 1                         |

**The 17 status-less cases are a corpus artifact, not a product failure.** `meta.patientStatus` is
missing for them because the dabrams `backfill-patient-status.ts` ran partially ("Continuing with a
PARTIAL backfill"), and 16 of those 17 gold codes are in the NEW family while the prompt is told to
default to ESTABLISHED when the status is unknown. In production
`packages/zambdas/src/ehr/easy-chart-shared/visit-context.ts` derives the status server-side by counting
the patient's appointments in the past three years, so the fallback almost never fires. The runner now
infers their family from the gold code rather than leaving them unknown (see above), and records both
`patientStatusSent` and `patientStatusSource` in each score file so `report.ts` can split them.

Worth knowing if this corpus is ever re-harvested: production has a **better** signal than the
appointment count `visit-context.ts` uses, and the shipped billing-suggestion feature already uses it.
`useBillingSuggestions.ts` reads the `seen-in-last-three-years` screening answer first and only then
falls back to `getReturningPatient` (the returning-patient tag on the Appointment, or
`chartData.patientHasPreviousVisits`). `visit-context.ts` consults none of that; it also anchors its
three-year window on _now_ rather than the encounter start and counts appointments of any status, so a
cancellation reads as a prior professional service. Their harvester's `derivePatientStatus` searches
`status=finished` Encounters and windows client-side, noting that `date=ge...` "returns 0 entries even
when matching finished encounters exist" on production Oystehr — which, if it also holds for the
Appointment search, would make our count silently zero. Untested here, and out of scope for a harness
change, but it is the reason the harness cannot simply "do what prod does".

**On the 23 measurable cases the failure is entirely one-directional: every miss is UNDER-coding.**
Level deltas (predicted minus gold) came out `-2 x1, -1 x11, 0 x11` — not a single over-code. The cause
is one sentence in `set-em-code`'s `promptDoc`: _"When torn between two levels choose the LOWER"_.
Turning on thinking makes it worse (11/23 -> 7/23): more reasoning is more opportunity to talk itself
down a level.

Replacing that tiebreak was measured, and it is a genuine trade rather than a free win:

|                                                | F1            | gold matched | diagnoses | primary dx | E&M /23 |
| ---------------------------------------------- | ------------- | ------------ | --------- | ---------- | ------- |
| "choose the LOWER" (K, K2)                     | 0.427 / 0.424 | 104 / 102    | 19 / 19   | 11/37      | 7 / 8   |
| "code what the documentation supports" (M, M2) | 0.417 / 0.407 | 101 / 98     | 15 / 15   | 8/38       | 13 / 13 |

Both halves reproduced across the paired repeats, and raising the thinking budget to 4096 does not buy
the diagnoses back (the model spent FEWER thinking tokens at 4096 than at 2048 — the budget was never
the binding constraint). So +5 correct E&M levels costs 3 correct primary diagnoses. The tiebreak is
left as it stands, because which side is worth more is a billing decision; the alternative wording is
recorded in the `promptDoc` comment next to it.

### The noise floor changed when thinking came on

With `thinkingBudget: 0`-equivalent behaviour two identical runs were byte-identical — the old measured
floor of "36/40 score files identical" was in fact 40/40 on aggregates. **With thinking on, nothing is
byte-identical: 0 of 40 score files matched between two runs of the same config.** The observed spread
is F1 +/-0.010, gold matched +/-3, ROS +/-2. Section counts that matter here held exactly across repeats
(diagnoses, primary dx, E&M), so those are readable; a total-F1 move under 0.010 is not. Run the pair
before believing any change of that size.

### Result: dabrams prompt, 2026-09-02, `gemini-3.1-flash-lite`, 40 cases

`run-40-G-theirprompt` (their static prompt, our everything-else) against `run-40-A-mono` (ours), and
against `dabrams`' own `run40`, which is on disk at
`hosted-ottehr-builds/local/core/scripts/easy-chart-eval/harvested-results/run40`.

**Two things must be held fixed before any of these numbers mean anything**, and both were verified:

- **The corpus is the same.** All 191 cases match case-for-case on `encounterHash` between the two
  `harvested-cases/manifest.json` files. `case017` is the same visit on both sides.
- **The scorer is the same.** `diff` against their `scripts/easy-chart-eval/score-harvested.ts` is 82
  lines, every one of them import plumbing or the `calls` accumulator. No matching rule, gold parse,
  voiced-tagging denominator or scope filter differs. Ours is a faithful port and must stay one.

**And two things are NOT comparable, by construction:**

- **`exam` is not comparable.** Their runner charts a template's diagnoses but deliberately not its
  exam contents ("its exam/MDM/instruction contents still are not"); ours charts both. A template
  contributes ~28 default normals, so in `run-40-A-mono` the 500 scored exam predictions are 35 the
  model chose plus 465 the templates ticked. Read exam only against another run of the SAME harness,
  and read the total with exam excluded.
- **`final` is not comparable to a planner-only run.** `final` = planner + review. Their run40 has a
  40-call review pass; a `--no-review` run does not.

Totals with `exam` excluded, which is the comparison that holds:

|                        | planner F1 | final F1  | planner matched |
| ---------------------- | ---------- | --------- | --------------- |
| dabrams `run40`        | **0.399**  | **0.404** | 89 / 292        |
| ours, our prompt (A)   | 0.332      | 0.354     | 72 / 292        |
| ours, their prompt (G) | 0.342      | 0.364     | 74 / 292        |

Their static prompt is worth **+0.010 F1** on our pipeline — real, and it is where their diagnosis and
E&M advantage at planner stage comes from: diagnoses matched 9 → 12 against their 13, E&M exact 4 → 10
against their 9. It costs 31% more input (607,485 vs 464,605) for that. It does **not** close the
remaining ~0.06, and it makes ROS and exam slightly worse.

What the remaining gap is NOT: not the corpus, not the scorer, not the static prompt, and not the model
(their branch's only model reference is `gemini-3.1-flash-lite`, the one G ran on). What it looks like
is emission volume — their planner emits 508 actions to our 430, more of nearly every kind:

|                     | theirs | ours (A) |
| ------------------- | ------ | -------- |
| add-ros-finding     | 104    | 76       |
| add-exam-finding    | 45     | 35       |
| add-medication      | 21     | 13       |
| provider-note       | 9      | 3        |
| remove-exam-finding | 7      | **0**    |

Same prompt and same model producing 18% less output points at the layer this audit has NOT yet
compared: the VARIABLE tail (their `patient-context.ts` against our `buildVariableTail`) and the
acceptance layer (their `validation.ts` against our guards). That is where to look next. Note also that
we emit no `remove-exam-finding` at all, against their 7.
