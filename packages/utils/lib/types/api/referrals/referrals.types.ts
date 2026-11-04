import { z } from 'zod';
import { ActionLogStatus } from '../action-logs.types';
import { FaxDocumentKind, FaxDocumentKindSchema } from '../fax.types';
import { RoleType } from '../user.types';

/**
 * Outbound referral contract.
 *
 * A referral is a request from a provider at this practice for a clinician or facility outside the practice
 * to see the patient. It belongs to a patient, usually to a visit, and has its own status. It is stored as a
 * ServiceRequest (see `utils/lib/fhir/referral.ts`); when a response is requested it also has a Task in the
 * Referrals category, which carries the owner and the worklist.
 */

export const REFERRAL_STATUSES = [
  'not-sent',
  'sent',
  'given-to-patient',
  'response-received',
  'closed',
  'cancelled',
] as const;
export const ReferralStatusSchema = z.enum(REFERRAL_STATUSES);
export type ReferralStatus = z.infer<typeof ReferralStatusSchema>;

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  'not-sent': 'Not sent',
  sent: 'Sent',
  'given-to-patient': 'Given to patient',
  'response-received': 'Response received',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

/** Statuses still waiting on something; everything else is finished. */
export const REFERRAL_OPEN_STATUSES: ReferralStatus[] = ['not-sent', 'sent', 'given-to-patient', 'response-received'];
export const isReferralOpen = (status: ReferralStatus): boolean => REFERRAL_OPEN_STATUSES.includes(status);

/** Values double as FHIR `ServiceRequest.priority` codes. */
export const REFERRAL_URGENCIES = ['routine', 'urgent', 'asap'] as const;
export const ReferralUrgencySchema = z.enum(REFERRAL_URGENCIES);
export type ReferralUrgency = z.infer<typeof ReferralUrgencySchema>;
export const REFERRAL_URGENCY_LABELS: Record<ReferralUrgency, string> = {
  routine: 'Routine',
  urgent: 'Urgent',
  asap: 'ASAP',
};

export const REFERRAL_ASKS = ['advise', 'evaluate-and-treat', 'procedure', 'take-over-care'] as const;
export const ReferralAskSchema = z.enum(REFERRAL_ASKS);
export type ReferralAsk = z.infer<typeof ReferralAskSchema>;
export const REFERRAL_ASK_LABELS: Record<ReferralAsk, string> = {
  advise: 'Advise only',
  'evaluate-and-treat': 'Evaluate and treat',
  procedure: 'Perform a procedure',
  'take-over-care': 'Take over care',
};

export const REFERRAL_SCHEDULERS = ['patient', 'recipient', 'practice'] as const;
export const ReferralSchedulerSchema = z.enum(REFERRAL_SCHEDULERS);
export type ReferralScheduler = z.infer<typeof ReferralSchedulerSchema>;
export const REFERRAL_SCHEDULER_LABELS: Record<ReferralScheduler, string> = {
  patient: 'Patient',
  recipient: 'Recipient',
  practice: 'This practice',
};

export const REFERRAL_CLOSE_REASONS = [
  'reviewed',
  'patient-seen',
  'patient-declined',
  'no-show',
  'cancelled',
  'sent-elsewhere',
] as const;
export const ReferralCloseReasonSchema = z.enum(REFERRAL_CLOSE_REASONS);
export type ReferralCloseReason = z.infer<typeof ReferralCloseReasonSchema>;
export const REFERRAL_CLOSE_REASON_LABELS: Record<ReferralCloseReason, string> = {
  reviewed: 'Response reviewed',
  'patient-seen': 'Patient seen (confirmed by phone)',
  'patient-declined': 'Patient declined',
  'no-show': 'No-show',
  cancelled: 'Cancelled',
  'sent-elsewhere': 'Sent elsewhere',
};

/**
 * First-build fixed defaults (requirements item 19). Not practice settings yet.
 */
export const REFERRAL_DEFAULTS = {
  responseRequested: false,
  urgency: 'routine' as ReferralUrgency,
  whatIsAsked: 'evaluate-and-treat' as ReferralAsk,
  whoSchedules: 'patient' as ReferralScheduler,
  includeDocuments: ['progress-note', 'lab-results', 'radiology-results'] as FaxDocumentKind[],
};
/** Days without a response before a referral task is flagged overdue, by urgency. */
export const REFERRAL_OVERDUE_DAYS: Record<ReferralUrgency, number> = { routine: 14, urgent: 7, asap: 2 };
/** The response-request line on the referral form (the sentence from OTR-3551). */
export const REFERRAL_RESPONSE_REQUEST_TEXT =
  'Please confirm patient appointment and return results / consultation notes to the referring provider at the fax number above.';

/** Roles that may create, send, close and list referrals. */
export const REFERRAL_ROLES: RoleType[] = [
  RoleType.Administrator,
  RoleType.Manager,
  RoleType.Provider,
  RoleType.Clinician,
  RoleType.Staff,
  RoleType.CustomerSupport,
];

/**
 * Task constants for the Referrals category, in the shape of FAX_TASK / RADIOLOGY_TASK in
 * `utils/lib/types/data/tasks/types.ts`. One category covers both the "waiting for a response" task created
 * with the referral and the "review the response" task created when a response is filed.
 */
export const REFERRAL_TASK = {
  category: 'referral',
  system: 'referral-task',
  code: {
    awaitResponse: 'await-referral-response',
    reviewResponse: 'review-referral-response',
  },
  input: {
    referralId: 'referral-id',
    patient: 'patient',
    specialty: 'specialty',
    recipientName: 'recipient-name',
    urgency: 'urgency',
    responseDocumentReferenceId: 'response-document-reference-id',
  },
} as const;

// ---- zambda inputs and outputs ----

const trimmedRequired = z.string().trim().min(1);

export const SaveReferralInputSchema = z.object({
  /** Present when editing an existing referral. */
  referralId: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  /** Omitted when the referral is created from the patient record without a visit. Cannot change on edit. */
  encounterId: z.string().uuid().optional(),
  specialty: trimmedRequired,
  /** Address-book Organization id. Omitted when the patient will choose the specialist. */
  recipientContactId: z.string().uuid().optional(),
  /** The form's Fax field (copied from the contact or typed); saved on the referral only, the directory contact is not changed. */
  recipientFax: z.string().trim().optional(),
  reason: trimmedRequired,
  urgency: ReferralUrgencySchema,
  whatIsAsked: ReferralAskSchema,
  whoSchedules: ReferralSchedulerSchema,
  responseRequested: z.boolean(),
  includeDocuments: z.array(FaxDocumentKindSchema),
  notesToRecipient: z.string().trim().optional(),
});
export type SaveReferralInput = z.infer<typeof SaveReferralInputSchema>;

export const ListReferralsInputSchema = z
  .object({
    patientId: z.string().uuid().optional(),
    encounterId: z.string().uuid().optional(),
  })
  .refine((value) => !!value.patientId || !!value.encounterId, 'patientId or encounterId is required');
export type ListReferralsInput = z.infer<typeof ListReferralsInputSchema>;

export const UpdateReferralStatusInputSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('close'),
    referralId: z.string().uuid(),
    reason: ReferralCloseReasonSchema,
    outcome: z.string().trim().max(500).optional(),
  }),
  z.object({ action: z.literal('cancel'), referralId: z.string().uuid() }),
  /** Staff handed the printed form to the patient (no recipient, or recipient without a fax). */
  z.object({ action: z.literal('given-to-patient'), referralId: z.string().uuid() }),
]);
export type UpdateReferralStatusInput = z.infer<typeof UpdateReferralStatusInputSchema>;

export const GetReferralPdfInputSchema = z.object({ referralId: z.string().uuid() });
export type GetReferralPdfInput = z.infer<typeof GetReferralPdfInputSchema>;
export interface GetReferralPdfOutput {
  presignedURL: string;
  documentReferenceId: string;
}

export interface ReferralRecipient {
  contactId: string;
  /** Organization, or the person when there is no organization (addressBookContactLabel). */
  name: string;
  organizationName?: string;
  personName?: string;
  /** The number saved on the referral when there is one, else the contact's current number. */
  fax?: string;
  phone?: string;
  /** One line, as the discharge summary and form print it. */
  address?: string;
}

export interface ReferralDTO {
  id: string;
  patientId: string;
  encounterId?: string;
  appointmentId?: string;
  specialty: string;
  recipient?: ReferralRecipient;
  reason: string;
  urgency: ReferralUrgency;
  whatIsAsked: ReferralAsk;
  whoSchedules: ReferralScheduler;
  responseRequested: boolean;
  includeDocuments: FaxDocumentKind[];
  notesToRecipient?: string;
  referringProvider: { id?: string; name: string };
  status: ReferralStatus;
  /** ISO timestamps. */
  createdAt: string;
  sentAt?: string;
  givenToPatientAt?: string;
  closedAt?: string;
  closeReason?: ReferralCloseReason;
  outcome?: string;
  /** The Referrals-category Task, when a response was requested or a response is being reviewed. */
  taskId?: string;
  taskStatus?: string;
  /** When the task is flagged overdue (ISO); set from the urgency when the referral is sent. */
  overdueAt?: string;
  formDocumentReferenceId?: string;
  responseDocumentReferenceIds: string[];
  /** The most recent outbound fax attempt for this referral, as the Fax Logs show it. */
  lastFax?: { attemptId: string; status: ActionLogStatus; sentAt?: string };
}

export interface ListReferralsOutput {
  referrals: ReferralDTO[];
}
export interface SaveReferralOutput {
  referral: ReferralDTO;
}
export type UpdateReferralStatusOutput = SaveReferralOutput;

/** Title for the Referrals-category task and the worklist row. */
export const referralTaskTitle = (specialty: string, recipientName?: string): string =>
  `Referral: ${specialty}${recipientName ? `, ${recipientName}` : ''}`;
export const referralReviewTaskTitle = (specialty: string, recipientName?: string): string =>
  `Review response: ${specialty}${recipientName ? `, ${recipientName}` : ''} referral`;
