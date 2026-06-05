# Stripe Integration Map (zambdas)

A map of every place the zambda backend invokes the Stripe API, with the metadata
written on each object. Focused on **charges** and **invoices**.

All calls go through `getStripeClient(secrets)` (`shared/stripeIntegration.ts` and
`patient/payment-methods/helpers.ts`), pinned to Stripe API version `2024-04-10`.
Almost every call passes a `stripeAccount` option — Ottehr uses **Stripe Connect
connected accounts**, resolved per appointment/encounter.

**Metadata convention** on money/billing objects:

```
metadata: { oystehr_patient_id, oystehr_encounter_id }
```

Two exceptions to keep in mind: **Customers** carry only `oystehr_patient_id`, and
**legacy PaymentIntents** used a singular `encounterId` key (see "Gotchas").

---

## 1. Charges — money actually moves

Charges happen two ways: a confirmed `PaymentIntent`, or paying an open `Invoice`.

```mermaid
flowchart TD
    T1(["EHR staff: charge card on file"]) --> H1["ehr/patient-payments/post"]
    T2(["EHR: in-person card reader / Terminal"]) --> H2["ehr/patient-payments/terminal/initiate-payment"]
    T5(["Scheduled RCM outreach<br/>trigger: invoice-due"]) --> H5["sub-outreach-charge-card<br/>FHIR Task subscription"]
    T6(["Cron / manual"]) --> H6["script: charge-due-and-past-due-invoices"]

    H1 -->|"paymentIntents.create<br/>confirm: true"| PI1{{"PaymentIntent succeeded<br/>metadata:<br/>oystehr_patient_id<br/>oystehr_encounter_id"}}
    H2 -->|"paymentIntents.create card_present<br/>then terminal.readers.processPaymentIntent"| PI2{{"PaymentIntent<br/>metadata:<br/>oystehr_patient_id<br/>oystehr_encounter_id"}}
    H5 -->|"find invoice by oystehr_encounter_id<br/>customers.retrieve then invoices.pay"| PAY1{{"open Invoice charged<br/>no metadata written"}}
    H6 -->|"invoices.list status open<br/>then invoices.pay"| PAY2{{"open Invoice charged<br/>no metadata written"}}

    PI1 -.->|writes| FPN["FHIR PaymentNotice<br/>identifier = PaymentIntent id<br/>spawns Task then candid sync / receipt"]

    classDef charge fill:#ffd5d5,stroke:#c92a2a,color:#000
    classDef handler fill:#d0ebff,stroke:#1971c2,color:#000
    classDef fhir fill:#d3f9d8,stroke:#2f9e44,color:#000
    classDef src fill:#f1f3f5,stroke:#868e96,color:#000
    class T1,T2,T5,T6 src
    class H1,H2,H5,H6 handler
    class PI1,PI2,PAY1,PAY2 charge
    class FPN fhir
```

| # | Location | Stripe call | Metadata set | Trigger |
|---|----------|-------------|--------------|---------|
| 1 | `ehr/patient-payments/post/index.ts:141` | `paymentIntents.create` with `confirm: true` | `oystehr_encounter_id`, `oystehr_patient_id` | EHR staff charges a card on file |
| 2 | `ehr/patient-payments/terminal/initiate-payment/index.ts:70` | `paymentIntents.create` (`card_present`, `capture_method: automatic`, `setup_future_usage: off_session`) then `terminal.readers.processPaymentIntent` | `oystehr_patient_id`, `oystehr_encounter_id` | EHR in-person Stripe Terminal |
| 3 | `subscriptions/task/sub-outreach-charge-card/index.ts:251` | `invoices.pay` (after `customers.retrieve` to verify default PM) | none — invoice looked up by `oystehr_encounter_id` | Scheduled RCM outreach, via FHIR Task |
| 4 | `scripts/charge-due-and-past-due-invoices.ts:192` | `invoices.pay` | none — reads `customer.metadata.oystehr_patient_id` | Manual / cron **script** (not a deployed zambda) |

---

## 2. Invoices — created, finalized, sent, (later) paid

The whole invoice-creation lifecycle lives in **one** subscription task, fired by a
FHIR Task that the EHR's RCM "Invoicing" UI creates.

```mermaid
flowchart TD
    T4(["EHR RCM: Send invoice action"]) -->|"creates FHIR Task"| H4["sub-send-invoice-to-patient<br/>FHIR Task subscription"]

    H4 -->|"1 - invoices.create<br/>collection_method: send_invoice<br/>auto_advance: false<br/>metadata: oystehr_patient_id, oystehr_encounter_id"| INV{{"Invoice - draft"}}
    INV -->|"2 - invoiceItems.create<br/>no metadata"| ITEM{{"Invoice + line item"}}
    ITEM -->|"3 - invoices.finalizeInvoice"| FIN{{"Invoice - open"}}
    FIN -->|"4 - invoices.sendInvoice<br/>then SMS hosted_invoice_url to patient"| SENT{{"Invoice - sent"}}
    SENT -.->|"later: invoices.pay<br/>via sub-outreach-charge-card / script"| PAID{{"Invoice - paid"}}

    classDef invoice fill:#ffe8cc,stroke:#e8590c,color:#000
    classDef handler fill:#d0ebff,stroke:#1971c2,color:#000
    classDef src fill:#f1f3f5,stroke:#868e96,color:#000
    class T4 src
    class H4 handler
    class INV,ITEM,FIN,SENT,PAID invoice
```

| Step | Location | Stripe call | Metadata |
|------|----------|-------------|----------|
| 1 | `subscriptions/task/sub-send-invoice-to-patient/index.ts:203` | `invoices.create` (`collection_method: send_invoice`, `auto_advance: false`, `pending_invoice_items_behavior: exclude`, `due_date`) | `oystehr_patient_id`, `oystehr_encounter_id` |
| 2 | `…/sub-send-invoice-to-patient/index.ts:166` | `invoiceItems.create` | **none** |
| 3 | `…/sub-send-invoice-to-patient/index.ts:96` | `invoices.finalizeInvoice` | — |
| 4 | `…/sub-send-invoice-to-patient/index.ts:102` | `invoices.sendInvoice` (then SMS the `hosted_invoice_url`) | — |

Other invoice **send** points are scripts (not zambdas):
`scripts/send-past-due-invoices-to-patients-by-sms.ts` calls `invoices.sendInvoice`
at `:534`, `:630`, `:730`.

---

## 3. Customers & SetupIntents — no charge

```mermaid
flowchart TD
    P1(["Patient app: save card"]) --> H3["patient/payment-methods/setup"]
    E1(["EHR: account update"]) --> HU["ehr/patient-account/update"]
    E2(["EHR: merge patients"]) --> HM["ehr/merge-patients/perform"]
    E3(["Intake/EHR: paperwork harvest"]) --> HH["shared/harvest"]
    F1(["EHR: Terminal payment finalize"]) --> HF["ehr/.../terminal/finalize-payment"]

    H3 --> EC["ensureStripeCustomerId"]
    EC -->|"customers.create<br/>metadata: oystehr_patient_id"| CUST{{"Stripe Customer"}}
    EC -.->|"writes identifier back"| ACC["FHIR Account<br/>identifier = Stripe customer id"]
    H3 -->|"setupIntents.create<br/>no metadata"| SI{{"SetupIntent then client_secret"}}

    HU --> US["updateStripeCustomer"]
    HM --> US
    HH --> US
    US -->|"customers.update<br/>email / name / phone<br/>no metadata"| CUPD{{"Stripe Customer updated"}}

    HF -->|"customers.update<br/>invoice_settings.default_payment_method"| CDPM{{"Customer default PM set"}}

    classDef customer fill:#fff3bf,stroke:#f08c00,color:#000
    classDef handler fill:#d0ebff,stroke:#1971c2,color:#000
    classDef fhir fill:#d3f9d8,stroke:#2f9e44,color:#000
    classDef src fill:#f1f3f5,stroke:#868e96,color:#000
    class P1,E1,E2,E3,F1 src
    class H3,HU,HM,HH,HF,EC,US handler
    class CUST,SI,CUPD,CDPM customer
    class ACC fhir
```

| Location | Stripe call | Metadata |
|----------|-------------|----------|
| `shared/stripeIntegration.ts:83` (`ensureStripeCustomerId`) | `customers.create` | `oystehr_patient_id` — then writes customer id onto FHIR `Account.identifier` |
| `ehr/shared/harvest/index.ts:4235` (`updateStripeCustomer`) | `customers.update` (email/name/phone) | none |
| `ehr/patient-account/update/index.ts:158` | calls `updateStripeCustomer` | none |
| `ehr/merge-patients/perform.ts:297` | calls `updateStripeCustomer` | none |
| `ehr/patient-payments/terminal/finalize-payment/index.ts:222` | `customers.update` (set `default_payment_method`) + `paymentMethods.detach`/`retrieve`/`list`, `paymentIntents.retrieve` | none |
| `patient/payment-methods/setup/index.ts:72` | `setupIntents.create` (after `ensureStripeCustomerId`) | none on the intent |
| `patient/payment-methods/{list,set-default,delete}` | `customers.retrieve`/`listPaymentMethods`/`update`, `paymentMethods.retrieve`/`detach` | none |

---

## 4. Terminal / reader & account config — no charge

- `ehr/patient-payments/terminal/check-payment-status/index.ts:42` — `terminal.readers.retrieve`
- `ehr/patient-payments/terminal/cancel-reader-action/index.ts:39` — `terminal.readers.cancelAction`
- `ehr/patient-payments/terminal/get-config/index.ts:60` / `:66` — `terminal.readers.list`
- `rcm/payments/get-terminal-readers/index.ts:28` — `terminal.readers.list`
- `rcm/payments/get-stripe-account-info/index.ts:46` / `:65` — `accounts.retrieve`, `terminal.locations.list`

---

## 5. Read-only lookups — join back to FHIR by metadata

These set no metadata but **query by it**, so they are the linkage arrows in reverse.

```mermaid
flowchart LR
    K{{"Join key:<br/>metadata.oystehr_encounter_id<br/>plus legacy encounterId"}}

    R1["patient-payments/list + helpers<br/>paymentIntents.search / list"] --> K
    R2["template-placeholders<br/>findStripeInvoiceByEncounterId<br/>invoices.search"] --> K
    R3["patient-payment-receipt-pdf<br/>paymentIntents.search"] --> K
    R4["produce-invoice-due-outreach<br/>invoices.list"] --> K
    R5["sub-patient-payment-candid-sync<br/>paymentIntents.retrieve"] --> K

    classDef ro fill:#e9ecef,stroke:#868e96,color:#000
    classDef key fill:#f3d9fa,stroke:#9c36b5,color:#000
    class R1,R2,R3,R4,R5 ro
    class K key
```

- `ehr/patient-payments/list/index.ts` + `helpers.ts:58` / `:144` — `paymentIntents.search` with query `metadata['encounterId']:"…" OR metadata['oystehr_encounter_id']:"…"` (the legacy-key fallback), plus `paymentIntents.list/retrieve`, `paymentMethods.list/retrieve`
- `shared/template-placeholders.ts:160` (`findStripeInvoiceByEncounterId`) — `invoices.search` on `metadata['oystehr_encounter_id']`
- `shared/pdf/patient-payment-receipt-pdf.ts:176` / `:183` / `:278` — `paymentIntents.search`, `customers.retrieve`, `paymentMethods.retrieve`
- `rcm/scheduled-outreach/producers/shared/produce-invoice-due-outreach.ts:118` — `invoices.list`, then reads `invoice.metadata.oystehr_patient_id` / `oystehr_encounter_id`
- `subscriptions/task/sub-patient-payment-candid-sync-and-receipt/index.ts:126` — `paymentIntents.retrieve`
- Read-only scripts: `report-past-due-invoices.ts`, `send-invoices-to-patients-by-sms.ts`, `send-past-due-invoices-to-patients-by-sms.ts`

---

## Metadata reference

| Stripe object | Created in | Metadata keys |
|---------------|-----------|---------------|
| PaymentIntent (card on file) | `ehr/patient-payments/post` | `oystehr_encounter_id`, `oystehr_patient_id` |
| PaymentIntent (terminal) | `ehr/.../terminal/initiate-payment` | `oystehr_patient_id`, `oystehr_encounter_id` |
| Invoice | `sub-send-invoice-to-patient` | `oystehr_patient_id`, `oystehr_encounter_id` |
| InvoiceItem | `sub-send-invoice-to-patient` | *(none)* |
| Customer | `ensureStripeCustomerId` | `oystehr_patient_id` only |
| Customer (update) | `updateStripeCustomer`, `finalize-payment` | *(none — metadata untouched)* |
| SetupIntent | `patient/payment-methods/setup` | *(none)* |

## FHIR ↔ Stripe linkage (join keys)

- **Stripe Customer** ↔ FHIR `Account.identifier`
  (systems `ACCOUNT_PAYMENT_PROVIDER_ID_SYSTEM_STRIPE` / `…_STRIPE_ACCOUNT` for
  connected accounts) — `makeStripeCustomerId`, `patient/payment-methods/helpers.ts:95`
- **Stripe PaymentIntent** ↔ FHIR `PaymentNotice.identifier`
  (system `https://fhir.oystehr.com/PaymentIdSystem/stripe`, `stripeIntegration.ts:51`)
- **Stripe Invoice / PaymentIntent → Patient / Encounter** — only via the
  `oystehr_patient_id` / `oystehr_encounter_id` metadata

## Gotchas

1. **Legacy `encounterId` key** — older PaymentIntents stored the encounter under
   `encounterId` (singular), not `oystehr_encounter_id`. Only the payment-list query
   handles both; invoice lookups (`findStripeInvoiceByEncounterId`) and outreach match
   `oystehr_encounter_id` only.
2. **Not Stripe (don't confuse it)** — `subscriptions/task/sub-send-patient-statement-by-mail/index.ts:130`
   sets `metadata: { oystehr_patient_id, oystehr_encounter_id, oystehr_project_id }` on a
   **physical-mail** API (`mailingClass`/`color`/`doubleSided`), not Stripe.
```