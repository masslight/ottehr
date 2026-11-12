import { Patient } from 'fhir/r4b';
import z from 'zod';
import { DOSE_BASES } from '../../helpers/medications/plain-dose';
import { PRESCRIPTION_ROUTES } from '../../helpers/medications/prescription-suggestions';
import { PrescribedMedicationDTO, PrescribedMedicationOrderDTO } from './chart-data/chart-data.types';
import type { CompoundOrder, PrescriptionVitals } from './order-prescription.types';

export const GetErxOrdersInputSchema = z.object({
  encounterIds: z.array(z.string()),
});

export type GetErxOrdersInput = z.infer<typeof GetErxOrdersInputSchema>;

export interface GetErxOrdersResponse {
  orders: PrescribedMedicationDTO[];
}

// The renewal response's denial and pending reasons, as the eRx service's renewal-response endpoint takes them
export const RENEWAL_DENIAL_REASONS = [
  'Patient unknown to the provider',
  'Patient never under provider care',
  'Patient no longer under provider care',
  'Patient has requested refill too soon',
  'Medication never prescribed for the patient',
  'Patient should contact provider first',
  'Fill/Refill not appropriate',
  'Patient needs appointment',
  'Prescriber not associated with this practice or location',
  'Request was or will be responded to by other means',
  'Medication denied at patient request',
  'Patient had allergy to requested medication',
  'Medication has been discontinued',
] as const;

export const RENEWAL_PENDING_REASONS = [
  'Patient has an appointment scheduled',
  'Patient has labs/tests pending',
  'Provider is unavailable and no one is available to make a decision',
  'Patient is currently undergoing acute care and a decision is pending resolution',
  'Provider wishes to delay for reasons not otherwise indicated',
] as const;

/** What the renewal-response endpoint takes: an approval (the number of fills, 1–99, what the provider changed, which
 * is either an NDC or a compound, never both, the blanks the new prescription keeps for a re-fill and the patient's
 * vitals, as order-prescription takes them), a denial or a pending answer. */
export type RenewalResponseInput = { taskId: string } & (
  | {
      decision: 'approve';
      numberOfRefills: number;
      note?: string;
      changes?: {
        medicationDescription?: string;
        ndc?: string;
        compound?: CompoundOrder;
        quantityValue?: number;
        quantityUnit?: string;
        daysSupply?: number;
        substitutionAllowed?: boolean;
        patientInstructions?: string;
        noteToPharmacy?: string;
      };
      metadata?: PrescriptionOrderMetadata;
      vitals?: PrescriptionVitals;
    }
  | { decision: 'deny'; reason: (typeof RENEWAL_DENIAL_REASONS)[number]; denialReason?: string }
  | { decision: 'pending'; reason: (typeof RENEWAL_PENDING_REASONS)[number]; note?: string }
);

// The change response's denial reasons, as the eRx service's change-response endpoint takes them
export const CHANGE_DENIAL_REASONS = [
  'Patient unknown to the provider',
  'Patient never under provider care',
  'Patient no longer under provider care',
  'Medication never prescribed for the patient',
  'Patient should contact provider first',
  'Change not appropriate',
  'Patient needs appointment',
  'Prescriber not associated with this practice or location',
  'Request was or will be responded to by other means',
  'No information available',
  'Medication denied at patient request',
  'Prescription not found',
] as const;

/** What a pharmacy asks to change (NCPDP MessageRequestCode), in plain words. */
export const CHANGE_REQUEST_KINDS: Record<string, string> = {
  G: 'Generic',
  T: 'Therapeutic',
  OS: 'Out of stock',
  S: 'Script clarification',
  D: 'Drug-use alert',
  P: 'Prior authorization',
};

/** What the change-response endpoint takes: an approval of one of the pharmacy's suggestions (by its position) with
 * what the provider changed over it (the eRx service picks Approved or ApprovedWithChanges), a denial or a pending
 * answer. A prior authorization request (P) is approved with the prior authorization, never with changes. */
export type ChangeResponseInput = { taskId: string } & (
  | {
      decision: 'approve';
      requestedMedicationIndex?: number;
      note?: string;
      changes?: Extract<RenewalResponseInput, { decision: 'approve' }>['changes'] & { numberOfRefills?: number };
      metadata?: PrescriptionOrderMetadata;
      vitals?: PrescriptionVitals;
      // Requested from the eRx service (Jon item 4): the prior authorization a P request is approved with, its number
      // (NCPDP PriorAuthorization, up to 35 characters) and status (PriorAuthorizationStatus A, approved)
      priorAuthorization?: { number: string; status: 'approved' };
    }
  | { decision: 'deny'; reason: (typeof CHANGE_DENIAL_REASONS)[number]; denialReason?: string }
  | { decision: 'pending'; reason: (typeof RENEWAL_PENDING_REASONS)[number]; note?: string }
);

export interface RenewalResponseOutput {
  taskId: string;
  messageId: string;
  responseType: string;
  medicationRequestId?: string;
  status: { code?: string; description?: string };
}

/** A pharmacy's refill request, only as the pharmacy sent it: a field it left out is absent (S.207). */
export interface ErxPharmacyRefillRequest {
  /** The eRx service's renewal Task, which the answer goes to */
  renewalTaskId: string;
  pharmacy: { name?: string; ncpdpId?: string; npi?: string; phone?: string };
  medication: {
    description?: string;
    ndc?: string;
    /** A compound in place of a product, as a sent prescription's is read: each ingredient as the amount that goes in */
    compound?: PrescribedMedicationOrderDTO['compound'];
    quantityValue?: number;
    quantityUnit?: string;
    daysSupply?: number;
    lastFillDate?: string;
    writtenDate?: string;
    substitutionAllowed?: boolean;
    sig?: string;
    noteToPharmacy?: string;
    requestedRefills?: number;
    /** Refills written, in a change request's suggestion */
    numberOfRefills?: number;
  };
  /** When the first request came */
  received?: string;
  /** When the newest request came, when the pharmacy asked again */
  askedAgain?: string;
  withdrawn: boolean;
  /** The eRx service closed it otherwise: answered or expired */
  closed: boolean;
}

/** A pharmacy's change request, only as the pharmacy sent it (S.207). */
export interface ErxPharmacyChangeRequest extends Omit<ErxPharmacyRefillRequest, 'renewalTaskId' | 'medication'> {
  /** The eRx service's change Task, which the answer goes to */
  changeTaskId: string;
  /** What it asks to change, a CHANGE_REQUEST_KINDS code, and the sub-codes it added */
  code: string;
  subCodes: string[];
  /** The pharmacy's own words */
  reason?: string;
  /** The medications it suggests, in its order: an approval names one by its position. None for S and P. */
  suggestions: ErxPharmacyRefillRequest['medication'][];
}

export const GetErxRequestInputSchema = z.object({ taskId: z.string().uuid() });

export type GetErxRequestInput = z.infer<typeof GetErxRequestInputSchema>;

const PrescriptionStepSchema = z.object({ dose: z.string(), frequency: z.string(), durationDays: z.string() });

/** The order form's blanks behind a prescription's directions, sent as the order's `metadata`: the eRx service keeps
 * it on the MedicationRequest (never sent to the pharmacy) so a later re-fill starts from the blanks, not only the sig.
 * Sent only while the directions are what the blanks wrote; read back as untrusted, so anything not of this shape
 * counts as none. */
export const PrescriptionOrderMetadataSchema = z.object({
  version: z.literal(1),
  /** The product's structured details the blanks were read with: they give the dose unit and the dispense. */
  product: z
    .object({
      rxcui: z.string().optional(),
      doseForm: z.string().optional(),
      ingredients: z
        .array(
          z.object({ name: z.string(), amount: z.number(), unit: z.string(), per: z.number(), perUnit: z.string() })
        )
        .optional(),
    })
    .optional(),
  route: z.enum(PRESCRIPTION_ROUTES).or(z.literal('')),
  dose: z.string(),
  frequency: z.string(),
  durationDays: z.string(),
  /** The "then" steps of a taper. */
  steps: z.array(PrescriptionStepSchema).optional(),
  instructions: z.string().optional(),
  additionalInstructions: z.string().optional(),
  /** The dose calculator's settings, while the dose was the one it wrote. */
  dosing: z
    .object({
      rate: z.number(),
      basis: z.enum(DOSE_BASES),
      maxPerDoseMg: z.number().optional(),
      maxPerDayMg: z.number().optional(),
    })
    .optional(),
  /** The ingredient of a combination product the calculator dosed by. */
  doseBy: z.string().optional(),
});

export type PrescriptionOrderMetadata = z.infer<typeof PrescriptionOrderMetadataSchema>;

/** A refill or change request task's request: the pharmacy's, or a patient's that staff wrote down, with the prescription it is
 * about and its patient. */
export interface GetErxRequestResponse {
  taskId: string;
  kind: 'refill' | 'change';
  pharmacyRequest?: ErxPharmacyRefillRequest;
  pharmacyChangeRequest?: ErxPharmacyChangeRequest;
  /** What staff wrote down: the task's title and details */
  patientRequest?: { title?: string; note?: string; takenBy?: string; taken?: string };
  prescription: PrescribedMedicationDTO;
  /** The blanks the prescription's directions were written from; none when they were typed, or not stored */
  metadata?: PrescriptionOrderMetadata;
  prescriberName?: string;
  patient: Patient;
}

export const CompleteErxTaskInputSchema = z.object({ taskId: z.string().uuid() });

export type CompleteErxTaskInput = z.infer<typeof CompleteErxTaskInputSchema>;
