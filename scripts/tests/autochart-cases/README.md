# Autochart acceptance cases

How the sections were composed, where each is used and how it scores: [`../autochart-tests.md`](../autochart-tests.md).

One file per case, read by `test-autochart-plan.ts` and `test-autochart-narrative.ts`. Each is a real
recording copied from the eval corpus (`sourceCase` in `tools/easy-chart-eval/harvested-cases`, which is
PHI and gitignored) — the transcript, the chart the clinician signed (`gold`) and the patient status — plus
the part a person writes after reading the recording. The transcript is the recording: names, places,
dates and organizations in it (and in the chart's free-text notes) were replaced with placeholders —
`<patient name>`, `<clinician name>`, `<city>`, `<state>`, `<pharmacy>`, `<clinic>`, `<date>`, `<address>`, `<phone>` —
and a new case needs the same before it is committed.

Which corpus cases are worth copying: `npx tsx scripts/tests/autochart-select-cases.ts` ranks the OK tier by
how well the chart and the recording agree and how whole the recording is; the ten here are its top ten.
The suites also run straight from the corpus, without a copy, with `--corpus all` or `--corpus top:N`.
`retired/` holds the earlier hand-picked ten with their hand-written sections; nothing in it is loaded.

Every string that stands for a pattern is a JavaScript regular expression source, matched
case-insensitively: `"tylenol|acetaminophen"`, `"\\bice\\b"`.

| Field                | What it is                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `label`        | The name in the report and in `--cases id1,id2`.                                                                                                                                                                               |
| `patient`            | Age (`ageYears` or `ageMonths`) and `sex`; the corpus keeps neither. The suites create a real encounter for this patient.                                                                                                      |
| `patientStatus`      | `new` or `established`, from the corpus; an established case gets a second visit so the plan derives the status itself.                                                                                                        |
| `notes`              | Free text for the reader: what the recording rules out, a quirk of the transcript.                                                                                                                                             |
| `said`               | Said on the recording, absent from the signed chart: a drug the provider named but did not send, a surgery the patient described, the advice given. Scored like the voiced gold. Each item may carry a `note`.                 |
| `goldErrors`         | Gold items the recording contradicts: `match` is tested against the item as the dump prints it (`dx M5450 (primary) «Low back pain, unspecified»`); dropped from the expectations, listed with `reason`.                       |
| `allowed`            | Fine to chart although the chart lacks it: a symptom code beside the diagnosis, a neighbouring code, an over-the-counter mention. Keeps a coded action out of the precision count. Home medications are allowed automatically. |
| `narrativeFacts`     | What a read-back of the recording must carry, beside the facts derived from the voiced chart, for the narrative suite.                                                                                                         |
| `edits`              | A provider's correction of the generated narrative (`find` → `replace`, sent as `providerEdits`), with what the plan must then chart (`expected`) and must not (`forbidden`: the drug that was replaced).                      |
| `transcript`, `gold` | The recording and the signed chart, as harvested. Everything else the suites expect — voiced, unvoiced and context items, the chart's narrative facts — is derived from `gold` at run time.                                    |

Expectation items are `{ "kind": ... }` objects: `diagnosis` (`codePrefix`, string or list, dots removed;
`primary`), `ros` (`baseKey`, `finding`), `exam` (`field` or `display`), `medication` (`name`, `strength`),
`allergy` (`name`), `condition` (`codePrefix`, `name`), `surgicalHistory` / `hospitalization` (`display`),
`instruction` (`text`), `note` (`field`, `text`), `disposition` (`type`, `followUpInDays`), `em` (`codes`),
`vital`, `bloodPressure`, and `anyOf` (`of`: satisfied by any one).

To add a case: `npx tsx scripts/tests/autochart-import-case.ts case123 my-case-id "Label"` copies the
corpus case here with the hand-written sections empty; fill them in, then
`npx tsx scripts/tests/test-autochart-plan.ts --env local --dump-expectations --cases my-case-id` prints
everything the case will expect, for review, without calling the AI. The plan suite writes a per-case HTML page of what it saw — every action, whether a judge finds it said in
the transcript, the server's verified quote, the chart as reference — with `--report out.html`, for one case
(`--cases id`), all of them, or `--corpus …`; `autochart-report.ts` makes the same page without the suite.
