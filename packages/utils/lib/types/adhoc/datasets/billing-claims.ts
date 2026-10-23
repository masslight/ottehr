import { z } from 'zod';
import {
  CLAIM_ACCIDENT_TYPE,
  CLAIM_ACCIDENT_TYPES,
  CODE_SYSTEM_CLAIM_TYPE_CODES,
} from '../../../helpers/rcm/constants';
import { ERA_CLAIM_STATUS_CODE } from '../../data/billing/billing.constants';
import { CLAIM_STATUS_FIELD_KEYS, CLAIM_STATUS_FIELDS, ClaimStatusFieldKey } from '../../data/billing/claim-status';
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

const ERA_STATUS_CODE_DESCRIPTION =
  'CLP02 claim status the payer reported on this remit: ' +
  Object.entries(ERA_CLAIM_STATUS_CODE)
    .map(([meaning, code]) => `"${code}" (${meaning})`)
    .join(', ') +
  '. "4" = denied, "22" = reversal of an earlier payment. "" when not reported.';

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
  patientId: z
    .string()
    .describe(
      'Patient id, the same for every claim of one patient (the EHR patient id when the patient came from the ' +
        'EHR). Count UNIQUE patientId for a patient count.'
    ),
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
  'placeOfService',
  'billType',
  'accidentTypes',
  'patientState',
  'primaryPlanType',
  'primarySubscriberRelationship',
  'secondaryPayerName',
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
            serviceDate: z.string().nullable().describe('Date of service of this line (yyyy-MM-dd).'),
            placeOfService: z
              .string()
              .describe('CMS place-of-service code of this line (e.g. "11", "20"). "" when none.'),
            revenueCode: z.string().describe('NUBC revenue code (institutional claims). "" when none.'),
            ndc: z.string().describe('NDC of the drug billed on this line. "" when none.'),
          })
        )
        .describe(
          'One record per service line, in claim order — the same code can appear on several lines. Use for ' +
            'modifiers, units and per-line charges; count codes with cptCodes.'
        ),
      icdCodes: z.array(z.string()).describe('ICD-10 diagnosis codes, primary first. HIERARCHICAL — prefix-match.'),
      emCode: z
        .string()
        .describe(
          'E&M (evaluation & management) code billed on the claim (e.g. "99213"), as the EHR\'s E&M code list ' +
            'defines them. "" when none.'
        ),
    }),
  },
  claimDetails: {
    label: 'Claim details (providers, facility, identifiers)',
    description:
      'Billing and rendering provider NPIs, service facility and place of service, claim control numbers, ' +
      'institutional and accident details, attachments, and patient sex / state / ZIP.',
    schema: z.object({
      billingProvider: z.string().describe('Billing provider name. "" when none.'),
      billingProviderNpi: z.string().describe('Billing provider NPI. "" when none.'),
      renderingProviderNpi: z.string().describe('Rendering provider NPI. "" when none.'),
      facilityNpi: z.string().describe('Service facility NPI. "" when none.'),
      placeOfService: z.string().describe('CMS place-of-service code of the first service line. "" when none.'),
      patientControlNumber: z.string().describe('Patient control number sent to the payer (PCN). "" when none.'),
      payerClaimControlNumber: z.string().describe('Payer\'s claim control number (ICN) from the remit. "" when none.'),
      billType: z.string().describe('UB-04 bill type (institutional claims, e.g. "0131"). "" when none.'),
      admissionDate: z.string().nullable().describe('Admission date (institutional claims, yyyy-MM-dd).'),
      dischargeDate: z.string().nullable().describe('Discharge date (institutional claims, yyyy-MM-dd).'),
      admissionType: z.string().describe('Admission type code (institutional claims). "" when none.'),
      admissionSource: z.string().describe('Point of origin code (institutional claims). "" when none.'),
      dischargeStatus: z.string().describe('Patient discharge status code (institutional claims). "" when none.'),
      accidentTypes: z
        .array(z.enum(CLAIM_ACCIDENT_TYPES as [CLAIM_ACCIDENT_TYPE, ...CLAIM_ACCIDENT_TYPE[]]))
        .describe('Accident the services relate to. Empty when not accident related.'),
      accidentState: z.string().describe('State of an auto accident. "" when none.'),
      accidentDate: z.string().nullable().describe('Accident date (yyyy-MM-dd). Null when none.'),
      attachmentCount: z.number().describe('Number of documents attached to the claim.'),
      patientSex: z
        .string()
        .describe('Patient sex as on the claim ("male", "female", "other", "unknown"). "" when none.'),
      patientState: z.string().describe('Patient state. "" when none.'),
      patientZip: z.string().describe('Patient ZIP code. "" when none.'),
    }),
  },
  coverage: {
    label: 'Insurance coverage',
    description:
      'The insurances on the claim: primary plan type and subscriber relationship, and the secondary / tertiary ' +
      'payers and member ids.',
    schema: z.object({
      coverageCount: z.number().describe('Number of insurances on the claim (0 for self-pay).'),
      primaryPlanType: z
        .string()
        .describe('Plan type code of the primary insurance (e.g. "MB", "MC", "CI"). "" when none.'),
      primarySubscriberRelationship: z
        .string()
        .describe('Patient relationship to the primary subscriber (e.g. "Self", "Spouse", "Child"). "" when none.'),
      primaryCoverageStatus: z.string().describe('Status of the primary coverage (e.g. "active"). "" when none.'),
      secondaryPayerName: z.string().describe('Secondary insurance payer. "" when none.'),
      secondaryMemberId: z.string().describe('Member id on the secondary insurance. "" when none.'),
      tertiaryPayerName: z.string().describe('Tertiary insurance payer. "" when none.'),
      tertiaryMemberId: z.string().describe('Member id on the tertiary insurance. "" when none.'),
    }),
  },
  writeOffs: {
    label: 'Write-offs',
    description: 'Amounts written off the claim — who was written off, why, when, and whether it was voided.',
    schema: z.object({
      writeOffCount: z.number().describe('Number of active (not voided) write-offs.'),
      writeOffReasons: z
        .array(z.string())
        .describe('Distinct reasons of the active write-offs, as the billing app shows them (e.g. "Small Balance").'),
      writeOffs: z
        .array(
          z.object({
            date: z.string().nullable().describe('Write-off date (yyyy-MM-dd).'),
            amount: z.number().describe('Amount written off, USD.'),
            party: z
              .string()
              .describe('Whose balance was written off: "insurance", "patient" or "nio" (non-insurance).'),
            payer: z.string().describe('Payer written off, for an insurance write-off. "" otherwise.'),
            reason: z
              .string()
              .describe(
                'Reason for this write-off, as the billing app shows it (e.g. "Small Balance", "Charity or ' +
                  'Financial Assistance"). Show it as is.'
              ),
            voided: z.boolean().describe('True when the write-off was voided (it no longer counts in writeOffsTotal).'),
          })
        )
        .describe('One record per write-off, voided ones included, oldest first. Empty when none.'),
    }),
  },
  patientPayments: {
    label: 'Patient payments',
    description:
      'Every patient payment and refund on the claim as the billing app records it — payments taken at the visit ' +
      '(mirrored from the EHR) and payments, card charges and refunds recorded in the billing app.',
    schema: z.object({
      patientPaymentCount: z.number().describe('Number of payments (not refunds), voided ones excluded.'),
      patientRefundedTotal: z.number().describe('Total refunded to the patient, USD (positive). 0 when none.'),
      lastPatientPaymentDate: z
        .string()
        .nullable()
        .describe('Date of the most recent payment (yyyy-MM-dd), voided ones excluded. Null when none.'),
      patientPayments: z
        .array(
          z.object({
            date: z.string().nullable().describe('Payment or refund date (yyyy-MM-dd).'),
            amount: z.number().describe('Amount, USD; negative for a refund.'),
            kind: z.enum(['payment', 'refund']).describe('A payment from the patient or a refund to them.'),
            method: z.string().describe('How it was paid (e.g. "card", "cash", "check"). "" when not recorded.'),
            source: z
              .enum(['ehr', 'card', 'manual', 'other'])
              .describe(
                'Where it was recorded: "ehr" = taken at the visit in the EHR, "card" = card charge in the billing ' +
                  'app, "manual" = entered by hand in the billing app.'
              ),
            voided: z.boolean().describe('True when voided; a voided payment does not count in patientPaid.'),
          })
        )
        .describe(
          'One record per payment or refund, oldest first. patientPaid is the sum of the ones not voided. ' +
            'Empty when none.'
        ),
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
            payerName: z
              .string()
              .describe(
                "Payer that sent this remit — for a secondary remit not the claim's primary payerName. Use it to " +
                  'break remits down by payer. "" when the payer could not be resolved.'
              ),
            eraStatusCode: z.string().describe(ERA_STATUS_CODE_DESCRIPTION),
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
            payerName: z
              .string()
              .describe(
                'Payer that sent the remit that applied it. Use it to break adjustments down by payer. "" when ' +
                  'the payer could not be resolved.'
              ),
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
        .describe(
          'Date the insurance receivable was last set to finalized in the billing app (yyyy-MM-dd). Recorded only ' +
            'on a status change, so null for a claim never finalized or created already finalized — to count ' +
            'claims that are finalized now, use insuranceArStatus.'
        ),
      enteredPatientArDate: z
        .string()
        .nullable()
        .describe(
          'Date the claim last moved to patient AR in the billing app (yyyy-MM-dd). Recorded only on a status ' +
            'change, so null for a claim never moved or created already in patient AR — to count claims in patient ' +
            'AR now, use arStage = "patient-ar".'
        ),
    }),
  },
  insurancePayments: {
    label: 'Insurance payments (ERA checks)',
    description: 'The insurance checks / EFTs (ERAs) that paid the claim: check number, check date, amount and payer.',
    schema: z.object({
      checkNumbers: z.array(z.string()).describe('Distinct check / EFT numbers that paid the claim.'),
      lastCheckDate: z.string().nullable().describe('Date of the most recent check (yyyy-MM-dd). Null when none.'),
      insurancePayments: z
        .array(
          z.object({
            eraId: z
              .string()
              .describe(
                'ERA id — the key of one check. Two checks can share a checkNumber (different payers, a resent ' +
                  'file) or have none.'
              ),
            checkNumber: z.string().describe('Check / EFT trace number. "" when the ERA carries none.'),
            checkDate: z.string().nullable().describe('Check / EFT date (yyyy-MM-dd). Null when the ERA carries none.'),
            remitDate: z.string().nullable().describe('Date the ERA was received (yyyy-MM-dd).'),
            checkAmount: z
              .number()
              .describe("Amount of the whole check, USD — NOT this claim's share (that is remits[].paid)."),
            payerName: z.string().describe('Payer that issued the check. "" when it could not be resolved.'),
            eraSource: z
              .enum(['manual', 'x12-import', 'clearing-house'])
              .describe(
                'How the ERA got into the billing app: "manual" = keyed in by a biller, "x12-import" = an 835 file ' +
                  'uploaded by a biller, "clearing-house" = received electronically.'
              ),
            enteredBy: z
              .string()
              .describe(
                'Name of the biller who keyed in a manual ERA. "" for x12-import and clearing-house ERAs (the ' +
                  'billing app does not record who imported a file) or when unknown.'
              ),
          })
        )
        .describe(
          'One record per ERA that paid the claim, oldest first. One check can pay several claims, so the same ' +
            'check appears on each of them — dedupe by eraId (not checkNumber) when listing or summing checks. Empty ' +
            'when none.'
        ),
    }),
  },
  history: {
    label: 'Claim history',
    description:
      "The claim's change history in the billing app: every status change, submissions to the clearinghouse, " +
      'clearinghouse / payer acknowledgments, notes, and user vs automated activity.',
    schema: z.object({
      statusChanges: z
        .array(
          z.object({
            date: z.string().nullable().describe('When the status changed (yyyy-MM-dd).'),
            field: z
              .enum(CLAIM_STATUS_FIELD_KEYS)
              .describe('Which status changed — the same names as the status columns (arStage, adjudicationStatus…).'),
            from: z.string().describe('Status code before the change; "" = not set (e.g. at creation).'),
            to: z.string().describe('Status code after the change; "" = cleared.'),
            by: z.enum(['user', 'system']).describe('A billing user, or automation (rules engine, ERA posting).'),
            byName: z.string().describe('Name of the user (or automation) who changed it. "" when unknown.'),
          })
        )
        .describe(
          'One record per status change, oldest first, including the statuses the claim was created with. Use it ' +
            'for time spent in a stage, or how often a claim was denied / resubmitted.'
        ),
      firstSubmittedDate: z
        .string()
        .nullable()
        .describe('When the claim was first sent to the clearinghouse (yyyy-MM-dd). Null when never.'),
      lastSubmittedDate: z.string().nullable().describe('When the claim was last sent (yyyy-MM-dd). Null when never.'),
      submissionCount: z.number().describe('Number of times the claim was sent to the clearinghouse.'),
      submissions: z
        .array(
          z.object({
            date: z.string().nullable().describe('When the claim was sent (yyyy-MM-dd).'),
            by: z.enum(['user', 'system']).describe('Submitted by a billing user, or by automation (rules engine).'),
            byName: z.string().describe('Name of the user (or automation) who submitted it. "" when unknown.'),
          })
        )
        .describe('One record per submission to the clearinghouse, oldest first. Empty when never submitted.'),
      firstAcknowledgedDate: z
        .string()
        .nullable()
        .describe('First clearinghouse / payer acknowledgment (yyyy-MM-dd). Null when none.'),
      acknowledgments: z
        .array(
          z.object({
            date: z.string().nullable().describe('When it was acknowledged (yyyy-MM-dd).'),
            entityKind: z.enum(['clearinghouse', 'payer']).describe('Who acknowledged the claim.'),
            entityName: z.string().describe('Name of the clearinghouse or payer.'),
            message: z.string().describe('Acknowledgment message as reported.'),
          })
        )
        .describe('One record per acknowledgment, oldest first. Empty when none.'),
      noteCount: z.number().describe('Number of notes billers added to the claim.'),
      lastNoteDate: z.string().nullable().describe('Date of the most recent note (yyyy-MM-dd). Null when none.'),
      lastActivityDate: z
        .string()
        .nullable()
        .describe('Date of the most recent change of any kind (yyyy-MM-dd). Null when no history is recorded.'),
      userActionCount: z.number().describe('Number of history entries made by billing users.'),
      systemActionCount: z.number().describe('Number of history entries made by automation.'),
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
