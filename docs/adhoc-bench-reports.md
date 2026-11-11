# Ad-hoc reports: this version vs ideal searches vs Report Studio

Measured 2026-11-11 on `local`, one run per cell, with `npm run adhoc-bench-reports -- local` (`packages/zambdas`, read-only). Design: [adhoc-layer-graph.md](adhoc-layer-graph.md).

## What was compared

Three typical reports, each fetched three ways and computed to the same result with the same function:

| Report | Reads |
|---|---|
| r1 — visits per month per attending provider | visits, practitioners |
| r2 — per location: visits, visits with a temperature, average temperature | + temperatures, locations |
| r3 — visits with a diagnosis / a CPT code, top 10 ICD-10 | + diagnoses, procedures |

- **ideal** — hand-written minimal searches: only the fields the report reads (`_elements`), filters on the server (`_tag`), one async job per search, 16 at once, no engine.
- **current** — this version: the encounters dataset with the layer the report needs.
- **studio** — Report Studio's runner (`runFetchPlan`, branch `dabrams/report-studio-task`, run from a git worktree) with plans written as its data map recommends.

A visit is an appointment of the range with an Ottehr module tag and its encounter, follow-up notes left out. Data on local: a year is 43 608 appointments and 56 802 encounters; 60 days is 1 087 and 2 013.

## Results

Time in seconds; in brackets, how many times the ideal time. **Every result matched the ideal one** (18 of 18 runs, no errors).

| Report | Range | ideal | current | studio |
|---|---|---|---|---|
| r1 visits by provider | 60 days | 12.5 ² | 11.6 (0.9×) | 30.5 (2.4×) ¹ |
| r2 temperature by location | 60 days | 6.3 | 10.8 (1.7×) | 12.3 (2.0×) |
| r3 diagnoses and CPT codes | 60 days | 6.6 | 11.2 (1.7×) | 8.0 (1.2×) |
| r1 visits by provider | a year | 26.4 | 42.0 (1.6×) | 34.0 (1.3×) |
| r2 temperature by location | a year | 30.5 | 44.6 (1.5×) | 52.2 (1.7×) |
| r3 diagnoses and CPT codes | a year | 23.9 | 45.8 (1.9×) | 43.9 (1.8×) |

Requests (async jobs / pages) for a year: ideal 52 / 221 / 139, current 165 / 252 / 254, studio 29 / 419 / 255.

² The very first run of the bench, on a cold database cache: ideal's appointments took 8.2 s and encounters 10.3 s here, against 3.6–4.3 s for the same searches in the next reports. Current ran right after it.

¹ One slow job: Report Studio's visits step took 30.2 s in 3 requests; ideal took 12.5 s on the same run. A single run, so this cell is noise until repeated.

## Where the time goes (a year)

| Group | ideal | current | studio |
|---|---|---|---|
| Visits (appointments + encounters) | 15–24 s, the two in parallel | 32–37 s (root) | 33–37 s visits, 15–21 s encounters |
| What the report reads besides the visits | 2–15 s | 3–11 s (layers) | 1–15 s |
| Building rows / the result | — | 0.6–0.9 s | — |

## Conclusions

1. **Both engines are complete.** All three reports gave the ideal result in both ranges.
2. **Both engines are within ~2× of the ideal searches.** At a year, current is 1.5–1.9× and studio 1.3–1.8×; neither wins on every report. At 60 days all three are 6–13 s apart from one studio outlier.
3. **The remaining gap of this version is the root.** It takes 32–37 s for a year, against 15–24 s for the ideal visits:
   - the appointments and their encounters come in full, while ideal trims them to the fields the report reads;
   - patients and locations are loaded by id *before* the layers start, while ideal loads only what the report needs, in parallel. On local the visits point at ~40 000 location ids that do not exist (84 requests, 141 found), so this costs more here than on production.

   The cheap next steps: start the patient / location lookups together with the layers instead of before them, and trim the root resources with `_elements`.
4. **Report Studio's cost is in its own runner rules, not in its plans.** Its visits step takes 33–37 s for a year in 11 large jobs (its sizing aims at ~5 000 rows a job and pages first), and its scoped steps run 250 ids per paged batch: 228 requests for temperatures against 87 in ideal. Its plans are close to the ideal searches.
5. **The ideal itself is ~25–30 s for a year on local.** That is the floor for these reports with Oystehr's async jobs: FHIR has no joins, so a report needs the visits and then a second pass by their ids, and every job costs ~2.5 s.

## Caveats

- **One run per cell.** Repeat with more rounds before deciding on a single number.
- **Local is not production.** Local has many visits and few clinical records: no temperatures at all (r2 measures the overhead of a search that returns nothing), 37–429 CPT codes. On production the second pass carries far more data.
- **The Report Studio plans were written by hand** from its data map, not by Claude in Report Studio. They follow its recommended visit search, so they should be close to what it would write.
