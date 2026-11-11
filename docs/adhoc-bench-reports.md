# Ad-hoc reports: this version vs ideal searches vs Report Studio

Measured 2026-11-11 on `local` with `npm run adhoc-bench-reports -- local` (`packages/zambdas`, read-only). Design: [adhoc-layer-graph.md](adhoc-layer-graph.md).

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

A visit is an appointment of the range with an Ottehr module tag and its encounter, follow-up notes left out. Data on local: a year is 43 607 appointments and 56 801 encounters; 60 days is 1 087 and 2 013.

Each range first ran a **warm-up pass** (every report, every way, not counted): the database keeps what it has just read in memory, so the first read of a range is slower (see the appendix). The results below are the measured pass after it, one run per cell, the order of the ways rotating from report to report.

## Results

Time in seconds; in brackets, how many times the ideal time. **Every result matched the ideal one** (18 of 18 runs, no errors).

| Report | Range | ideal | current | studio |
|---|---|---|---|---|
| r1 visits by provider | 60 days | 5.4 | 10.1 (1.9×) | 6.3 (1.2×) |
| r2 temperature by location | 60 days | 6.4 | 10.5 (1.6×) | 7.0 (1.1×) |
| r3 diagnoses and CPT codes | 60 days | 5.9 | 10.1 (1.7×) | 7.1 (1.2×) |
| r1 visits by provider | a year | 17.0 | 36.5 (2.1×) | 33.2 (2.0×) |
| r2 temperature by location | a year | 34.4 | 40.9 (1.2×) | 52.8 (1.5×) |
| r3 diagnoses and CPT codes | a year | 25.6 | 41.7 (1.6×) | 45.3 (1.8×) |

Requests (async jobs / pages) for a year: ideal 52 / 221 / 139, current 165 / 252 / 254, studio 28 / 419 / 255.

**Noise.** At a year the same way varies by 20–40% from run to run: the warm-up and the measured pass gave ideal r1 24.6 s and 17.0 s, ideal r2 26.1 s and 34.4 s. Differences under ~1.3× at a year are within that.

## Where the time goes

| Group | ideal | current | studio |
|---|---|---|---|
| 60 days: visits | 3.3–4.0 s (appointments and encounters in parallel) | 5.6–5.9 s (root) | 5.3–6.2 s |
| 60 days: the rest | 2.0–2.4 s | 3.2–3.3 s (base lookups + layers) | 0.3–1.0 s |
| a year: visits | 15–21 s | 30–31 s (root) | 32–38 s visits, 17–19 s encounters |
| a year: the rest | 2–13 s | 4–10 s | 0.5–14 s |
| Building rows / the result | — | 0.0–0.9 s | — |

## Conclusions

1. **All three are complete.** Every report gave the ideal result in both ranges, in this pass and in the cold one.
2. **60 days: Report Studio is close to the ideal (1.1–1.2×); this version is 1.6–1.9×**, a steady ~4 s above it. The cost is the number of job rounds one after another: this version runs the visits, then patients / locations / practitioners by id, then the layers and the base lookups (registrar names, schedules, groups) — each round at least one ~2.5 s job. The ideal searches run two rounds.
3. **A year: this version 1.2–2.1×, Report Studio 1.5–2.0×.** This version is faster on r2 and r3, Report Studio on r1; given the noise, the two are about even.
4. **The gap of this version is the root**: 30–31 s for a year against 15–21 s for the ideal visits. It loads the appointments and their encounters in full, then patients and locations by id *before* the layers start. On local the visits point at ~40 000 location ids that do not exist (84 requests, 141 found), so that second round costs more here than on production. Cheap next steps:
   - start the patient / location lookups together with the layers instead of before them (they are needed only to build the rows);
   - trim the root resources with `_elements`;
   - load the base lookups (registrar names, schedules, groups) only when a report reads those columns.
5. **Report Studio's cost is in its runner, not in its plans.** Its visits step takes 32–38 s for a year in 11 large jobs, and its scoped steps send 250 ids per paged batch (228 requests for temperatures against 87 in ideal). The plans themselves are close to the ideal searches.
6. **The floor is ~5–6 s for 60 days and ~17–34 s for a year on local.** FHIR has no joins, so a report reads the visits and then makes a second pass by their ids, and every async job costs ~2.5 s.

## Caveats

- **One measured run per cell**, and a year is noisy (20–40%). Repeat before deciding on a single number.
- **Local is not production.** Local has many visits and few clinical records: no temperatures at all (r2 measures the overhead of a search that returns nothing) and 37–429 CPT codes. On production the second pass carries far more data.
- **The Report Studio plans were written by hand** from its data map, not by Claude in Report Studio. They follow its recommended visit search, so they should be close to what it would write.

## Appendix: first run (cold cache)

The same bench run once without a warm-up, before the run above. The first run of each range read data the database had not read yet, and in both ranges that was **ideal**: its visits took 8.2 s + 10.3 s at 60 days against 3.3–4.3 s once warm, and its encounters 24.1 s at a year against 14.4–15.2 s. That is why current looks faster than the ideal in the first row. Every result matched the ideal one here too.

| Report | Range | ideal | current | studio |
|---|---|---|---|---|
| r1 visits by provider | 60 days | 12.5 (cold) | 11.6 (0.9×) | 30.5 (2.4×) ¹ |
| r2 temperature by location | 60 days | 6.3 | 10.8 (1.7×) | 12.3 (2.0×) |
| r3 diagnoses and CPT codes | 60 days | 6.6 | 11.2 (1.7×) | 8.0 (1.2×) |
| r1 visits by provider | a year | 26.4 (cold) | 42.0 (1.6×) | 34.0 (1.3×) |
| r2 temperature by location | a year | 30.5 | 44.6 (1.5×) | 52.2 (1.7×) |
| r3 diagnoses and CPT codes | a year | 23.9 | 45.8 (1.9×) | 43.9 (1.8×) |

¹ One slow job: Report Studio's visits step took 30.2 s in 3 requests; in the warm run the same step took 5.9 s.

What the cold run says on its own: a user who opens a report on data nobody read recently may wait up to 2–3× longer on the first load, whatever the engine.
