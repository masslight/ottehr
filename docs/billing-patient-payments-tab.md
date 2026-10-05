# Billing App — Patient Payments Tab (UI Prototype)

## Status

**UI-only prototype.** All data on the tab is mocked in the frontend
(`apps/billing/src/components/patient/paymentsTabMock.ts`); no zambda calls are made and no
actions persist. The purpose is to validate layout, interactions, and workflows before backend
work is scoped.

## Overview

The individual patient screen in the billing app (`/patients/:id`) gains a new **Payments** tab,
placed next to the existing **Claims** tab. The tab shows two compact tables — **Payments** and
**Invoices** — styled like the existing claims table, plus new invoice-based totals in the
patient balance summary at the top of the page.

## 1. Payments table

Lists all payments made by (or on behalf of) the patient, newest first. An **Add payment**
button sits above the table.

### Add payment

- Opens a dialog modeled on the EHR visit-details payment dialog (`PaymentDialog`): amount
  field plus a payment-method radio row — Card / Card Reader / Cash / Check.
- `Card` shows a saved-card select with brand logo and last-4 (prototype: two mocked cards).
- `Card Reader` notes the terminal flow is simulated.
- The submit button reads **Process Payment** for card/terminal and **Record Payment** for
  cash/check, matching the EHR.
- **Prototype behavior:** confirming prepends the payment to the table (dated today) and shows
  a snackbar. No money moves.

| Column | Content |
| --- | --- |
| Payment Date | Date the payment was taken |
| Amount | Payment amount, USD-formatted |
| Encounter | Visit date, rendered as a link that opens the visit in the EHR app (new tab) |
| Claim | Claim service date, rendered as a link to the claim detail page in the billing app; blank when the payment is not tied to a claim |
| Method | How the payment was made — see below |
| Actions | Refund action — see below |

### Method column

- `Card` — card on file charged through Stripe
- `Card reader` — Stripe terminal payment
- `External card reader` — card payment taken on a non-integrated reader
- `Cash`
- `Check`
- `Invoice` — payment made against an emailed/portal invoice

For card and card-reader payments the cell shows the **card brand logo and last-4 digits**
(e.g. `[VISA] •••• 4242`) using the same `CreditCardBrandIcon` component as the EHR visit
details page.

### Refund action

- Each row's Actions column shows an **undo-style arrow icon** button.
- Hovering the button shows a **"Refund"** tooltip.
- Clicking opens a **refund dialog** modeled on the EHR visit-details refund dialog
  (`PaymentDetailsDialog` → `PaymentActionDialog`): refund amount (pre-filled with the
  remaining refundable amount, validated between $0.01 and the remaining amount), a required
  reason select (shared `PAYMENT_REFUND_VOID_REASONS` list), and optional notes.
- Fully refunded payments show a `REFUNDED` chip, partially refunded ones show
  `PARTIALLY REFUNDED`, and the refund action is disabled once nothing remains refundable.
- **Prototype behavior:** confirming the refund updates local state only (marks the refunded
  amount on the row and shows a success snackbar). No money moves.

## 2. Invoices table

Listed below the payments table; shows all open or settled invoices for the patient, newest
first. An **Issue invoice** button sits above the table.

### Issue invoice

- Opens a dialog modeled on the EHR invoicing report's **Issue Invoice** dialog
  (`SendInvoiceToPatientDialog`): amount, due date (defaults to +30 days, must be in the
  future), SMS message, and invoice memo (both pre-filled with placeholder templates).
- The submit button reads **Send Invoice**.
- **Prototype behavior:** confirming prepends an `Open` invoice to the table (dated today) and
  shows a snackbar. No Stripe invoice is created and no SMS is sent.

| Column | Content |
| --- | --- |
| Invoice Date | Date the invoice was issued |
| Due Date | Payment due date |
| Amount | Invoice amount, USD-formatted |
| Visit | Visit date, rendered as a link that opens the visit in the EHR app (new tab) |
| Claim | Claim service date, linked to billing-app claim detail; blank when not claim-backed |
| Status | `Open`, `Past Due`, `Paid`, or `Void` (colored chips) |
| Actions | Void invoice — see below |

When a paid invoice's linked payment has been refunded, the status cell also shows the
`REFUNDED` / `PARTIALLY REFUNDED` chip from the payments table, so the refund is visible from
the invoice side too.

### Void action

- Open and past-due invoices show a **void icon** button with a **"Void invoice"** tooltip.
- Clicking asks for confirmation ("Void invoice?"), then (prototype) sets the invoice status to
  `Void` locally.
- Paid and void invoices have no void action.

## 3. Payment ↔ invoice cross-highlighting

A paid invoice may be linked to the payment that settled it (payment method `Invoice`).

- **Hovering** an invoice row that has a linked payment highlights that payment row in the
  payments table.
- **Hovering** a payment row that settled an invoice highlights that invoice row.
- **Clicking** a payment row (outside its links/actions) toggles a persistent selection; while
  selected, the linked invoice row stays highlighted (and vice versa for clicking an invoice).

## 4. Patient balance summary additions

The balance card at the top of the patient page currently shows Current Balance, Claims with
Patient Balance, and Pending Payments. It gains two invoice-based totals:

- **Open Invoices** — sum of all invoices in `Open` or `Past Due` status.
- **Past Due** — sum of invoices in `Past Due` status only (subset of the above), emphasized
  in red when non-zero.

**Prototype behavior:** both totals are computed from the mocked invoice list.

## Out of scope (for the prototype)

- Real data loading (payments, invoices) — requires new/extended billing zambdas.
- Executing refunds (Stripe + FHIR stamping) — the EHR-side flow exists
  (`patient-payments-refund`); a billing-app entry point would need RBAC decisions.
- Actually voiding Stripe invoices.
- Pagination/server filtering for long histories.
