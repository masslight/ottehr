# Autochart acceptance tests — how the cases were made and how they score

Two suites in this directory measure the AI boundary of Autochart on real recordings:

- [`test-autochart-plan.ts`](test-autochart-plan.ts) — transcript → `easy-chart-plan` → the planned actions the
  recommendations panel turns into rows.
- [`test-autochart-narrative.ts`](test-autochart-narrative.ts) — transcript → `easy-chart-narrative` → the
  read-back lines the provider corrects before the plan runs.

Everything after the provider clicks Chart (the executor, the chart writes) is deterministic and covered by unit
tests, not here. Templates are deliberately not measured: an `apply-template` action is neither expected nor
counted.

This document is the methodology: where the cases come from and how they are chosen, how every hand-written
section of a case was composed, exactly where each field is consumed, and how it becomes the numbers on the
report. The field reference is [`autochart-cases/README.md`](autochart-cases/README.md); the design context
is [`docs/easy-chart-technical-design.md`](../../docs/easy-chart-technical-design.md) §13.

## 1. Where the cases come from

The eval corpus in `tools/easy-chart-eval/harvested-cases` (PHI, gitignored, present only on machines that ran
the harvester) holds production visits: the transcript of the ambient recording, the chart the clinician signed
(the **gold**), and, on every gold item, a `voiced` flag the harvester set by judging the item against the
transcript. The corpus's own screening (`tools/easy-chart-eval/case-quality.ts`, stamped into each file as
`quality`) sorts it into tiers; only the OK tier (396 cases as of 2026-09-12) is evidence.

### 1.1 Which ten, and how they were chosen

The ten in `autochart-cases/` are the top ten of [`autochart-select-cases.ts`](autochart-select-cases.ts)
(section 12) among the cases that can run unattended (an age and a sex in the chart's HPI), as of 2026-09-25.
The selector ranks every OK case by how well the chart and the recording agree — the voiced share of the chart
and of its orders, how many chart items were never said, how many drugs and topics were said and never charted
— and by how whole the recording is: length, turns, two speakers in balance, labels on the right speaker, not
cut. It ranks the evidence, not the model: its score does not predict how the plan does (Spearman 0.05 over
the whole tier).

| Case                              | Corpus  | Patient   | The visit                                                                                                                                                     |
| --------------------------------- | ------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acute-sinusitis`                 | case668 | 36 M, new | Four days of congestion, productive cough and sinus pressure; ipratropium and fluticasone sprays and Augmentin, all named aloud. The corpus's best agreement. |
| `left-sided-pharyngitis`          | case412 | 39 F, new | Sore throat on the left since yesterday; a negative strep test and a steroid injection in clinic; viscous lidocaine.                                          |
| `allergic-rhinitis-fatigue`       | case380 | 38 F, new | Four days of runny nose, sneezing, headache and fatigue; cetirizine, azelastine and fluticasone.                                                              |
| `calf-strain-pickleball`          | case605 | 43 M, new | Right calf cramping and swelling after pickleball; an ultrasound ordered to rule out a clot; ibuprofen.                                                       |
| `vaginitis-cramping`              | case398 | 29 F, new | Vaginal discharge, odor and lower abdominal cramping; swabs taken; metronidazole.                                                                             |
| `post-vaccine-myalgia-laryngitis` | case538 | 49 F, new | Chills, body aches, congestion and a lost voice the day after allergy immunotherapy; five diagnoses, no prescription.                                         |
| `cerumen-impaction-tinnitus`      | case339 | 20 F, new | Bilateral earwax impaction with tinnitus and imbalance; meclizine said and not charted.                                                                       |
| `lip-lesion-sti-screening`        | case400 | 22 F, new | An ulcerative lip lesion and a screening for sexually transmitted infections; results pending.                                                                |
| `knee-laceration-effusion`        | case337 | 72 M, new | A knee laceration from broken glass with an effusion; an X-ray; no prescription.                                                                              |
| `otitis-media-perforation`        | case601 | 12 M, new | Left ear pain, drainage and hearing loss after an urgent-care visit: a perforated eardrum and otitis externa; antibiotic drops, Augmentin, an ENT referral.   |

All ten are new patients; that is what the OK tier's top looks like (45 of its 369 runnable cases are
established). Their hand-written sections are empty: they were chosen because the chart says what the recording
says, so there is little to add. Each is one file, `autochart-cases/<id>.json`, made with
`autochart-import-case.ts` — the corpus case cut to `transcript`, `gold` and `patientStatus`, the patient read
from the HPI — with names, places, dates and organizations in the transcript and the chart's free-text notes
replaced by placeholders (`<patient name>`, `<clinician name>`, `<city>`, `<pharmacy>`, `<date>`…).

The previous ten, in `autochart-cases/retired/` (not loaded), were picked by hand from the OK tier: sorted by
the _number_ of voiced items, a long dialogue, a known status, then chosen for variety and for each having
something the recording does that the chart does not. That was a judgment, not a procedure, and it optimised
the wrong thing — by the share of the chart that was said, those ten rank 36th to 184th of 396. They carry the
hand-written sections (`said`, `goldErrors`, `allowed`, `narrativeFacts`, `edits`) that the worked examples of
section 5 are drawn from.

## 2. What the suites do with a case

### 2.1 The encounter

`createCaseEncounter` (autochart-shared.ts) makes a real, throwaway appointment so the plan reads the same
encounter context the product does: a patient "Autochart <label>" with the case's sex and a date of birth
computed as today minus the case's age minus 40 days, and the case label as the reason for visit. An
`established` case gets a second appointment for the same patient, because the plan zambda derives the
new/established status from the visit count — which is where the 9920x/9921x E&M prefix comes from. Everything
is deleted afterwards.

### 2.2 The plan suite: three paths per case

1. **Transcript path** — `easy-chart-plan` with `{ narrative: <transcript>, encounterId, incremental: false }`,
   repeated `--repeat N` times. Its checks are the dashboard number.
2. **Narrative path** — `easy-chart-narrative` with `{ transcript, encounterId }`; the returned lines joined into
   a draft; `easy-chart-plan` with `{ narrative: <draft>, encounterId }`; the same checks. Reported beside the
   transcript path (and in JSON as `fromNarrative`), never in the headline: it shows what the plan loses when
   its input is the read-back instead of the recording.
3. **Provider edits** — for each entry of `edits`: if `find` matches the draft, the draft is edited (`find`
   replaced by `replace`) and `easy-chart-plan` is called with
   `{ narrative: <transcript>, encounterId, providerEdits: { draft, edited } }`. The edit's `expected` items
   become checks tagged `said`, its `forbidden` items (the drug that was replaced) checks tagged `forbidden`.
   When the draft does not contain the phrase the edit is reported as skipped, not failed. Reported as
   "Provider edits" and in JSON as `edits`; not in the headline.

`--skip-narrative-paths` runs the transcript path only. `--corpus all|top:N|case1,case2` takes the cases from
the corpus instead of `autochart-cases/` (section 12).

### 2.3 The narrative suite

`easy-chart-narrative` with `{ transcript }`. Each returned line carries `sources`, the verbatim transcript
snippets the server could back it with. Three kinds of checks:

- `mentions /…/` — one per narrative fact (section 5.6): a fact derived from the voiced chart is tagged
  `voiced`, one from the case file `said`; passes when any line matches.
- `at most 10% of lines unbacked by the transcript` — lines with no `sources`, at most `max(1, ⌊0.1 × lines⌋)`.
  Tagged `invariant`.
- `no line contradicts the transcript (judge)` — a Gemini judge (`--judge-model`, default the product's own
  `gemini-3.1-flash-lite`) reads the transcript with the speaker labels stripped and the numbered lines, and
  lists the lines that contradict or distort it: a different drug, dose, side, timing, polarity, or a fact the
  transcript never states. Passes when the list is empty. Tagged `invariant`. The omissions the judge notices
  are printed, not scored — coverage is the facts' job. `--skip-judge` turns it off.

## 3. Where each field of a case file is used

| Field            | Consumer                                     | What it produces                                                                                            | Tag / headline                                           |
| ---------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `id`, `label`    | `--cases`, every report line                 | —                                                                                                           | —                                                        |
| `sourceCase`     | `loadAutochartCase`                          | Provenance; the loader refuses a file whose `sourceCase` differs from what the file says it was copied from | —                                                        |
| `patient`        | `createCaseEncounter`                        | The patient's date of birth and sex on the encounter the plan reads                                         | —                                                        |
| `patientStatus`  | `createCaseEncounter`                        | One or two visits → the status the plan derives → the E&M prefix                                            | —                                                        |
| `notes`          | `--dump-expectations`                        | Printed, nothing else                                                                                       | —                                                        |
| `gold`           | `deriveExpectations`, `deriveNarrativeFacts` | Expected items tagged voiced/unvoiced, context items, allowed home medications, the chart's narrative facts | voiced in headline; unvoiced and context reported only   |
| `said`           | `loadAutochartCase` → `checkPlan`            | One `expects …` check per item, from "recording"                                                            | `said`, in headline                                      |
| `goldErrors`     | `loadAutochartCase`                          | Removes every derived item whose dump line matches; listed as "dropped from gold"                           | Changes the denominators, adds no check                  |
| `allowed`        | `unexpectedActions`                          | A coded action matching an allowed item is not an `extra`                                                   | Removes a failed `extra` check                           |
| `narrativeFacts` | `checkNarrative`                             | One `mentions …` check per regex, beside the chart-derived facts                                            | `said`, in the narrative suite's number                  |
| `edits`          | plan suite path 3                            | `after edit, expects …` / `after edit, must not chart …` checks                                             | `said` / `forbidden`; "Provider edits", not the headline |
| `transcript`     | every call, `deriveNarrativeFacts`           | The input; also decides which chart items make a narrative fact                                             | —                                                        |

There is no hand-written list of things the plan must not chart. Precision is measured automatically: every
coded action the chart does not have is a failed check (section 5.5).

## 4. What is derived from the gold, automatically

`deriveExpectations` in [`autochart-corpus.ts`](autochart-corpus.ts) turns the signed chart into expectations
so that nobody has to transcribe a chart by hand, and so the chart's own `voiced` flags decide the tag:

| Gold section                               | Expectation                                                                                                         | Tag                                                                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assessment.diagnoses[]`                   | `diagnosis` with the normalized code as prefix, `primary` when the chart says so; items `fromLabOrder` skipped      | the item's `voiced` flag                                                                                                                                  |
| `reviewOfSystems.observations[]` (present) | `ros` with the field minus its `-reports`/`-denies` suffix as `baseKey`, the suffix as `finding`                    | the item's `voiced` flag                                                                                                                                  |
| `exam[]` (present)                         | `exam` with the field                                                                                               | the item's `voiced` flag                                                                                                                                  |
| `billing.emCode`                           | `em` accepting both prefixes at the chart's level (`99204/99214`)                                                   | always `voiced`: the level is inferred, and a scribe infers it too; the prefix is the visit count's, and two charts bill the wrong one                    |
| `medications.prescribed[]`                 | `medication` with a regex built from the product's first word plus its brand names (`medicationRegex`)              | `voiced` only when the item is voiced **and** its name was said (`nameVoiced !== false`): "a muscle relaxer" is a fact of the visit, methocarbamol is not |
| `disposition.type`                         | `disposition` with the plannable type (`pcp-*` → `pcp`; unknown types skipped)                                      | the chart's `dispositionVoiced` flag                                                                                                                      |
| `disposition.followUpIn` > 0               | `disposition` with `followUpInDays`                                                                                 | always `unvoiced`                                                                                                                                         |
| `allergies[]`                              | `allergy` with a word from the display                                                                              | `context`                                                                                                                                                 |
| `medicalHistory[]`                         | `condition` with the code prefix and a word from the display                                                        | `context`                                                                                                                                                 |
| `surgicalHistory[]`, `hospitalizations[]`  | `surgicalHistory` / `hospitalization` with a word from the display                                                  | `context`                                                                                                                                                 |
| `vitals[]`                                 | `vital` for temperature (°C), weight (kg), height (cm), heart rate, respiration, oxygen saturation; `bloodPressure` | `context`                                                                                                                                                 |
| `medications.currentReconciled[]`          | **allowed** `medication` (home medications)                                                                         | never scored                                                                                                                                              |

`deriveNarrativeFacts` turns the same gold into what a read-back must mention (section 5.6).

The harvester's `voiced` flags are what they are: "no numbness, tingling or weakness" is said in
`upper-back-strain` and flagged unvoiced, "lungs clear" in `infant-croup-covid` likewise. Such items show up in the
report as `+ … charted although unvoiced` — a line worth a listen rather than a correction.

## 5. How the hand-written sections were composed

The worked examples in this section come from the previous, hand-picked ten (`autochart-cases/retired/`); the
current ten have these sections empty. The process, per case:

1. Read the transcript end to end, as the recording, keeping in mind that the Provider/Patient labels can be
   swapped or missing.
2. Run `npx tsx scripts/tests/test-autochart-plan.ts --env local --dump-expectations --cases <id>` and hold the
   derived list against the transcript. Every disagreement between the two goes into exactly one section:
   - the chart has it, the recording contradicts it → `goldErrors`;
   - the recording has it, the chart does not, and a scribe should have charted it → `said`;
   - the plan could reasonably chart it and the chart simply did not → `allowed`.
3. Write `narrativeFacts` from the transcript alone: what a read-back must carry beyond the chart's own items.
4. Test every regex against the transcript text (a grep): the wording it stands for must be there.
5. Run the suites, read every miss, and separate a model miss from an expectation mistake. Only the latter is
   fixed in the case file — the E&M-by-level rule and the three gold errors came out of this step.

Every pattern is a regular-expression source matched case-insensitively (`"tylenol|acetaminophen"`,
`"\\bice\\b"`), because the planner writes what was said in its own words: brand or generic, "x-ray" or
"xray", "ears" or "ear".

A corpus case run with `--corpus` has none of these sections: its score is the gold's recall, the automatic
precision and the invariants. The sections are what a committed case adds after a person has listened.

### 5.1 `patient` and `patientStatus`

The corpus keeps neither age nor sex; both come from the transcript and the gold's HPI ("The patient is a
72-year-old female…"). `patientStatus` is the corpus's. They matter because the plan reads the encounter: the
infant case is planned for a 10-month-old, the established cases get the established E&M prefix. In `--corpus`
mode `parsePatient` reads the same sentence with a regex, and a case whose HPI does not say is left out.

### 5.2 `said` — said on the recording, absent from the chart

**Purpose.** The voiced gold measures what a scribe could chart _of what the clinician charted_. `said` adds what
the clinician said and never charted: the plan is a scribe, and a scribe charts what was said.

**How it was composed.** Reading each transcript for statements that map onto a plan action kind and are absent
from the gold:

- a drug named and never sent — `contact-dermatitis`: "I'm going to give you a Singulair for nighttime", the
  chart has famotidine and the steroid only (`medication /montelukast|singulair/`);
- history told in full and absent from the chart — `recurrent-uti-constipation`: the colonoscopy, the
  polyps, "one was cancerous and they did a resection on me" (`surgicalHistory /colon|resection|colectomy|bowel/`,
  `condition /cancer|malignan|neoplasm|polyp/` with `Z85`); `chest-pain-asthma`: "I used to [vape]… quit about
  a month ago" (`condition /smok|vap|nicotine|tobacco/` with `Z87891`); `infant-croup-covid`: conjunctivitis two
  months ago; `viral-gastroenteritis`: the gallbladder removed a year ago;
- a referral said and not charted — `viral-gastroenteritis`: "follow up with a gastroenterologist"
  (`disposition specialty`);
- an exam normal voiced and not taken — `bilateral-otitis-media`: "throat doesn't look bad"
  (`exam oropharynx-clear-with-no-erythema-lesions-or-exudate`);
- the advice given — one `instruction` per distinct piece of advice: deep breathing, "swallow them whole, don't
  chew", the muscle relaxer "only for bedtime", the humidifier, the warm towel for the eyes, rotating Tylenol and
  Motrin, "cut the dairy out", "stay nice and hydrated", the diaper-rash cream, "rest, try not to lift anything
  super heavy", "if you have to operate heavy machinery, maybe not";
- a diagnosis that replaces a gold error — `upper-back-strain`: any upper-back or back-muscle code as the primary
  (`diagnosis` with several prefixes, `primary: true`), because the chart's low-back code is not what was said;
- a choice of shapes when the recording allows both — `viral-pharyngitis-vertigo`: "decongestants … would be
  helpful" is satisfied by an instruction mentioning a decongestant or by the pseudoephedrine the chart has
  (`anyOf`).

**Rules.** An item goes in only when the recording is unambiguous about it and the plan has an action kind for
it. The regex accepts the wording variants the planner might use. A `note` quotes the recording when the item
needs explaining. What was said in generic words only ("a muscle relaxer", "a topical") stays out of `said`: the
chart's specific product is already in the expectations as unvoiced, and nobody can chart methocarbamol from
"a muscle relaxer".

**Effect.** Each item is one `expects …` check on every plan path, tagged `said`, in the headline. A miss prints
what the plan charted of the same kind instead, so "instruction /inhaler/ — charted instead: add-patient-instruction
"Take Augmentin for 3 more days…" | …" reads as a real omission, and "condition /smok|vap/ — refused: Former
smoker: no ICD-10 code could be confirmed" reads as a resolver gap.

The selector's `said-not-charted` column (drug names the recording says that no chart medication accounts for,
topics the recording states whose chart section is empty) is the automatic, cruder version of this listening;
a case with that column empty needs little or nothing here.

### 5.3 `goldErrors` — gold items the recording contradicts

**Purpose.** The gold is a signed chart, not the truth; when it contradicts the recording, expecting it would
punish a correct plan.

**How they were found.** Only from the dump-versus-transcript comparison, and only where the recording is plain:

- `viral-gastroenteritis`: the chart's disposition is a PCP follow-up; the provider says "follow up with a
  gastroenterologist". Dropped: `disposition pcp`. Added to `said`: `disposition specialty`.
- `chest-pain-asthma`: the chart's ROS has "denies chest pain" on a visit for chest pain. Dropped:
  `ros denies cardiovascular-chest-pain`.
- `upper-back-strain`: the chart's primary is M54.50 low back pain; the patient says "right under my shoulder
  blade … close to the spine", and "low back" is never said. Dropped: `dx M5450 (primary)`. Added to `said`: the
  upper-back/back-muscle diagnosis above.

**Mechanics.** `match` is tested against the derived item exactly as `--dump-expectations` prints it
(`dx M5450 (primary) «Low back pain, unspecified»`), against expected and context items alike; a match removes the
item and lists it under "dropped from gold" with the `reason`. No check is added — a gold error changes the
denominators, nothing else.

### 5.4 `allowed` — fine to chart although the chart lacks it

**Purpose.** Precision is automatic (section 5.5): a coded action the chart does not have is a failed check.
`allowed` names what the plan may reasonably chart and the chart simply lacks, so those actions do not count
against it.

**How it was composed.** From the differential the provider voiced and from the neighbourhood of the chart's
codes: symptom codes beside the diagnosis (`R05`, `R09`, `R50`, `R11`), a neighbouring or alternative code
(`J20` bronchitis on the pneumonia follow-up, `H65`/`H69`/`H92` beside otitis media, `H81`/`H93` beside
vertigo, `L2x`/`L29`/`L30` for the dermatitis, `E73` lactose intolerance the provider suspected, `K91`/`K59`),
external-cause and encounter codes (`W54`, `Z23`), and the over-the-counter drugs mentioned (Tylenol, Motrin,
Zyrtec, DayQuil, calamine). The chart's home medications are added automatically.

**Effect.** An action matching an allowed item is not an `extra`, so it removes a failed check from the
headline. Nothing else: an allowed item is never expected. Being generous here trades a precision miss for a
blind spot, so an allowed item should be one the recording supports.

### 5.5 Precision, automatically: `extra` — charted, and not in the chart

An earlier version of these suites had a hand-written `forbidden` list per case (a walked-back impression, a
negative test, an earlier visit's drug), each item one "must not chart" check. It was replaced because it
needed a person to think of every wrong thing in advance, and because the chart already says what should not
be there: anything the chart does not have.

**What counts.** After each plan, every action of a coded kind — `add-diagnosis`, `add-medication`,
`add-allergy`, `add-condition`, `add-surgical-history`, `add-hospitalization`, `set-vital` — that matches no
expected item (voiced or unvoiced), no context item and no allowed item is one failed check,
`not in the chart: <action>`, tagged `extra`, in the headline. The in-clinic doses and immunizations that used
to be forbidden by rule are covered by it: a dexamethasone dose given in the clinic is not a chart medication,
so an `add-medication` for it matches nothing and counts. A drug the chart has but never said (unvoiced) does
not count when the plan charts it — the chart has it — and shows as `+ … charted although unvoiced`.

**What does not count.** ROS and exam findings the chart does not have are listed on a separate line and never
scored: a scribe may chart a negative the clinician skipped, and the clinicians do skip many. Nor does a
medication named by its class only — "oral steroid", "muscle relaxer", "nasal spray", "decongestant": that is
what the recording said when the provider did not name the product, it matches no chart prescription (the
chart has prednisone, methocarbamol, ipratropium) and it is not a false positive either. Both are printed as
`not scored (…)`.

**A property to know.** A near-miss code counts twice: J02.8 where the chart has J02.9 fails the expected
check (recall) and is an extra (precision). That is what "the chart is the truth" means; where the recording
supports the neighbour, `allowed` is the way to say so.

### 5.6 The narrative facts — what a read-back must carry

**Purpose.** The narrative is the provider's read-back of the recording. It is judged as a read-back: does it
carry the facts of the visit, and does it distort any.

**From the chart, automatically** (`deriveNarrativeFacts`): every voiced diagnosis, ROS finding, named
prescription and disposition whose own wording the recording carries becomes a fact, tagged `voiced` — the word
of the chart's label that the transcript itself contains ("Postnasal drip" → `/post-?nasal/`, "Cough" →
`/cough/`, "Famotidine" → `/famotidine|pepcid/`, a PCP disposition → `/primary care|pcp|follow-up/`). A chart item
whose wording the recording does not carry ("Acute suppurative otitis media" for "ear infection") makes no
fact, so a miss is the narrative's and not the chart's coding vocabulary. Exam items make no facts: their
wording is too variable to test with a word.

**From the case file** (`narrativeFacts`, tagged `said`): one regex per fact beyond the chart's items, 12–20
per committed case — the timeline ("two weeks", "since Wednesday"), the pertinent negatives, the history and
context the patient volunteered (the flight, the deodorant, the gallbladder, "I never [smoked]"), what the
provider said about the exam ("lungs sound good"), tests and results, each plan item and instruction. A regex
names the fact, not the phrasing (`/tessalon|benzonatate|cough medication/`, `/x-?ray|image|picture/`), and each
was checked to match the transcript.

**Effect.** Each fact is one `mentions …` check in the narrative suite, passing when any line matches. They are
the narrative suite's number together with the two invariants. On the baseline the misses were almost all
dropped context and negatives — the state, the smoking denial, the urologist, the prostate, the cancer — which
is exactly what the file's list was written to catch.

### 5.7 `edits` — a provider's correction the plan must follow

**Purpose.** In the product the provider corrects the read-back and the plan runs with `providerEdits`: the
draft and the edited text. The suite scripts one such correction per case where the recording names a drug.

**How they were composed.** `find` is the drug as the generated narrative names it (`/augmentin/`,
`/(viscous )?lidocaine/`, `/singulair|montelukast/`, `/miralax|polyethylene glycol/`); `replace` a plausible
alternative; `expected` the new drug as a medication; `forbidden` the old one — the one place a forbidden item
remains, because the point of the test is that a correction replaces and does not add. Four cases have one.

**Effect.** After the transcript path, the generated draft is edited and the plan is called with
`providerEdits`; the checks are `after edit, expects medication /doxycycline/` (tag `said`) and `after edit,
must not chart medication /augmentin|…/` (tag `forbidden`). Reported as "Provider edits: x/y (n skipped)" and in
JSON `edits`; not in the headline. A skipped edit means the narrative did not name the drug, which is itself a
narrative finding.

### 5.8 `notes`

Free text for the reader: what the recording rules out, a quirk of the transcript (the swapped labels). Printed
by `--dump-expectations`, nothing else.

## 6. How an action satisfies an expectation

`actionMatches` in [`autochart-shared.ts`](autochart-shared.ts) uses the product's own resolution wherever the
product resolves:

| Expectation                          | Matches an action when                                                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagnosis`                          | `add-diagnosis` whose code, dots removed, starts with one of the prefixes; `primary` compared when set                                                                                              |
| `ros`                                | `add-ros-finding` whose polarity (`rosPolarity` of display and finding) is the expected one and whose display + `searchTerms` resolve, through the panel's `findRosMatches` catalogue, to `baseKey` |
| `exam`                               | `add-exam-finding` whose display + `searchTerms` resolve, through the executor's `findExamLeafMatches` over the default exam config, to `field`; or whose display matches `display`                 |
| `vital`                              | `set-vital` of the field whose reading, parsed as the product parses it and converted to the expected unit, is within tolerance (0.3 °C/kg, 1.5 cm, else 0.5)                                       |
| `bloodPressure`                      | `set-vital` blood pressure with exactly the systolic and diastolic                                                                                                                                  |
| `medication`                         | `add-medication` whose display matches `name` (and `strength`, when set)                                                                                                                            |
| `allergy`                            | `add-allergy` whose display matches                                                                                                                                                                 |
| `condition`                          | `add-condition` whose code starts with `codePrefix`, or whose display matches `name`                                                                                                                |
| `surgicalHistory`, `hospitalization` | the matching action kind whose display matches                                                                                                                                                      |
| `em`                                 | `set-em-code` whose code is one of `codes`                                                                                                                                                          |
| `disposition`                        | `set-disposition` with the type and/or the follow-up days, whichever are set                                                                                                                        |
| `instruction`                        | `add-patient-instruction` whose text matches                                                                                                                                                        |
| `note`                               | `edit-note-text` of the field whose new text matches                                                                                                                                                |
| `anyOf`                              | any alternative matches                                                                                                                                                                             |

Resolving ROS and exam the way the product does is what makes the report say where a finding _lands_
(`Back muscle tenderness [back; tenderness; muscle] → skin-location`) — a miss caused by the matcher, not the
model.

## 7. From checks to numbers

A **check** is one line: a label, passed or not, a tag, the expectation's kind, and a detail for the failure
line. `checkPlan` builds, per plan response: one check per expected item (`expects …`) and per context item
(`context …`), one per coded action the chart does not have (`not in the chart: …`), two invariants —
`exactly one E&M code` and `exactly one primary diagnosis` — and one per action that could carry a quote
(`grounded in the recording: …`), passing when the server verified a verbatim phrase for it (`sourceText`).
The grounded checks are the only measure that does not depend on the signed chart: the chart may have what
was not said and lack what was, so they are printed first, and the report page (section 8) leads with them
and with a judge's per-action reading of the transcript.

**Tags** decide what is scored (`SCORED_TAGS` in autochart-shared.ts):

| Tag         | Source                                                                                                                                                                           | In the headline      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `grounded`  | every action that could carry a verbatim quote: passes when the server verified one (`sourceText`), fails when the item is inferred — the measure that owes nothing to the chart | yes, printed first   |
| `voiced`    | gold items flagged voiced; the E&M level; chart-derived narrative facts                                                                                                          | yes                  |
| `said`      | `said`, `edits.expected`, the file's narrative facts                                                                                                                             | yes                  |
| `extra`     | coded actions the chart does not have                                                                                                                                            | yes                  |
| `forbidden` | `edits.forbidden` — the drug a provider edit replaced                                                                                                                            | yes (edits path)     |
| `invariant` | the two plan invariants; the narrative suite's unbacked share and judge                                                                                                          | yes                  |
| `unvoiced`  | gold items flagged unvoiced                                                                                                                                                      | no — reported beside |
| `context`   | vitals, allergies, history from the gold                                                                                                                                         | no — reported beside |

Unvoiced and context are evaluated and printed, never scored: a scribe cannot chart what the recording does not
carry, and the unvoiced gold is mostly the exam and ROS normals a template fills in (10–130 items per case),
which these suites do not measure. Flip `SCORED_TAGS` to change that; the JSON's `byTag` has every tag either
way.

**Per case**, the transcript path prints one line —
`26/72 (voiced 12/54, said 6/8, extra 0/2, invariant 4/4; unvoiced 0/132, context 0/24 not scored) over 2 run(s)` —
then the checks worth a line: `✗` a scored check that failed in every run, `~` in some runs (with `passes/runs`),
`+` an unvoiced or context item the plan charted anyway (an inference or a hallucination: listen), `·` the
unvoiced and context items it did not, counted by kind, with the unvoiced orders (a diagnosis, a drug, a
disposition) named. Then `ros/exam not in the chart (not scored)`, and with `--verbose` every action and
refusal of every run.

**Repeats.** The model is not deterministic (the same prompt has produced between 28 and 38 actions). With
`--repeat N` the transcript path runs N times; checks are folded by label into `passes/runs` (an extra that
appears in one run of two reads `0/1`); a scored check with `0 < passes < runs` is **flaky** and counted in the
summary. The dashboard's `total` is the sum over runs and `passed` likewise, so the line is the mean pass rate.

**The summary and the JSON.** `Transcript path` is the headline (`passed`/`total` in the JSON, plus `byTag`,
`repeats`, `flaky`); `Narrative path` and `Provider edits` are beside it (`fromNarrative`, `edits`). Per case the
JSON keeps the failed folded checks with their details, every run's actions, refusals and ROS/exam extras, the
models that answered and whether the call escalated to the backup model. The narrative suite's JSON keeps, per
case, the line count, the failed checks and the judge's omissions. Both suites print each case as it completes,
exit non-zero when a scored check failed or a case errored, like the nightly suites beside them, and write the
same `{ suite, timestamp, passed, total }` the AI accuracy dashboard reads.

## 8. Reading a failure

For a per-case page rather than a log — the transcript, every action with a judge's reading of whether it was
said (supported / unsupported / contradicted, with a reason), the verbatim phrase the server verified for it
(`sourceText`) in context or "inferred", what it is relative to the signed chart, the chart's said items and
whether the plan charted them, the refusals, the narrative read-back — add `--report out.html` to the plan
suite: it writes the page for the cases it ran (one with `--cases id`, all, or `--corpus …`), from the first
transcript run of each, with the raw run beside it as `out.html.json`. [`autochart-report.ts`](autochart-report.ts)
makes the same page without the suite's checks and repeats, and `--from out.html.json` re-renders either
page without calling the AI; `--skip-judge` skips the judge. The renderer is `autochart-report-html.ts`.

The detail after `— got:` is built by `sameKindDetail`:

- `charted instead: …` — every action of the same kind, each with its code or display, its `[searchTerms]` and,
  for ROS and exam, `→ the key it resolves to` (or `unresolved`);
- `nothing of this kind charted`;
- `refused: <display>: <reason>` — what the guards rejected of that kind;
- for a medication, `mentioned as text: add-patient-instruction "Take Augmentin for 3 more days…"` — the drug
  landed in an instruction instead of an `add-medication`.

So a missed `dx J189 (primary)` with `charted instead: J20.9 Acute bronchitis` is a coding choice (and the J20.9
is an `extra` unless allowed); a missed `exam crackles` with `Lungs with slight wetness [lungs; wet] →
unresolved` is a catalogue gap; a missed `medication /benzonatate|tessalon/` with `mentioned as text: …` is the
prescriptions-as-instructions problem; a missed `condition /smok|vap/` with `refused: … no ICD-10 code could be
confirmed` is the resolver. A `not in the chart: add-diagnosis …` line is either the plan over-reaching or a
chart that under-codes — the recording decides which, and `allowed` records the verdict.

## 9. Changing or adding a case

1. `npx tsx scripts/tests/autochart-select-cases.ts --top 30` shows which corpus cases are the best evidence
   (section 12); `--corpus top:30` runs either suite on them without copying anything.
2. `npx tsx scripts/tests/autochart-import-case.ts case123 my-case-id "Label"` copies one into
   `autochart-cases/` with the hand-written sections empty. Replace names, places, dates and organizations in
   the transcript and the chart's notes with placeholders (`<patient name>`, `<city>`…) before anything else.
3. Fill in `patient` (the loader refuses to run without an age and a sex), then the sections of section 5, in
   that order; read the transcript once per section.
4. `npx tsx scripts/tests/test-autochart-plan.ts --env local --dump-expectations --cases my-case-id` prints
   everything the case will expect, by tag, with the dropped gold, allowed items, facts and edits — the review
   surface, no AI call.
5. Run both suites on the case against a private local server (`--url http://localhost:3010`,
   `--concurrency 2 --repeat 2`), read every miss, and decide for each whether it is the model's or the case's.
   Fix only the case's.

Rules of thumb that held up: do not rewrite a transcript to make an expectation pass; expect only what a scribe
could chart from the audio; when the gold is wrong, drop it with a reason and put the right expectation in
`said`; allow only what the recording supports; keep a pattern lenient about wording and strict about the fact.

## 10. Limits of the method

- **Unvoiced is not scored**, so a plan that charts the chart's template normals gets no credit for it; that is
  a choice, made because templates are out of scope. The `+` lines show what it charted anyway.
- **The harvester's `voiced` flags are imperfect** (examples in section 4); a said item flagged unvoiced is
  reported, not scored.
- **A near-miss code counts twice** (section 5.5) unless allowed; the strictness is deliberate, the `allowed`
  list is the escape hatch, and a case run from the corpus has none.
- **A regex can pass on the wrong sentence.** `instruction /fever/` is satisfied by any instruction mentioning
  fever. Patterns were written for the wording of the recording and checked against it, not against every
  possible plan.
- **The judge is noisy.** Its contradiction verdict is one check of about twenty per case; on the baseline three
  or four of ten flags were arguable ("the patient did not deny weakness; she said it hurts when she uses her
  arms"). Read its flags before believing them; `--skip-judge` removes the check.
- **E&M is matched by level only** (99203 ≡ 99213), because the prefix is the visit count's and two charts bill
  the wrong one. The level gap (the plan picks level 3 where the chart billed 4 in six of ten cases) is real
  and visible.
- **The model is not deterministic**; two full passes agreed within two checks of 440, but any single check can
  flip. Use `--repeat 2` at least and read the flaky count.
- **The selector is heuristics over words** (section 12): a drug lexicon, phrase lists for who is speaking, a
  regex for the patient's age. Read its columns, not just its score.
- **The patient ages** as the calendar moves: the date of birth is computed from the case's age at run time, so
  the infant stays 10 months old, which is the intent, not a bug.

## 11. The numbers on the previous, hand-picked ten

Two versions of the scoring, each two full passes with `--repeat 2` on the same ten recordings (now in
`autochart-cases/retired/`):

| Number                           | 2026-09-24, hand-written forbidden lists | 2026-09-25, automatic precision (`extra`) |
| -------------------------------- | ---------------------------------------- | ----------------------------------------- |
| Plan, transcript path (headline) | 220/440 and 222/440                      | 186/411                                   |
| — voiced                         | 102/304, 101/302                         | 97/302                                    |
| — said                           | 42/60, 45/62                             | 49/62                                     |
| — forbidden / extra              | 36/36 forbidden                          | 0/7 extra                                 |
| — invariants                     | 40/40                                    | 40/40                                     |
| — unvoiced, context (not scored) | 5/1002, 0/162                            | 5/1002, 0/162                             |
| — flaky checks                   | 20, 16                                   | 16                                        |
| Plan, narrative path             | 97/220, 98/220                           | 87/207                                    |
| Provider edits                   | 7/8, 6/8                                 | 8/8                                       |
| Narrative suite                  | 155/191 (file facts only)                | 209/251 (chart facts + file facts)        |

The seven extras that remain on the ten are all coding disagreements worth a look rather than hallucinations:
`H66.93` otitis media, bilateral, where the chart codes the left and the right ear separately; the visit's own
diagnoses added a second time as conditions (`N39.0`, `K59.00`); `E78.5` hyperlipidemia as a condition where the
chart has `E78.2` as a diagnosis; a low-back strain (`S39.012A`, `M54.50`) for the cough-induced back spasm the
chart coded `M62.830`; `K90.49` and `K58.9` for a gastroenteritis whose provider mentioned IBS as a possibility.
Before the class-named rule (section 5.5) there were fourteen: the other seven were "oral steroid", "topical
steroid", "muscle relaxer", "nasal spray" and "decongestant".

What the misses say about the product, in order of size: the plan emits 3–6 ROS findings per case against 7–11
voiced in the chart (symptoms from the history never become ROS); the exam matcher misfiles voiced findings
("Back muscle tenderness" → skin-location, "Heart sounds normal" → normal-bowel-sounds, "Eyes clear" →
chest-clear); the plan charts one to three diagnoses against three to six (symptom codes, chronic conditions,
laterality and external-cause codes missing); the E&M level is one below the chart's in six of ten; prescriptions
land as instruction text (Augmentin, Tessalon, lidocaine, Pepcid) while the provider-edit path charts them as
medications; "Former smoker" and "Personal history of colon resection" are refused by the ICD resolver; surgical
history is never emitted; the narrative drops context and negatives (the state the patient lives in, "I never
smoked", the urologist, the prostate, the cancer).

### 11.1 The numbers on the current ten (the selector's top ten)

One pass each on 2026-09-25, no hand-written sections:

| Number                           | Plan suite (`--repeat 2`)                                     | Narrative suite     |
| -------------------------------- | ------------------------------------------------------------- | ------------------- |
| Headline                         | 147/291                                                       | 65/73               |
| — voiced                         | 107/230 (47%)                                                 | 60/65 chart facts   |
| — extra                          | 0/21 (two of them "steroidal nasal spray", no longer counted) | —                   |
| — invariants                     | 40/40                                                         | 5/8 (3 judge flags) |
| — unvoiced, context (not scored) | 3/312, 0/116                                                  | —                   |
| — flaky checks                   | 9                                                             | —                   |
| Plan, narrative path             | 72/149                                                        | —                   |
| Per-case headline                | median 50%, range 23%–62%                                     | median 100%         |

The recall misses: diagnoses 43, exam 33, ROS 25, E&M 11 (all a level below the chart), medication 7, disposition
1, over both runs. The extras are mostly the coder's choice of a neighbouring or a less specific code (J02.8 for
J02.9, J30.9 for J30.89, "unspecified ear" where the chart names the ear), the visit's diagnoses repeated as
conditions, and the screening visit's differential charted as diagnoses (trichomoniasis, chlamydia) — plus two
ICD resolutions that are simply wrong and worth a product ticket: "history of ear infections" → `Z87.410
Personal history of cervical dysplasia`, and "gonorrhea" → `O98.22 Gonorrhea complicating childbirth`. The
judge's three flags are real: the narrative swapped which ear was worse, turned a photo the patient showed into
an exam, and "impacted" ears into a cleaning the clinician declined.

## 12. The selector and the corpus run

[`autochart-select-cases.ts`](autochart-select-cases.ts) reads every corpus case and prints, per case:

| Column               | What it measures                                                                                                                                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`, `pt`       | The patient status from the corpus; the age and sex read from the HPI (`—` when it does not say: such a case cannot run unattended)                                                                                                                                         |
| `chars`, `turns`     | The recording's length and its speaker turns (`Provider:` / `Patient:` segments)                                                                                                                                                                                            |
| `bal`                | The share of turns held by the rarer speaker: 0.5 is a dialogue, 0 a monologue                                                                                                                                                                                              |
| `swap`               | The share of speaker-typical phrases ("what brings you in", "I'm going to prescribe" / "it hurts", "I've been having") found under the other label: above 0.5 the labels are swapped                                                                                        |
| `cut`                | The recording stops mid-sentence                                                                                                                                                                                                                                            |
| `voiced`             | Voiced chart items over all judged chart items (the corpus's own count)                                                                                                                                                                                                     |
| `orders`             | The same over the orders alone: diagnoses, named prescriptions, disposition                                                                                                                                                                                                 |
| `unv.ord`, `unv.nrm` | Chart orders never said; ROS and exam normals never said                                                                                                                                                                                                                    |
| `said-not-charted`   | Drug names the recording says that no chart medication accounts for (a lexicon of every product the corpus ever charted, minus plain-English words); in brackets, topics stated whose chart section is empty: `[referral]`, `[surgery]`, `[allergy]`, `[imaging]`, `[labs]` |
| `score`              | `scoreOf`: 0.45 × agreement (0.6 voiced share + 0.4 orders share, scaled down below 12 voiced items) + 0.3 × recording (length to 2.5k, turns to 20, balance, labels, not cut) − 0.15 × unvoiced (orders to 5, normals to 60) − 0.1 × said-not-charted (to 4)               |

`--top N`, `--min-score X`, `--tier OK,GOLD-GAP`, `--json out.json`, `--ids`; a bare `caseNNN` prints one case's
metrics in full. The committed cases are marked `★`.

`--corpus all|top:N|case1,case2` on either suite runs the corpus cases in the ranking's order, with the
hand-written sections empty and the patient from the HPI; a case whose HPI has no age and sex is skipped with a
message. The results print as each case completes, so a run over a few hundred cases leaves its trace as it
goes; the JSON at the end has every case.

### 12.1 The OK tier on 2026-09-25

Both suites over every runnable OK case (369 of 396: the rest have no age and sex in the HPI), one run each,
transcript path only for the plan, no hand-written sections:

| Number                           | Plan suite                                                   | Narrative suite                          |
| -------------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| Headline                         | 1701/3865 (44%)                                              | 1531/1756 (87%)                          |
| — voiced (recall)                | 963/2612 (37%)                                               | chart facts: 79 misses in 369 cases      |
| — extra (precision)              | 0/515 — 1.4 per case                                         | —                                        |
| — invariants                     | 738/738                                                      | unbacked share: 1 miss; judge: 145 flags |
| — unvoiced, context (not scored) | 116/12980 and 43/2673 charted anyway                         | —                                        |
| Per-case headline                | median 43%, quartiles 33%–55%, range 12%–100%                | median 100%, lower quartile 75%          |
| Model                            | 369 runs on gemini-3.1-flash-lite, 3 escalated to the backup | —                                        |

The recall misses by kind: exam 453, diagnosis 445, ROS 413, E&M 265, medication 46, disposition 27. The E&M
misses are one-directional: in 260 of 265 the plan picked a lower level than the chart (202 times level 3 for a
chart at 4, 27 times level 2 for a 4, 28 times level 2 for a 3) — a policy question as much as a model one. The
extras by kind: diagnosis 238, medication 131, condition 84, vital 27, surgical history 16, allergy 15. The
guards refused 27 conditions for want of a confirmable ICD-10 code, and refused exam normals "nobody voiced"
("No sinus tenderness", "Lungs clear", "Nontender") that the charts do have.

The selector's score does not predict the plan's score: Spearman 0.05 over 369 cases. That is as it should be —
it ranks the evidence, not the model — and it means a "best case" set chosen by the selector is not a set the
model happens to do well on.

The narrative suite's failures over the corpus are mostly the judge (145 of 225): a sample reads as genuine
distortions of degree and attribution ("fever" stated as definite where the patient said "I think so", "oral
antibiotics" where the clinician recommended an ointment, "the sibling is sick" where the transcript says the
sibling is fine) with some over-reach ("does not specify that the sciatica is right-sided"). Read them as a list
of what the narrative sharpens or blurs, not as a pass rate.
