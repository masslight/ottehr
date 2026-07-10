# Ad-Hoc AI Reporting — Product Design (Review)

**PR:** #8320 · `dabrams/otr-2733-ai-assisted-ad-hoc-reporting` · **Ticket:** OTR-2733
**Reviewer note:** This is a review-side summary of the product as built, not the author's spec.

---

## What it is

A reporting tool inside the EHR where a user **describes the report they want in plain
English** and gets back a rendered visualization over live practice data. Instead of a fixed
catalog of reports, the user types (e.g.) *"bar chart of visits per provider last month"* or
*"average time from check-in to exam room by location"* and an LLM writes the code that draws
it. Useful reports can be **saved as tiles** that anyone with access re-opens later; each open
re-fetches fresh data, so a saved report stays live rather than freezing a snapshot.

## Who it's for

Gated in the UI to **Administrators only** today (it sits under **Reports → Ad-Hoc Report**).
The intended user is an operations/practice admin who needs a number that no existing canned
report answers, without waiting on an engineering ticket. *(Note: the admin-only limit is
enforced only in the browser — see the technical doc, Concern #1.)*

## The three datasets

The user first picks one of three curated, one-row-per-entity datasets, then a date range:

| Dataset | One row per… | Covers |
|---|---|---|
| **Encounters** | visit | visit/patient/location/provider + opt-in layers: codes, timing/KPIs, AI notes, vitals, labs, imaging, immunizations, disposition, exam/ROS, results, nursing, intake, documents, medications |
| **Patients** | patient | demographics + visit summary + allergy/problem/medication/surgical/hospitalization layers |
| **Billing** | encounter | payments, coverage, charges, codes, insurance-claims layers |

The heavier "layers" are **auto-selected from the request** — the user never manages
checkboxes. Ask about vitals and the vitals layer loads itself.

## The core workflow

1. **Pick** dataset + date range (Today / Last 7 / Last 30 / custom / custom range).
2. **Describe** the report in the text box and hit *Generate*.
3. The system infers which data layers the request needs, fetches the data, asks the LLM to
   write the report code, and **renders it in a sandboxed frame**. If the code fails to run, it
   silently regenerates a couple of times before surfacing an error.
4. **Refine** conversationally — *"now group by month," "make it a pie chart," "add a total
   row"* — or just say *"fix it"* if something looked off.
5. **Save** it (name + optional description). It becomes a **practice-wide tile** on the
   Reports page for everyone with report access.
6. **Re-open** a tile any time; it re-fetches current data and re-renders.

## What the user gets in the report

- **Charts** (Chart.js) and single-number KPIs, rendered in the frame.
- **Tables** are automatically upgraded into the same interactive **DataGrid** the rest of the
  Reports area uses — sortable, filterable, CSV-exportable, with optional **row drill-down**
  (click a row/point to reveal detail).
- **Deep links** back into the app (e.g. a row linking to a visit's progress note or the
  tracking board), opened in a new tab.
- All dates/times shown in the **viewer's local timezone**.

## Deliberate product guardrails

- **The AI never sees patient data.** Only *column metadata* (field names, types, and
  low-cardinality value lists that exclude names/DOB/contact/geo) is sent to the model. The
  actual rows stay in the user's browser. *(Verified by a regression test.)*
- **Saved reports store the view, not the data** — the dataset choice, the date criteria, and
  the generated code; never a data snapshot. Opening one always pulls fresh data.
- Reports are **read-only** views; nothing the tool generates writes back to the chart.

## Product risks & open questions (for us to decide)

1. **Trust vs. correctness.** A generated report looks as authoritative as a hand-built one,
   but nothing verifies the *numbers* are right — only that the report ran. A subtly wrong
   filter or a silently-substituted metric renders identically to a correct one. For a
   *clinical/financial* tool this is the central product risk. **Decision needed:** do we ship
   with a visible "AI-generated, verify before relying on it" treatment, a way to see the
   selection criteria, and/or a human-blessed "verified report" tier?
2. **Who curates the saved library?** Tiles are practice-wide and any admin can add/edit/delete
   them, and an auto-repair can silently rewrite a saved report's code on open. Over time this
   becomes an unmanaged, unversioned shared surface. **Decision needed:** ownership, naming,
   and review model for saved reports.
3. **Access scope.** The feature returns cross-patient PHI and full billing/insurance data. The
   UI limits it to admins, but the backend does not (technical doc, Concern #1). **Decision
   needed:** who is *actually* allowed to run these, and is that enforced server-side?
4. **No usage audit.** There's no product-level record of who ran what report over which PHI.
   For a broad data-access tool this may be a compliance expectation.
5. **Discoverability & scale.** Buried under Reports and admin-only; unbounded date ranges can
   pull very large result sets into the browser. Fine for a v1 admin tool; worth a plan before
   widening the audience.

## Suggested bar for launch

Ship as an **admin-only, clearly-labeled "AI-generated (beta)"** capability with (a)
server-side enforcement of the admin restriction, (b) visible selection-criteria/disclosure on
every report, and (c) a sane default cap on date range / row volume. Defer wider rollout and a
"verified reports" tier until we've watched real usage.
