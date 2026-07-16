// A one-row-per-encounter dataset for ad-hoc BILLING reporting. The base row carries visit + patient +
// location/provider identity; the opt-in layers (payments / coverage / charges / codes) are toggled
// per request so a report fetches only the billing data it needs. Mirrors the Encounters dataset's
// layer pattern, but the layers are the financial/insurance subsets.

export interface AdHocBillingInput {
  dateRange: { start: string; end: string };
  /** Patient payments collected for the visit (adds PaymentNotice to the fetch). */
  includePayments?: boolean;
  /** Insurance coverage for the patient (adds Coverage to the fetch). */
  includeCoverage?: boolean;
  /** Charges billed on the visit + expected charge from the fee schedule (adds ChargeItem +
   *  ChargeItemDefinition). When BOTH charges and payments are loaded, an outstanding balance is
   *  computed. */
  includeCharges?: boolean;
  /** Billing codes from the chart — CPT / E&M / ICD-10 (adds Procedure + Condition). */
  includeCodes?: boolean;
  /** Insurance claims filed for the visit + their responses (adds Claim + ClaimResponse). */
  includeClaims?: boolean;
}

export interface AdHocBillingRow {
  // --- Visit ---
  appointmentId: string;
  encounterId?: string;
  // RAW ISO visit start from the zambda (never zone-formatted server-side); the client dataset
  // rewrites it to the VIEWER-LOCAL yyyy-MM-dd day before any report sees it.
  date: string;
  visitType: string; // "In-Person" | "Telemed"
  serviceCategory: string;
  visitStatus: string;
  encounterType: string; // "main" | "follow-up" | "scheduled-follow-up"
  // --- Patient ---
  patientId: string;
  patientName: string;
  dateOfBirth: string | null;
  sex: string;
  city: string;
  state: string;
  zip: string;
  // --- Location / Provider ---
  location: string;
  region: string; // clinic region (proxied by the location's state)
  attendingProvider: string;
  // --- Payments (includePayments) — patient money collected for this visit ---
  paymentsCollected?: number | null; // total USD collected (PaymentNotice amounts), null if none
  paymentCount?: number; // number of payments
  paymentMethods?: string[]; // distinct methods used: "card" | "card-reader" | "cash" | "check"
  // RAW ISO instant of the most recent payment from the zambda; rewritten to the viewer-local
  // yyyy-MM-dd day client-side. Null when the visit has no payments.
  lastPaymentDate?: string | null;
  // --- Coverage (includeCoverage) — the patient's insurance at the time of the report ---
  payerType?: string; // "Self-pay" | "Insured" | "Unknown"
  primaryPayer?: string; // primary plan/payer name (e.g. "Aetna")
  insuranceType?: string; // coverage type label/code (e.g. "HIP", "Self-pay")
  memberId?: string; // subscriber/member id on the primary coverage
  subscriberRelationship?: string; // "self" | "parent" | "spouse" | …
  coverageStatus?: string; // primary coverage status (active/cancelled/…)
  secondaryPayer?: string; // secondary plan/payer name, when a second coverage exists
  // --- Charges (includeCharges) — what was billed + the fee-schedule expected amount ---
  chargeCpts?: string[]; // CPT codes billed on the visit (ChargeItem.code)
  chargeCount?: number; // number of charge line items
  expectedCharge?: number | null; // sum of fee-schedule (charge-master) prices for the billed CPTs, USD
  // outstandingBalance is only populated when BOTH charges and payments layers are loaded.
  outstandingBalance?: number | null; // expectedCharge − paymentsCollected, USD
  // --- Billing codes (includeCodes) — diagnosis/procedure codes from the chart ---
  cptCodes?: string[]; // procedure CPT codes charted on the visit
  emCode?: string; // E&M level code (e.g. "99213")
  icdCodes?: string[]; // ICD-10 diagnosis codes
  // --- Insurance claims (includeClaims) — claims this practice filed for the visit ---
  claimCount?: number; // number of claims filed for the visit
  claimStatus?: string; // workflow status of the most recent claim (e.g. "open", "submitted", "paid", "denied")
  billedAmount?: number | null; // total billed to insurance across the visit's claims, USD
  insurancePaid?: number | null; // amount insurance has paid (from ClaimResponse), USD
  patientResponsibility?: number | null; // amount insurance assigned to the patient (from ClaimResponse), USD
  claimBalance?: number | null; // billedAmount − insurancePaid, USD (when both are known)
}

export interface AdHocBillingOutput {
  rows: AdHocBillingRow[];
}
