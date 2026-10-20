import { z } from 'zod';
import { CODE_SYSTEM_CLAIM_TYPE_CODES } from '../../../helpers/rcm/constants';
import { CLAIM_STATUS_FIELDS, ClaimStatusFieldKey } from '../../data/billing/claim-status';
import { NonPatientWriteOffReasons, PatientWriteOffReasons } from '../../data/billing/write-off-reasons';
import { AdHocLayerMap, DatasetInput, datasetInputSchema, datasetRowSchema, LayerRowFields } from './dataset';

export const BILLING_CLAIMS_DATASET_ID = 'billing-claims';

const CLAIM_TYPE_VALUES = Object.values(CODE_SYSTEM_CLAIM_TYPE_CODES) as [
  (typeof CODE_SYSTEM_CLAIM_TYPE_CODES)[keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES],
  ...(typeof CODE_SYSTEM_CLAIM_TYPE_CODES)[keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES][],
];

// A status is a free string (a claim may carry a code the app no longer offers), described with the
// codes the billing app sets today so the model knows the vocabulary.
const statusField = (key: ClaimStatusFieldKey, meaning: string): z.ZodString => {
  const field = CLAIM_STATUS_FIELDS.find((f) => f.key === key);
  const codes = (field?.options ?? []).map((o) => `"${o.code}" (${o.label})`).join(', ');
  return z.string().describe(`${field?.label ?? key}: ${meaning} Codes: ${codes}. "" = not set.`);
};

const codeList = (labels: Record<string, string>): string =>
  Object.entries(labels)
    .map(([code, label]) => `"${code}" (${label})`)
    .join(', ');

// The reason is stored as a code; the model gets each code with the label the billing app shows.
const WRITE_OFF_REASON_CODES =
  `Patient write-off codes: ${codeList(PatientWriteOffReasons)}. ` +
  `Insurance / non-insurance write-off codes: ${codeList(NonPatientWriteOffReasons)}.`;

export const BillingClaimsBaseRowSchema = z.object({
  // --- Claim ---
  claimId: z.string().describe('Billing claim id. One row per claim; count rows for a claim count.'),
  encounterId: z.string().nullable().describe('Clinical encounter id the claim was made from (internal — joins).'),
  claimType: z.enum(CLAIM_TYPE_VALUES).describe('Claim form: professional (CMS-1500) or institutional (UB-04).'),
  serviceDate: z
    .string()
    .nullable()
    .describe('Date of service (yyyy-MM-dd) — the date the report range filters on. Null when unknown.'),
  service: z
    .string()
    .describe('Service line of the claim (e.g. "urgent-care", "occupational-medicine"). "" when none.'),
  facility: z.string().describe('Service facility (location) name. "" when none.'),
  renderingProvider: z.string().describe('Rendering provider name. "" when none.'),
  tags: z.array(z.string()).describe('User-defined claim tags. Empty when none.'),
  // --- Patient ---
  patientId: z.string().describe('Billing patient id (internal — count UNIQUE patientId for a patient count).'),
  patientName: z.string().describe('Patient name as the billing app lists it ("Last, First").'),
  patientDob: z.string().nullable().describe('Patient date of birth (yyyy-MM-dd). Null when unknown.'),
  // --- Payer ---
  payerName: z.string().describe('Primary insurance payer name. "" for a claim with no insurance payer.'),
  payerId: z.string().describe('Payer id (the clearinghouse payer id, or "OTR-…" for a custom insurer). "" when none.'),
  nonInsurancePayerName: z
    .string()
    .describe('Non-insurance payer (e.g. an employer for occupational medicine) billed on the claim. "" when none.'),
  memberId: z.string().describe('Subscriber / member id on the primary coverage. "" when none.'),
  // --- Status (each a claim status indicator set in the billing app) ---
  arStage: statusField('arStage', 'whose receivable the claim currently is.'),
  insuranceArStatus: statusField('insuranceArStatus', 'progress of the insurance receivable.'),
  insurancePaidStatus: statusField('insurancePaidStatus', 'how much of the insurance receivable is paid.'),
  adjudicationStatus: statusField('adjudicationStatus', "the payer's decision on the claim."),
  patientArStatus: statusField('patientArStatus', 'progress of the patient receivable.'),
  patientPaidStatus: statusField('patientPaidStatus', 'how much of the patient receivable is paid.'),
  nonInsuranceArStatus: statusField('nonInsuranceArStatus', 'progress of the non-insurance payer receivable.'),
  nonInsurancePaidStatus: statusField('nonInsurancePaidStatus', 'how much of the non-insurance receivable is paid.'),
  // --- Amounts (USD, as the billing app's claims list shows them) ---
  billed: z.number().describe('Total charge billed on the claim, USD.'),
  allowed: z.number().describe('Amount the payer allowed per the latest remit that reports it, USD. 0 before a remit.'),
  insurancePaid: z.number().describe('Total paid by insurance across all remits, USD.'),
  patientResp: z
    .number()
    .describe('Patient responsibility per the latest remit, USD. 0 before the claim is adjudicated.'),
  patientPaid: z.number().describe('Total the patient paid toward this claim (net of refunds), USD.'),
  writeOffsTotal: z.number().describe('Total of active (not voided) write-offs on the claim, USD.'),
  claimBalance: z
    .number()
    .describe(
      'Outstanding balance, USD: patientResp − patientPaid − writeOffsTotal once adjudicated, else billed − ' +
        'patientPaid − writeOffsTotal. Negative = overpaid.'
    ),
  adjudicated: z.boolean().describe('True once at least one remit (ERA) has been matched to the claim.'),
});

export const BILLING_CLAIMS_INTERNAL_FIELDS: readonly (keyof AdHocBillingClaimsRow)[] = ['encounterId'];

// Per-field opt-in value domain (see ENCOUNTER_DOMAIN_FIELDS for the policy): low-cardinality
// categoricals and codes only — no amounts, identifiers or names of people.
export const BILLING_CLAIMS_DOMAIN_FIELDS: readonly (keyof AdHocBillingClaimsRow)[] = [
  'service',
  'facility',
  'payerName',
  'nonInsurancePayerName',
  'arStage',
  'insuranceArStatus',
  'insurancePaidStatus',
  'adjudicationStatus',
  'patientArStatus',
  'patientPaidStatus',
  'nonInsuranceArStatus',
  'nonInsurancePaidStatus',
  'tags',
  'cptCodes',
  'icdCodes',
  'adjustmentReasonCodes',
  'writeOffReasons',
];

export const BILLING_CLAIMS_LAYERS = {
  codes: {
    label: 'Claim codes (CPT / ICD-10)',
    description: 'Procedure lines (code, modifiers, units, charge) and diagnosis codes as billed on the claim.',
    default: true,
    schema: z.object({
      cptCodes: z.array(z.string()).describe('Procedure codes (CPT / HCPCS) billed on the claim (distinct).'),
      cptLines: z
        .array(
          z.object({
            code: z.string().describe('Procedure code (CPT / HCPCS).'),
            modifiers: z.array(z.string()).describe('Modifiers on this line (e.g. "25"). Empty when none.'),
            units: z.number().describe('Billed units on this line.'),
            charge: z.number().describe('Charge billed for this line, USD.'),
          })
        )
        .describe(
          'One record per service line, in claim order — the same code can appear on several lines. Use for ' +
            'modifiers, units and per-line charges; count codes with cptCodes.'
        ),
      icdCodes: z.array(z.string()).describe('ICD-10 diagnosis codes, primary first. HIERARCHICAL — prefix-match.'),
    }),
  },
  writeOffs: {
    label: 'Write-offs',
    description: 'Amounts written off the claim — who was written off, why, when, and whether it was voided.',
    schema: z.object({
      writeOffCount: z.number().describe('Number of active (not voided) write-offs.'),
      writeOffReasons: z
        .array(z.string())
        .describe(`Distinct reason codes of the active write-offs. ${WRITE_OFF_REASON_CODES}`),
      writeOffs: z
        .array(
          z.object({
            date: z.string().nullable().describe('Write-off date (yyyy-MM-dd).'),
            amount: z.number().describe('Amount written off, USD.'),
            party: z
              .string()
              .describe('Whose balance was written off: "insurance", "patient" or "nio" (non-insurance).'),
            payer: z.string().describe('Payer written off, for an insurance write-off. "" otherwise.'),
            reason: z.string().describe(`Reason code of this write-off. ${WRITE_OFF_REASON_CODES}`),
            voided: z.boolean().describe('True when the write-off was voided (it no longer counts in writeOffsTotal).'),
          })
        )
        .describe('One record per write-off, voided ones included, oldest first. Empty when none.'),
    }),
  },
  remits: {
    label: 'Remittances (ERA)',
    description:
      'The payer remittances (ERAs) matched to the claim: what each allowed and paid, patient responsibility, and the ' +
      'adjustment (CARC) codes the payer applied — e.g. denial reasons.',
    schema: z.object({
      remitCount: z.number().describe('Number of remits matched to the claim. 0 = not adjudicated yet.'),
      lastRemitDate: z.string().nullable().describe('Date of the most recent remit (yyyy-MM-dd). Null when none.'),
      adjustmentReasonCodes: z
        .array(z.string())
        .describe(
          'Distinct CARC adjustment reason codes across all remits (e.g. "45", "97"); the group of each is in ' +
            'remitAdjustments.'
        ),
      remits: z
        .array(
          z.object({
            date: z.string().nullable().describe('Remit date (yyyy-MM-dd).'),
            allowed: z.number().nullable().describe('Amount allowed by this remit, USD. Null when not reported.'),
            paid: z.number().describe('Amount paid by this remit, USD (negative for a reversal).'),
            patientResp: z
              .number()
              .nullable()
              .describe('Patient responsibility on this remit, USD. Null when not reported.'),
          })
        )
        .describe('One record per remit, oldest first. Empty when none.'),
      // Flat rather than nested under remits[]: the prompt schema supports one level of object[].
      remitAdjustments: z
        .array(
          z.object({
            remitDate: z.string().nullable().describe('Date of the remit that applied it (yyyy-MM-dd).'),
            group: z
              .string()
              .describe(
                'Adjustment group: CO (contractual), PR (patient resp.), OA (other), PI (payer), CR (reversal).'
              ),
            code: z.string().describe('CARC reason code.'),
            amount: z.number().describe('Adjusted amount, USD.'),
          })
        )
        .describe('One record per claim adjustment (CAS) across all remits, oldest remit first. Empty when none.'),
    }),
  },
  timeline: {
    label: 'Claim timeline',
    description: 'When the claim reached key AR milestones — insurance finalized, moved to patient AR.',
    schema: z.object({
      insuranceFinalizedDate: z
        .string()
        .nullable()
        .describe('Date the insurance receivable was last set to finalized (yyyy-MM-dd). Null when never.'),
      enteredPatientArDate: z
        .string()
        .nullable()
        .describe('Date the claim last moved to patient AR (yyyy-MM-dd). Null when never.'),
    }),
  },
} as const satisfies AdHocLayerMap;

export type BillingClaimsLayerId = keyof typeof BILLING_CLAIMS_LAYERS;

export type AdHocBillingClaimsRow = z.infer<typeof BillingClaimsBaseRowSchema> &
  LayerRowFields<typeof BILLING_CLAIMS_LAYERS>;

export const AdHocBillingClaimsRowSchema = datasetRowSchema(BillingClaimsBaseRowSchema, BILLING_CLAIMS_LAYERS).describe(
  'One row per billing-app claim.'
) as unknown as z.ZodType<AdHocBillingClaimsRow>;

export const AdHocBillingClaimsInputSchema = datasetInputSchema(BILLING_CLAIMS_LAYERS);
export type AdHocBillingClaimsInput = DatasetInput<typeof BILLING_CLAIMS_LAYERS>;

export const AdHocBillingClaimsOutputSchema = z.object({
  rows: z.array(AdHocBillingClaimsRowSchema),
});

export type AdHocBillingClaimsOutput = { rows: AdHocBillingClaimsRow[] };
