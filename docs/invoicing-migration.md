# Patient Invoicing: Candid → Ottehr Billing Migration

This document describes the transition period during which the EHR's patient invoicing (Invoiceable
Patients) can run against Candid Health, the native Ottehr billing app, or both at once. It covers
the two control knobs, what each surface keys on, the operational states, and the checklist for
deleting the Candid side once the migration is complete.

---

## 1. Architecture in one paragraph

Both invoicing sources produce the same FHIR `Task` (code `send-invoice-to-patient`) via the shared
builder in `packages/zambdas/src/shared/invoice-tasks.ts`; everything downstream (the Invoicable
Patients screens, `get-invoices-tasks`, CSV export, the Stripe send subscription, statements,
outreach) is source-agnostic over those Tasks. A Task's origin is recorded as a `meta.tag` under
`invoice-task-source` (`candid` | `ottehr-billing`); legacy pre-migration tasks carry no tag and are
treated as `candid` everywhere (`getInvoiceTaskSource`). Billing-produced tasks additionally carry a
searchable `invoice-task-claim-id` identifier used for per-claim dedup and for refresh lookups
against the `search-billing-patient-ar-claims` endpoint.

## 2. The two control knobs

| Knob                                                       | Where                                                                                                                                | Answers                                                                | Values                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| `BILLING_INTEGRATION`                                      | env secret                                                                                                                           | "Where do claims get submitted in this env?"                           | `candid`, `ottehr`, `all` (unset behaves as `candid`)         |
| `candidInvoicingEnabled` / `ottehrBillingInvoicingEnabled` | feature flags (`packages/utils/lib/ottehr-config/feature-flags/index.ts`, schema in `packages/config-types/config/feature-flags.ts`) | "Which invoicing screens/producers does this customer's build enable?" | booleans; omitted → candid ON, billing OFF (today's behavior) |

They compose: a producer cron runs only when its integration is active in the env AND its flag is on
on in the build (`isCandidInvoicingEnabled` / `isOttehrBillingInvoicingEnabled` in
`packages/zambdas/src/shared/invoice-tasks.ts`).

## 3. What each surface keys on

| Surface                                                            | Keys on                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| EHR routes + admin nav entries (`App.tsx`, `adminNav.tsx`)         | feature flags; both-mode adds "— Candid" / "— Ottehr Billing" labels and the on-table source chip                  |
| `get-invoices-tasks`, `export-invoices`, `sub-export-invoices-csv` | `source` request param only (`candid` → `_tag:not`, `ottehr-billing` → `_tag`, absent → no filter)                 |
| Candid cron `create-invoices-tasks`                                | `isCandidInvoicingEnabled(secrets)`                                                                                |
| Billing cron `create-billing-invoices-tasks`                       | `isOttehrBillingInvoicingEnabled(secrets)`                                                                         |
| `sub-refresh-invoice-task`, `sub-send-invoice-to-patient`          | the Task's own source tag (never a global toggle, because a both-mode env holds tasks of each kind simultaneously) |

## 4. Migration states

| State                    | Flags (candid, billing)         | Typical `BILLING_INTEGRATION` | Behavior                                                                                                                             |
| ------------------------ | ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Candid only (default) | `true, false` (or both omitted) | `candid`                      | Today's behavior, single "Patient Invoicing" screen                                                                                  |
| 2. Transition            | `true, true`                    | `all`                         | Both screens, suffixed labels + source chips; both crons run; billers keep working lingering Candid AR while new billing AR flows in |
| 3. Billing only          | `false, true`                   | `ottehr`                      | Single plain "Patient Invoicing" screen backed by patient AR                                                                         |

Notes for state 2:

- `sub-send-claim` submits the same encounter to BOTH systems under `all`. The billing cron's
  per-encounter dedup (any send-invoice task on the encounter, regardless of source) enforces
  at-most-one invoice task per visit, first-producer-wins, and reports every cross-source skip to
  Sentry. Keep `all` short-lived.
- Flag/secret drift (e.g. billing screen on, env still `candid`) degrades to an empty screen; the
  producer gates AND both knobs, and refresh/send follow the task's own tag, so wrong data cannot be
  produced.
- Billing claims created manually in the billing app (no clinical encounter) cannot ride the
  Task/Stripe pipeline; the billing cron skips them loudly (Sentry). Their AR needs a separate
  surface (follow-up).

## 5. End-of-migration deletion checklist (Candid invoicing)

When state 3 is stable and no Candid AR remains collectible:

1. Delete the Candid cron `packages/zambdas/src/cron/create-invoices-tasks/` and its
   `CREATE-INVOICES-TASKS` entry in `config/oystehr-core/zambdas.json`.
2. Delete the candid branch in `sub-refresh-invoice-task` (`getCandidRefreshData`,
   `getCandidInventoryRecordForTask`, `getItemizationForClaim`) and the Candid client creation.
3. Delete the candid encounter-id guard branch in `sub-send-invoice-to-patient`.
4. Delete the Candid route (`/reports/invoiceable-patients`), its admin nav entry
   (`/admin/outreach/patient-invoices`), and re-point any bookmarks to the billing paths.
5. Remove `candidInvoicingEnabled` from the flag schema/data/re-export and collapse
   `BOTH_INVOICING_SCREENS_ENABLED` labeling (plain titles, drop the source chip).
6. Decide the fate of remaining `candid`-tagged/untagged Tasks: leave them readable on the billing
   screen is NOT possible (they stay excluded by `_tag`), so either archive them or re-tag after
   verifying no open AR.
7. `getInvoiceTaskSource` can then treat absence as `ottehr-billing` or be inlined away once no
   legacy tasks matter.

## 6. Key files

- `packages/zambdas/src/billing/search-billing-patient-ar-claims/`: the patient AR endpoint
  (`searchPatientArClaims` core, imported by the billing cron and refresh)
- `packages/zambdas/src/shared/invoice-tasks.ts`: shared task builder + producer gates
- `packages/utils/lib/helpers/tasks/invoices-tasks.ts`: source tag/identifier helpers + search-param
  builder
- `packages/utils/lib/types/api/invoicing.types.ts`: source constants, task input schemas
- `apps/ehr/src/pages/reports/InvoiceablePatients.tsx`: the shared screen, parameterized by `source`
