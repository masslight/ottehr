// Billing dataset (one row per encounter, billing-focused). Zod is the single source of truth: TS
// types, response validation, prompt schema, UI checkboxes, and endpoint input flags all derive
// from the objects below.
import { z } from 'zod';
import { AdHocLayerMap, DatasetInput, datasetInputSchema, datasetRowSchema, LayerRowFields } from './dataset';

export const BillingBaseRowSchema = z.object({
  // --- Visit ---
  appointmentId: z.string().describe('Visit id; link href="/in-person/"+appointmentId+"/review-and-sign".'),
  encounterId: z.string().optional().describe('Encounter id (internal — dedupe/joins).'),
  date: z.string().nullable().describe('Visit date (yyyy-MM-dd).'),
  visitType: z.enum(['In-Person', 'Telemed', 'Unknown']).describe('Visit modality.'),
  serviceCategory: z.string().describe('Service line of the visit.'),
  visitStatus: z.string().describe('completed / arrived / cancelled / no-show …'),
  encounterType: z.enum(['main', 'follow-up', 'scheduled-follow-up']).describe('Kind of encounter row.'),
  // --- Patient ---
  patientId: z.string().describe('Patient id; link href="/patient/"+patientId. Count UNIQUE patients.'),
  patientName: z.string().describe('Patient full name.'),
  dateOfBirth: z.string().nullable().describe('Patient date of birth (yyyy-MM-dd).'),
  sex: z.string().describe('Patient sex/gender label.'),
  city: z.string().describe('Patient city.'),
  state: z.string().describe('Patient state.'),
  zip: z.string().describe('Patient ZIP/postal code.'),
  // --- Location / Provider ---
  location: z.string().describe('Clinic location name.'),
  region: z.string().describe("Clinic region (location's state)."),
  attendingProvider: z.string().describe('Attending provider full name.'),
});

// Typed as keys of the row so a field that isn't in the schema is a compile error.
export const BILLING_INTERNAL_FIELDS: readonly (keyof AdHocBillingRow)[] = ['encounterId'];

// Per-field opt-in value domain (see ENCOUNTER_DOMAIN_FIELDS for the policy): safe low-cardinality
// categoricals + clinical code fields. Excludes identifiers/contact, free text, numeric amounts.
// payerType is a z.enum already.
export const BILLING_DOMAIN_FIELDS: readonly (keyof AdHocBillingRow)[] = [
  // base categoricals
  'serviceCategory',
  'visitStatus',
  'sex',
  'state',
  'region',
  'location',
  // coverage / claims categoricals
  'primaryPayer',
  'secondaryPayer',
  'insuranceType',
  'coverageStatus',
  'subscriberRelationship',
  'claimStatus',
  'paymentMethods',
  // codes
  'chargeCpts',
  'cptCodes',
  'emCode',
  'icdCodes',
];

// Opt-in layers, declared ONCE (metadata + Zod field schema); everything else derives from this map.
export const BILLING_LAYERS = {
  payments: {
    label: 'Patient payments',
    description: 'Money collected from the patient for the visit — amounts, method (card/cash/check), and dates.',
    schema: z.object({
      paymentsCollected: z.number().nullable().describe('Total USD collected from the patient. Null when none.'),
      paymentCount: z.number().describe('Number of payments collected.'),
      paymentMethods: z.array(z.string()).describe('Distinct methods: "card"/"card-reader"/"cash"/"check".'),
      lastPaymentDate: z.string().nullable().describe('Date of the most recent payment (yyyy-MM-dd).'),
    }),
  },
  coverage: {
    label: 'Insurance & coverage',
    description: 'Insurance for the patient: payer/plan, self-pay vs insured, member id, and coverage status.',
    schema: z.object({
      payerType: z.enum(['Insured', 'Self-pay', 'Unknown']).describe('Primary coverage bucket.'),
      primaryPayer: z.string().describe('Primary insurance plan/payer name.'),
      insuranceType: z.string().describe('Primary coverage type label/code.'),
      memberId: z.string().describe('Subscriber/member id on primary coverage.'),
      subscriberRelationship: z.string().describe('Relationship to subscriber ("self"/"parent"/…).'),
      coverageStatus: z.string().describe('Status of primary coverage (active/cancelled/…).'),
      secondaryPayer: z.string().describe('Secondary insurance plan/payer, when present.'),
    }),
  },
  charges: {
    label: 'Charges & fee schedule',
    description: 'CPT codes billed on the visit and the expected charge from the fee schedule (charge master).',
    schema: z.object({
      chargeCpts: z.array(z.string()).describe('CPT codes billed (charge line items).'),
      chargeCount: z.number().describe('Number of charge line items.'),
      expectedCharge: z.number().nullable().describe('Sum of fee-schedule prices for billed CPTs, USD.'),
      outstandingBalance: z.number().nullable().describe('expectedCharge − paymentsCollected (needs both layers).'),
    }),
  },
  codes: {
    label: 'Billing codes (CPT / E&M / ICD-10)',
    description: 'Diagnosis and procedure codes from the chart used for billing.',
    schema: z.object({
      cptCodes: z.array(z.string()).describe('Procedure CPT codes charted on the visit.'),
      emCode: z.string().describe('E&M level code (e.g. "99213").'),
      icdCodes: z.array(z.string()).describe('ICD-10 diagnosis codes. HIERARCHICAL — prefix-match.'),
    }),
  },
  claims: {
    label: 'Insurance claims',
    description:
      'Insurance claims filed for the visit and their responses — claim status, amount billed, ' +
      'insurance paid, and patient responsibility.',
    schema: z.object({
      claimCount: z.number().describe('Number of insurance claims filed.'),
      claimStatus: z.string().describe('Status of most recent claim (open/submitted/paid/denied).'),
      billedAmount: z.number().nullable().describe('Total billed to insurance across claims, USD.'),
      insurancePaid: z.number().nullable().describe('Amount insurance paid (ClaimResponse), USD.'),
      patientResponsibility: z.number().nullable().describe('Amount assigned to patient (copay/deductible), USD.'),
      claimBalance: z.number().nullable().describe('billedAmount − insurancePaid, USD (when both known).'),
    }),
  },
} as const satisfies AdHocLayerMap;

export type BillingLayerId = keyof typeof BILLING_LAYERS;

export type AdHocBillingRow = z.infer<typeof BillingBaseRowSchema> & LayerRowFields<typeof BILLING_LAYERS>;
export const AdHocBillingRowSchema = datasetRowSchema(BillingBaseRowSchema, BILLING_LAYERS).describe(
  'One row per encounter (billing-focused).'
) as unknown as z.ZodType<AdHocBillingRow>;

export const AdHocBillingInputSchema = datasetInputSchema(BILLING_LAYERS);
export type AdHocBillingInput = DatasetInput<typeof BILLING_LAYERS>;

export const AdHocBillingOutputSchema = z.object({
  rows: z.array(AdHocBillingRowSchema),
});
export type AdHocBillingOutput = { rows: AdHocBillingRow[] };
