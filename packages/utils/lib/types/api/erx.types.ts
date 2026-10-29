import { Patient } from 'fhir/r4b';
import z from 'zod';
import { PrescribedMedicationDTO } from './chart-data/chart-data.types';

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

/** What the renewal-response endpoint takes: an approval (the number of fills, 1–99, and what the provider changed),
 * a denial or a pending answer. */
export type RenewalResponseInput = { taskId: string } & (
  | {
      decision: 'approve';
      numberOfRefills: number;
      note?: string;
      changes?: {
        medicationDescription?: string;
        ndc?: string;
        quantityValue?: number;
        quantityUnit?: string;
        daysSupply?: number;
        substitutionAllowed?: boolean;
        patientInstructions?: string;
        noteToPharmacy?: string;
      };
    }
  | { decision: 'deny'; reason: (typeof RENEWAL_DENIAL_REASONS)[number]; denialReason?: string }
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
    quantityValue?: number;
    quantityUnit?: string;
    daysSupply?: number;
    lastFillDate?: string;
    writtenDate?: string;
    substitutionAllowed?: boolean;
    sig?: string;
    noteToPharmacy?: string;
    requestedRefills?: number;
  };
  /** When the first request came */
  received?: string;
  /** When the newest request came, when the pharmacy asked again */
  askedAgain?: string;
  withdrawn: boolean;
  /** The eRx service closed it otherwise: answered or expired */
  closed: boolean;
}

export const GetErxRequestInputSchema = z.object({ taskId: z.string().uuid() });

export type GetErxRequestInput = z.infer<typeof GetErxRequestInputSchema>;

/** A refill request task's request: the pharmacy's, or a patient's that staff wrote down, with the prescription it is
 * about and its patient. */
export interface GetErxRequestResponse {
  taskId: string;
  pharmacyRequest?: ErxPharmacyRefillRequest;
  patientRequest?: { note?: string; takenBy?: string; taken?: string };
  prescription: PrescribedMedicationDTO;
  prescriberName?: string;
  patient: Patient;
}

export const CompleteErxTaskInputSchema = z.object({ taskId: z.string().uuid() });

export type CompleteErxTaskInput = z.infer<typeof CompleteErxTaskInputSchema>;
