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

Each range first ran a **warm-up pass** (every report, every way, not counted): the database keeps what it has just read in memory, so the first read of a range is slower (see appendix B). The results below are the measured pass after it, one run per cell, the order of the ways rotating from report to report.

The main results are for this version **with the root lookups next to the layers** (patients / locations / practitioners by id no longer before the layers; commit `f83acb2175`). The same bench before that change is appendix A.

## Results

Time in seconds; in brackets, how many times the ideal time. **Every result matched the ideal one** (18 of 18 runs, no errors).

| Report | Range | ideal | current | studio |
|---|---|---|---|---|
| r1 visits by provider | 60 days | 6.0 | 8.2 (1.4×) | 8.9 (1.5×) |
| r2 temperature by location | 60 days | 6.0 | 9.2 (1.5×) | 7.4 (1.2×) |
| r3 diagnoses and CPT codes | 60 days | 5.6 | 8.9 (1.6×) | 6.8 (1.2×) |
| r1 visits by provider | a year | 18.2 | 34.7 (1.9×) | 32.3 (1.8×) |
| r2 temperature by location | a year | 27.1 | 40.6 (1.5×) | 48.8 (1.8×) |
| r3 diagnoses and CPT codes | a year | 27.6 | 40.8 (1.5×) | 40.9 (1.5×) |

Requests (async jobs / pages) for a year: ideal 52 / 221 / 139, current 165 / 252 / 254, studio 28 / 419 / 255.

**Noise.** At a year the same way varies by 20–40% from run to run (in the earlier pass, the warm-up and the measured run gave ideal r1 24.6 s and 17.0 s). Differences under ~1.3× at a year are within that; at 60 days runs agree within ~10–20%.

## Where the time goes

| Group | ideal | current | studio |
|---|---|---|---|
| 60 days: visits | 3.3–4.0 s (appointments and encounters in parallel) | 3.7 s (root) | 5.2–8.6 s |
| 60 days: the rest | 2.0–2.3 s | 3.5–4.5 s (root lookups 2.3–2.5 s, in parallel with the layer) | 0.3–1.0 s |
| a year: visits | 15–18 s | 17–19 s (root) | 32–34 s visits, 17–21 s encounters |
| a year: the rest | 1–12 s | 16–21 s (root lookups 13–14 s; layers 18–21 s, sharing the job pool with them) | 0.5–14 s |
| Building rows / the result | — | 0.0–1.0 s | — |

## Conclusions

1. **All three are complete.** Every report gave the ideal result in both ranges, in every pass.
2. **60 days: the change saved 1.3–1.9 s a report (~15%); this version is now 1.4–1.6× the ideal, Report Studio 1.2–1.5×** — about even, this version faster on r1. One round of jobs less: the visits, then the layers with the root lookups beside them.
3. **A year: this version 1.5–1.9×, Report Studio 1.5–1.8×** — even. The root itself fell from 30–31 s to 17–19 s, about the ideal visits (15–18 s). But the total barely moved (−0.3 to −1.8 s): the root lookups still send ~130 jobs, and they now share the 16-job pool with the layers, so the layers take longer (codes 10 → 21 s). The work moved, it did not shrink.
4. **That remaining work is mostly local's data.** On local the visits point at ~40 000 location ids and ~24 000 patient ids that mostly do not exist (141 locations and ~340 patients found), so the lookups are ~130 jobs of almost nothing. On production a year has ~20 000 real patients (~40 jobs) and a handful of locations, so the same change should show there as it did at 60 days. To be confirmed on production-like data.
5. **Report Studio's cost is in its runner, not in its plans.** Its visits step takes 32–34 s for a year in 11 large jobs, and its scoped steps send 250 ids per paged batch (228 requests for temperatures against 87 in ideal). The plans themselves are close to the ideal searches.
6. **The floor is ~6 s for 60 days and ~18–28 s for a year on local.** FHIR has no joins, so a report reads the visits and then makes a second pass by their ids, and every async job costs ~2.5 s.

## Takeaway

- On **short ranges** Report Studio is slightly ahead (60 days: 1.2–1.5× the ideal against 1.4–1.6×, a difference of ~1–2 s): a per-report plan reads only what that report needs, while this version always loads the dataset's base row.
- On **long ranges** this version is even with it or ahead (a year: 1.5–1.9× against 1.5–1.8×; faster on r2, even on r3).
- This version could close the short-range gap if wanted, but the gap is small, and almost any further optimization here — trimming fields, skipping base columns, reordering lookups — carries a risk of regressions (a silently empty column, a changed row). It is not worth chasing for ~1–2 s.

## Caveats

- **One measured run per cell**, and a year is noisy (20–40%). Repeat before deciding on a single number.
- **Local is not production.** Local has many visits and few clinical records: no temperatures at all (r2 measures the overhead of a search that returns nothing) and 37–429 CPT codes. On production the second pass carries far more data.
- **The Report Studio plans were written by hand** from its data map, not by Claude in Report Studio. They follow its recommended visit search, so they should be close to what it would write.

## Appendix A: before the root-lookups change (warm cache)

This version with patients / locations / practitioners loaded by id *before* the layers. Same bench, same day, with the warm-up. Every result matched the ideal one.

| Report | Range | ideal | current | studio |
|---|---|---|---|---|
| r1 visits by provider | 60 days | 5.4 | 10.1 (1.9×) | 6.3 (1.2×) |
| r2 temperature by location | 60 days | 6.4 | 10.5 (1.6×) | 7.0 (1.1×) |
| r3 diagnoses and CPT codes | 60 days | 5.9 | 10.1 (1.7×) | 7.1 (1.2×) |
| r1 visits by provider | a year | 17.0 | 36.5 (2.1×) | 33.2 (2.0×) |
| r2 temperature by location | a year | 34.4 | 40.9 (1.2×) | 52.8 (1.5×) |
| r3 diagnoses and CPT codes | a year | 25.6 | 41.7 (1.6×) | 45.3 (1.8×) |

Here this version's root took 5.6–5.9 s at 60 days and 30–31 s at a year, the lookups included.

## Appendix B: first run (cold cache)

The same bench run once without a warm-up, before the runs above. **It ran an earlier, less optimized build of this version**: the patient / location / practitioner lookups ran *before* the layers, not next to them (the change of appendix A). The rest was already in place: one async job per search, 500 ids, 16 jobs at once, layers in parallel. The first run of each range read data the database had not read yet, and in both ranges that was **ideal**: its visits took 8.2 s + 10.3 s at 60 days against 3.3–4.3 s once warm, and its encounters 24.1 s at a year against 14.4–15.2 s. That is why current looks faster than the ideal in the first row. Every result matched the ideal one here too.

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
