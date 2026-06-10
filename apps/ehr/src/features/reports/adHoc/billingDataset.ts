import { getAdHocBilling } from '../../../api/api';
import { availableLayersFor, dedupeByEncounter, fetchBatchedRange } from './datasetHelpers';
import { buildSchema, FieldDef } from './schema';
import { AdHocDataset, AdHocDatasetOption, AdHocRow, FetchContext } from './types';

// One row per encounter, BILLING-focused. The base row carries visit + patient + location/provider
// identity; the opt-in layers add the financial/insurance subsets (patient payments, insurance
// coverage, charges + expected fee-schedule amount, and the chart's billing codes). Mirrors the
// Encounters dataset's layer pattern.
export const ADHOC_BILLING_OPTIONS: AdHocDatasetOption[] = [
  {
    id: 'payments',
    label: 'Patient payments',
    description: 'Money collected from the patient for the visit — amounts, method (card/cash/check), and dates.',
    default: false,
  },
  {
    id: 'coverage',
    label: 'Insurance & coverage',
    description: 'Insurance for the patient: payer/plan, self-pay vs insured, member id, and coverage status.',
    default: false,
  },
  {
    id: 'charges',
    label: 'Charges & fee schedule',
    description: 'CPT codes billed on the visit and the expected charge from the fee schedule (charge master).',
    default: false,
  },
  {
    id: 'codes',
    label: 'Billing codes (CPT / E&M / ICD-10)',
    description: 'Diagnosis and procedure codes from the chart used for billing.',
    default: false,
  },
  {
    id: 'claims',
    label: 'Insurance claims',
    description:
      'Insurance claims filed for the visit and their responses — claim status, amount billed, ' +
      'insurance paid, and patient responsibility.',
    default: false,
  },
];

const BASE_FIELDS: FieldDef[] = [
  {
    name: 'appointmentId',
    type: 'string',
    description:
      "Unique id of the visit. To link to the visit's progress note (review & sign page), render an " +
      'anchor with href="/in-person/" + appointmentId + "/review-and-sign". Links open in a new tab.',
  },
  { name: 'date', type: 'date', description: 'Visit date (yyyy-MM-dd).' },
  { name: 'visitType', type: 'string', description: '"In-Person" or "Telemed".' },
  { name: 'serviceCategory', type: 'string', description: 'Service line of the visit (e.g. "Urgent Care").' },
  {
    name: 'visitStatus',
    type: 'string',
    description:
      'Visit status (completed, arrived, cancelled, no-show, …). Filter cancelled/no-show out for real visits.',
  },
  {
    name: 'encounterType',
    type: 'string',
    description: '"main" for a regular visit; "follow-up" / "scheduled-follow-up" for follow-up rows.',
  },
  {
    name: 'patientId',
    type: 'string',
    description: 'Unique patient id. Link with href="/patient/" + patientId. Use to count UNIQUE patients.',
  },
  { name: 'patientName', type: 'string', description: 'Patient full name.' },
  { name: 'dateOfBirth', type: 'date', description: 'Patient date of birth (yyyy-MM-dd).' },
  { name: 'sex', type: 'string', description: 'Patient sex/gender label.' },
  { name: 'city', type: 'string', description: 'Patient city.' },
  { name: 'state', type: 'string', description: 'Patient state.' },
  { name: 'zip', type: 'string', description: 'Patient ZIP/postal code.' },
  { name: 'location', type: 'string', description: 'Clinic location name.' },
  { name: 'region', type: 'string', description: "Clinic region (proxied by the location's state)." },
  { name: 'attendingProvider', type: 'string', description: 'Attending provider full name.' },
];

// --- Patient payments (includePayments) ---
const PAYMENT_FIELDS: FieldDef[] = [
  {
    name: 'paymentsCollected',
    type: 'number',
    description: 'Total USD collected from the patient for this visit (sum of payments). Null when no payment.',
  },
  { name: 'paymentCount', type: 'number', description: 'Number of payments collected on the visit.' },
  {
    name: 'paymentMethods',
    type: 'string[]',
    description: 'Distinct payment methods used: "card", "card-reader", "cash", or "check".',
  },
  { name: 'lastPaymentDate', type: 'date', description: 'Date of the most recent payment (yyyy-MM-dd).' },
];

// --- Insurance & coverage (includeCoverage) ---
const COVERAGE_FIELDS: FieldDef[] = [
  {
    name: 'payerType',
    type: 'string',
    description: '"Insured", "Self-pay", or "Unknown" (no coverage on file) — based on the primary coverage.',
  },
  { name: 'primaryPayer', type: 'string', description: 'Primary insurance plan/payer name (e.g. "Aetna").' },
  { name: 'insuranceType', type: 'string', description: 'Primary coverage type label/code.' },
  { name: 'memberId', type: 'string', description: "Subscriber/member id on the patient's primary coverage." },
  {
    name: 'subscriberRelationship',
    type: 'string',
    description: 'Patient\'s relationship to the subscriber ("self", "parent", "spouse", …).',
  },
  { name: 'coverageStatus', type: 'string', description: 'Status of the primary coverage (active/cancelled/…).' },
  { name: 'secondaryPayer', type: 'string', description: 'Secondary insurance plan/payer name, when present.' },
];

// --- Charges & fee schedule (includeCharges) ---
const CHARGE_FIELDS: FieldDef[] = [
  { name: 'chargeCpts', type: 'string[]', description: 'CPT codes billed on the visit (charge line items).' },
  { name: 'chargeCount', type: 'number', description: 'Number of charge line items on the visit.' },
  {
    name: 'expectedCharge',
    type: 'number',
    description: 'Expected charge in USD: sum of fee-schedule (charge-master) prices for the billed CPTs.',
  },
  {
    name: 'outstandingBalance',
    type: 'number',
    description:
      'expectedCharge − paymentsCollected, USD. Only populated when BOTH the Charges and Patient-payments ' +
      'layers are loaded (it needs both expected charge and payments).',
  },
];

// --- Billing codes (includeCodes) ---
const CODE_FIELDS: FieldDef[] = [
  { name: 'cptCodes', type: 'string[]', description: 'Procedure CPT codes charted on the visit.' },
  { name: 'emCode', type: 'string', description: 'E&M level code charted on the visit (e.g. "99213").' },
  {
    name: 'icdCodes',
    type: 'string[]',
    description: 'ICD-10 diagnosis codes on the visit. ICD-10 is hierarchical — match a family by prefix.',
  },
];

// --- Insurance claims (includeClaims) ---
const CLAIM_FIELDS: FieldDef[] = [
  { name: 'claimCount', type: 'number', description: 'Number of insurance claims filed for the visit.' },
  {
    name: 'claimStatus',
    type: 'string',
    description: 'Workflow status of the most recent claim (e.g. "open", "submitted", "paid", "denied").',
  },
  { name: 'billedAmount', type: 'number', description: "Total billed to insurance across the visit's claims, USD." },
  { name: 'insurancePaid', type: 'number', description: 'Amount insurance has paid (from the claim response), USD.' },
  {
    name: 'patientResponsibility',
    type: 'number',
    description: 'Amount insurance assigned to the patient — copay/deductible/coinsurance — USD.',
  },
  { name: 'claimBalance', type: 'number', description: 'billedAmount − insurancePaid, USD (when both are known).' },
];

function fieldsFor(options: Record<string, boolean>): FieldDef[] {
  return [
    ...BASE_FIELDS,
    ...(options.payments ? PAYMENT_FIELDS : []),
    ...(options.coverage ? COVERAGE_FIELDS : []),
    ...(options.charges ? CHARGE_FIELDS : []),
    ...(options.codes ? CODE_FIELDS : []),
    ...(options.claims ? CLAIM_FIELDS : []),
  ];
}

async function fetchAdHocBilling({ oystehrZambda, dateRange, options }: FetchContext): Promise<AdHocRow[]> {
  const opts = options ?? {};
  const flags = {
    includePayments: !!opts.payments,
    includeCoverage: !!opts.coverage,
    includeCharges: !!opts.charges,
    includeCodes: !!opts.codes,
    includeClaims: !!opts.claims,
  };
  // Batch long ranges in parallel and dedupe by encounterId, like the other datasets.
  const rows = await fetchBatchedRange(
    dateRange,
    (range) => getAdHocBilling(oystehrZambda, { dateRange: range, ...flags }).then((r) => r.rows),
    dedupeByEncounter
  );
  return rows as unknown as AdHocRow[];
}

export const billingDataset: AdHocDataset = {
  id: 'billing',
  label: 'Billing',
  description:
    'One row per encounter, focused on billing & revenue; optional patient-payment, insurance-coverage, ' +
    'charges/fee-schedule, and billing-code layers.',
  options: ADHOC_BILLING_OPTIONS,
  fetch: fetchAdHocBilling,
  buildSchema: (rows, options) => {
    const opts = options ?? {};
    return buildSchema(
      rows,
      {
        datasetId: 'billing',
        label: 'Billing',
        description: 'One row per encounter — visit/patient identity plus any enabled billing layers.',
        availableLayers: availableLayersFor(ADHOC_BILLING_OPTIONS, opts),
      },
      fieldsFor(opts)
    );
  },
};
