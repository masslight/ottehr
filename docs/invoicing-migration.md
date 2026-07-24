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
treated as `candid` everywhere (`getInvoiceTaskSource`). Billing-produced tasks additionally carry
an `invoice-task-claim-id` identifier recording the originating claim id, read off the task in
memory (not via a FHIR search) for per-claim dedupe and for refresh balance lookups against the
`search-billing-patient-ar-claims` endpoint.

## 2. The two control knobs

| Knob                            | Where                                                                                                                               | Answers                                                     | Values                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| `BILLING_INTEGRATION`           | env secret                                                                                                                          | "Where do claims get submitted in this env?"                | `candid`, `ottehr`, `all` (unset behaves as `candid`)     |
| `ottehrBillingInvoicingEnabled` | feature flag (`packages/utils/lib/ottehr-config/feature-flags/index.ts`, schema in `packages/config-types/config/feature-flags.ts`) | "Does this customer's build surface the billing invoicing?" | boolean; on → candid + billing, off/omitted → candid only |

They compose: candid invoicing runs wherever the env submits to Candid (`isCandidInvoicingEnabled` =
`shouldUseCandid(secrets)`), and billing invoicing runs only where the env submits to Ottehr AND the
build opts in (`isOttehrBillingInvoicingEnabled` = `shouldUseOttehrBilling(secrets) && flag`, both
in `packages/zambdas/src/shared/invoice-tasks.ts`). Candid stays on for the whole transition;
turning it off (billing only) is the deletion checklist below, not a flag.

The checked-in core config (`packages/utils/lib/ottehr-config/feature-flags/index.ts`) deliberately
sets `ottehrBillingInvoicingEnabled: true`, so a core build runs in the state-2 transition (both
screens) to exercise the full migration. Omitting the flag is the "candid only" default; per-
customer candid builds simply leave it off.

## 3. What each surface keys on

| Surface                                                            | Keys on                                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| EHR routes + admin nav entries (`App.tsx`, `adminNav.tsx`)         | feature flags; both-mode adds "— Candid" / "— Ottehr Billing" labels and the on-table source chip                  |
| `get-invoices-tasks`, `export-invoices`, `sub-export-invoices-csv` | `source` request param only (`candid` → `_tag:not`, `ottehr-billing` → `_tag`, absent → no filter)                 |
| Candid cron `create-invoices-tasks`                                | `isCandidInvoicingEnabled(secrets)`                                                                                |
| Billing cron `create-billing-invoices-tasks`                       | `isOttehrBillingInvoicingEnabled(secrets)`                                                                         |
| `sub-refresh-invoice-task`, `sub-send-invoice-to-patient`          | the Task's own source tag (never a global toggle, because a both-mode env holds tasks of each kind simultaneously) |

## 4. Migration states

| State                    | `ottehrBillingInvoicingEnabled` | Typical `BILLING_INTEGRATION` | Behavior                                                                                                                             |
| ------------------------ | ------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Candid only (default) | off (or omitted)                | `candid`                      | Today's behavior, single "Patient Invoicing" screen                                                                                  |
| 2. Transition            | on                              | `all`                         | Both screens, suffixed labels + source chips; both crons run; billers keep working lingering Candid AR while new billing AR flows in |
| 3. Billing only          | on (candid removed in code)     | `ottehr`                      | Single plain "Patient Invoicing" screen backed by patient AR; reached via the deletion checklist, not the flag                       |

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
5. Drop the always-on candid gating: retire `isCandidInvoicingEnabled`, the hardcoded
   `CANDID_INVOICING_ENABLED: true`, and collapse `BOTH_INVOICING_SCREENS_ENABLED` labeling (plain
   titles, drop the source chip). `ottehrBillingInvoicingEnabled` can then be removed entirely once
   billing is the only integration.
6. Decide the fate of remaining `candid`-tagged/untagged Tasks: they cannot stay readable on the
   billing screen (they remain excluded by `_tag`), so either archive them or re-tag them after
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
