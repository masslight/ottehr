# Ad-hoc reports: this version vs ideal searches vs Report Studio

Design: [adhoc-layer-graph.md](adhoc-layer-graph.md). Two benches: **synth** (2026-11-20, the current numbers) and **local** (2026-11-11, below).

## Synth, 90 days (2026-11-20)

Daniel's bench (`dabrams/otr-3737-ad-hoc-reports-complete-and-faster-fetching`, commit `b9013db346`, `npm run adhoc-bench-reports -- synth-daniel "90"`), this version at `3be1f113db`, run from a worktree. Data: 4 695 visits, 7 405 encounters, 4 193 patients. A warm-up pass, then three measured passes, the order of the ways rotating.

Two local changes to the bench, both to measure the same work:

- r2 and r4 give this version `includeVitalsTemperature` (`ADHOC_BENCH_VITALS_FLAG`), not the full `includeVitals`: ideal and the runner read only the temperature, and in the app a temperature report gets that layer.
- Each way's modules are loaded before the timer starts. Inside it, tsx transpiling this version's graph added ~1.5 s to every run; a deployed zambda is bundled.

Seconds, median of three passes (min–max in brackets):

| Report | ideal | this version | Report Studio runner |
|---|---|---|---|
| r1 visits by provider | 7.2 (6.8–12.0) | 8.7 (7.8–10.5) | **8.3** (8.0–8.4) |
| r2 temperature by location | 9.6 (9.2–10.4) | **9.8** (8.8–10.3) | 11.5 (11.4–20.3) |
| r3 diagnoses and CPT codes | 11.3 (9.9–13.4) | **11.5** (10.8–12.8) | 11.9 (10.8–12.2) |
| r4 heavy, per month (+ temperature, diagnoses, patient allergies) | 14.3 (13.2–20.1) | **12.6** (11.5–12.8) | 17.7 (15.0–18.2) |
| r5 heavy, per location (+ CPT, patient problems, allergies, visit history) | 14.7 (14.4–16.1) | **12.3** (11.2–14.7) | 13.7 (12.8–18.1) |

- **Every result matched ideal**, except this version's r5: 4 visits more counted as a new patient's (1 676 against 1 672). This version applies the app's rule (the Recent Patients report and the E&M suggestions: prior visits within the lookback, then the screening answers); the bench's reference counts prior visits only.
- **This version is fastest on r2–r5 by the median**, and r1 is within noise (0.4 s). Its worst run is 14.7 s; the runner's is 20.3 s.
- **Where the time goes now** (this version): the root, 5.2–10.6 s — the same as the runner's visits and encounters (6.6–17.5 s) and the ideal's (4.1–10.9 s); then the longest layer, 2–4 s; rows 0.2–0.4 s.
- 24 job slots instead of 16 (`ADHOC_JOBS_IN_PARALLEL=24`) made no difference on r5 (12.6 / 11.4 s).

What changed since Daniel's first synth run (this version 2–3× slower than the runner then):

| Commit | Change | Measured |
|---|---|---|
| `ac4a7dc` … `cfeec0f` | a search runs as up to 6 plain pages first, an async job only when larger; pages side by side, the first with `_total` | r1 22.9 → 9.1 s |
| `298e864` | the root as three searches side by side; one-vital layers | r2 temperature 7.3 → 1.1–2.0 s |
| `2166be0` | patients and locations start when the appointments are in | — |
| `3b53d47` | each lab / nursing order mapped with only its own resources | UC 18: 589 s (timeout) → to re-measure; offline 3 000 orders 4.0 → 1.3 s |
| `78514c3` | infer picks the one-vital layer | — |
| `d060b36` | clinic open hours cached per clinic and day | rows 2.1 → 0.2–0.4 s |
| `c45c0a3` | visit history: prior visits and screening answers side by side, through the fetch helpers | visit history 4.3–5.7 → 1.7–3.0 s; r5 ~16 → 12.3 s |
| `0ff27ff`, `b16e6e7`, `3be1f11` | timing of every visits search, base lookup, shared search and foreign layer step | — |

Checked and left as is: the codes layer takes ~3 s like the runner's diagnoses and CPT steps, though it loads whole resources (the time is the server's, not the payload's).

## Local (2026-11-11)

Measured on `local` with `npm run adhoc-bench-reports -- local` (`packages/zambdas`, read-only), before the synth changes above.

### What was compared

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

### Results

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

### Where the time goes

| Group | ideal | current | studio |
|---|---|---|---|
| 60 days: visits | 3.3–4.0 s (appointments and encounters in parallel) | 3.7 s (root) | 5.2–8.6 s |
| 60 days: the rest | 2.0–2.3 s | 3.5–4.5 s (root lookups 2.3–2.5 s, in parallel with the layer) | 0.3–1.0 s |
| a year: visits | 15–18 s | 17–19 s (root) | 32–34 s visits, 17–21 s encounters |
| a year: the rest | 1–12 s | 16–21 s (root lookups 13–14 s; layers 18–21 s, sharing the job pool with them) | 0.5–14 s |
| Building rows / the result | — | 0.0–1.0 s | — |

### Conclusions

1. **All three are complete.** Every report gave the ideal result in both ranges, in every pass.
2. **60 days: the change saved 1.3–1.9 s a report (~15%); this version is now 1.4–1.6× the ideal, Report Studio 1.2–1.5×** — about even, this version faster on r1. One round of jobs less: the visits, then the layers with the root lookups beside them.
3. **A year: this version 1.5–1.9×, Report Studio 1.5–1.8×** — even. The root itself fell from 30–31 s to 17–19 s, about the ideal visits (15–18 s). But the total barely moved (−0.3 to −1.8 s): the root lookups still send ~130 jobs, and they now share the 16-job pool with the layers, so the layers take longer (codes 10 → 21 s). The work moved, it did not shrink.
4. **That remaining work is mostly local's data.** On local the visits point at ~40 000 location ids and ~24 000 patient ids that mostly do not exist (141 locations and ~340 patients found), so the lookups are ~130 jobs of almost nothing. On production a year has ~20 000 real patients (~40 jobs) and a handful of locations, so the same change should show there as it did at 60 days. To be confirmed on production-like data.
5. **Report Studio's cost is in its runner, not in its plans.** Its visits step takes 32–34 s for a year in 11 large jobs, and its scoped steps send 250 ids per paged batch (228 requests for temperatures against 87 in ideal). The plans themselves are close to the ideal searches.
6. **The floor is ~6 s for 60 days and ~18–28 s for a year on local.** FHIR has no joins, so a report reads the visits and then makes a second pass by their ids, and every async job costs ~2.5 s.

### Heavy reports: visits with patients data (a year)

Two more reports, each reading several layers and patient-level data at once — in this version, encounter layers plus foreign `patients.*` layers. Same bench, warm cache, a year (43 588 appointments, 56 794 encounters, 341 patients).

| Report | Reads | ideal | current | studio |
|---|---|---|---|---|
| r4 — per month: visits, with a temperature, with a diagnosis, of a patient with a known allergy | visits + vitals + diagnoses + patient allergies | 32.6 | 48.8 (1.5×) | 43.4 (1.3×) |
| r5 — per location: visits, of new patients, with a CPT code; top 10 problems of the visits' patients | visits + CPT + patient problems, allergies, visit history | 30.2 | 42.7 (1.4×) | 45.5 (1.5×) |

Both results matched the ideal one. Requests: ideal 188 / 188, current 342 / 257, studio 352 / 353. The warm-up runs agreed within ~10% (ideal 30.5 / 35.6, current 46.4 / 45.1, studio 45.4 / 43.5 s).

- **Under more load the picture holds**: both engines stay at 1.3–1.5× the ideal, and neither wins on both reports.
- **Joining patients data costs little**: r4 and r5 take 2–8 s more than the single-layer reports of the same year (r3: 40.8 s for this version). The patient-level searches return little and run beside the rest; the time is still in the visits and in sharing the job pool.
- **In this version the layers wait for the pool**, not for the data: vitals 27 s and codes 22 s here, against 6–10 s before the root lookups ran beside them (appendix A): they share the same 16 slots with those ~130 jobs on local's dangling ids.

### Takeaway

- On **short ranges** Report Studio is slightly ahead (60 days: 1.2–1.5× the ideal against 1.4–1.6×, a difference of ~1–2 s): a per-report plan reads only what that report needs, while this version always loads the dataset's base row.
- On **long ranges** this version is even with it or ahead (a year: 1.5–1.9× against 1.5–1.8×; faster on r2, even on r3).
- This version could close the short-range gap if wanted, but the gap is small, and almost any further optimization here — trimming fields, skipping base columns, reordering lookups — carries a risk of regressions (a silently empty column, a changed row). It is not worth chasing for ~1–2 s.

### Caveats

- **One measured run per cell**, and a year is noisy (20–40%). Repeat before deciding on a single number.
- **Local is not production.** Local has many visits and few clinical records: no temperatures at all (r2 measures the overhead of a search that returns nothing) and 37–429 CPT codes. On production the second pass carries far more data.
- **The Report Studio plans were written by hand** from its data map, not by Claude in Report Studio. They follow its recommended visit search, so they should be close to what it would write.

### Appendix A: before the root-lookups change (warm cache)

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

### Appendix B: first run (cold cache)

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
