# Billing Reports — Implementations

How each billing report is built on the [report refresh framework](./billing-report-refresh-framework.md).
This document covers the report-specific parts: data sources, params, compute pipelines,
drilldowns, and quirks. The refresh/cache/status mechanics are identical across all of them and
documented in the framework doc.

## Pages ↔ kinds

Five report pages serve six report kinds (the Payments page hosts two):

| Page (`apps/billing/src/pages/`) | Kind(s) | Drilldown |
|---|---|---|
| PaymentsReport | `payments`, `patient-payments` | ERA drawer, patient-payments drawer |
| InvoiceReport | `invoice` | — |
| CardsOnFileReport | `cards-on-file` | — |
| PipelineReport | `pipeline` | claims list (live `search-billing-claims`, not framework) |
| ProductivityReport | `productivity` | — |

All definitions live in `packages/zambdas/src/billing/reports/definitions/`.

---

## payments — Insurance Payments by Payer

[payments.report.ts](../packages/zambdas/src/billing/reports/definitions/payments.report.ts)

- **Data**: all posted ERAs (`PaymentReconciliation`, untagged client) + their `ClaimResponse`s
  + matched partial `Claim`s + payer `Organization`s (billing client).
- **Params**: check-date window (`dateFrom`/`dateTo`) → one payload cache per window.
- **Compute**: one pass over every ERA produces three things:
  - **payer rows** — ERAs inside the check-date window roll up to the ERA's payer
    (`paymentIssuer`, else the ClaimResponses' insurer): ERA/claim counts, billed, allowed,
    insurance paid, check totals.
  - **waterfall matrix** — insurance paid by DOS month × check month, always spanning *all*
    ERAs regardless of the window (it's a lag triangle).
  - **detail** — every ERA with check number/date/month, payer reference id, and per-claim
    patient name, PCN, DOS + service month, billed/allowed/paid/patient-resp amounts.
- **Detail cache**: window-independent (`detailCacheKeyOf: () => ''`) since it spans all ERAs —
  one `payments:v2:all:detail` object no matter which window triggered the refresh.
- **Drilldown** (`select`): payer-row mode filters by payer reference id (`'none'` = ERAs with
  no payer reference) + check-date window; waterfall-cell mode filters by check month and trims
  each ERA to claims whose DOS lands in the service month.
- **Page**: payer DataGrid (row click → ERA drawer) + waterfall matrix (cell click → same
  drawer scoped to the cell). Date presets re-key the cache; each preset is its own snapshot.

## patient-payments — Patient Payments Rollup

[patient-payments.report.ts](../packages/zambdas/src/billing/reports/definitions/patient-payments.report.ts)

- **Data**: active `PaymentNotice`s in the window (billing client), resolved through
  notice → `Encounter` → `Appointment` → participant `Location` (untagged client) for location,
  plus `Claim`/`Patient` for names and Stripe for payment statuses.
- **Params**: payment (created) date window → per-window payload *and* detail caches.
- **Compute**:
  - **rollup rows** — location × payment category (invoice-settling payments group under
    `invoice` regardless of how they were paid); collected/refunded/net totals.
  - **detail** — every payment in the window with patient name, location (+ id for filtering),
    category, amount, description, visit link, and **Stripe status** (`Paid`,
    `Invoice past due`, `Refunded`, …) resolved in the worker with bounded-concurrency
    invoice lookups. Statuses are therefore *as-of-refresh* snapshots, labeled "as of <time>"
    in the drawer.
- **Drilldown** (`select`): filters by location id (`'none'` = unresolved location) and/or
  payment category. The window itself comes from the report params keying the detail cache.
- **Page**: second half of PaymentsReport — method stat cards, location × method grid,
  row click → payments drawer. The page merges this kind's status with `payments`' via
  `mergeReportStatuses`, and Refresh triggers both.

## invoice — Invoice Report

[invoice.report.ts](../packages/zambdas/src/billing/reports/definitions/invoice.report.ts)

- **Data**: Stripe invoices across the platform account and every connected account stamped on
  billing-provider `Organization`s; FHIR `Patient`s/`Encounter`s (untagged) resolve names and
  visits from invoice metadata.
- **Params**: none (`invoice:v1:all`).
- **Compute**: two parallel Stripe listings — open invoices (customer/charge expanded) and
  *all* invoices (lean, for the aging trend) — streaming a combined progress line
  ("listing invoices… N open, M scanned for aging"). Then:
  - **rows** — every open invoice, categorized `upcoming` / `past-due-no-card` /
    `past-due-not-attempted` / `past-due-failed`. Card-on-file lookups are scoped to past-due
    customers; a failed lookup throws rather than masquerade as "no card", so a partial result
    is never cached as complete.
  - **aging trend** — month-end snapshots reconstructed from all invoices via
    `status_transitions`: an invoice counts at time T if finalized by T and not yet
    paid/voided/uncollectible at T, bucketed by days past due.
- **Page**: Delinquency tab (category pie + grid) and Aging Receivables tab (bucket pies,
  trend chart, bucketed grid).

## cards-on-file — Credit Cards on File

[cards-on-file.report.ts](../packages/zambdas/src/billing/reports/definitions/cards-on-file.report.ts)

- **Data**: every Stripe customer across all accounts (deduped), open invoices per customer,
  and FHIR `Patient`s + last non-cancelled `Appointment` per matched patient.
- **Params**: none (`cards-on-file:v2:all`).
- **Compute** — the framework's most stateful report:
  - Card resolution is tiered: expanded default payment method → legacy default card source →
    fallback `paymentMethods.list` per customer (open-invoice customers first); the remainder
    persists as a **`pendingLookups` queue inside the cached payload**, drained in bounded
    batches by chained continuation runs with progress ("resolving cards 1,500/4,800…").
  - Because compute returns intermediate drain state in its payload, the worker's central save
    checkpoints the build between chained runs, and **`sanitizePayload`** strips that internal
    state before a payload leaves the server.
- **Page**: card/no-card toggle, due-invoices-only switch, Stripe/EHR deep links per row, plus
  a banner for a still-draining lookup queue.

## pipeline — Claims Pipeline

[pipeline.report.ts](../packages/zambdas/src/billing/reports/definitions/pipeline.report.ts)

- **Data**: all billing `Claim`s (lean `_elements` scan) — meta tags carry the AR stage/status,
  `Claim.total` is billed charges.
- **Params**: claim created-date window.
- **Compute**: buckets claims by AR stage × active status group; insurance-payer AR gets an
  attention breakout (denied / rejected / stale = no update in 30 days). For **unfiltered**
  runs it also upserts a daily snapshot into a separate history document
  (`pipeline-report-history:v1`, 180-day retention — *not* a cache, managed inside compute) and
  returns the closest ≥7-day-old snapshot for week-over-week deltas.
- **Page**: stage/status bars with deltas vs. the previous snapshot; cell click opens a claims
  drilldown that queries `search-billing-claims` live (a claims-list search, not a framework
  drilldown).

## productivity — Biller Productivity

[productivity.report.ts](../packages/zambdas/src/billing/reports/definitions/productivity.report.ts)

- **Data**: claim-history `Provenance`s (billing client) tallied per actor; `Practitioner`/
  `Device` names resolved via the untagged client.
- **Params**: action (recorded) date window (page presets: 7/30/90 days, all time).
- **Compute**: per-actor counts by activity (create/update/status change/tag change/submit/
  note), distinct claims touched, last action time; human vs. system actors flagged by the
  provenance agent type.
- **Page**: activity-column grid with actor-type and actor filters; stats follow the filters.

---

## Cache inventory (per environment)

| Kind | Payload objects | Detail objects |
|---|---|---|
| payments | one per date window | one (`:all:detail`) |
| patient-payments | one per date window | one per date window |
| invoice | one | — |
| cards-on-file | one (holds drain state) | — |
| pipeline | one per date window (+ one history DocumentReference) | — |
| productivity | one per date window | — |

All cached as gzipped JSON objects in the billing-app Z3 bucket under `billing-reports/`;
a `cacheVersion` bump abandons old objects in place. The pipeline history is the one
FHIR-resident piece, a `DocumentReference` under `ottehrIdentifierSystem('billing-report')`.
