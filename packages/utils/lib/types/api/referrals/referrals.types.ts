import { z } from 'zod';
import { ActionLogStatus } from '../action-logs.types';
import { PacketDocumentKind, PacketDocumentKindSchema } from '../document-packet.types';
import { RoleType } from '../user.types';

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

export const REFERRAL_OPEN_STATUSES: ReferralStatus[] = ['not-sent', 'sent', 'given-to-patient', 'response-received'];
export const isReferralOpen = (status: ReferralStatus): boolean => REFERRAL_OPEN_STATUSES.includes(status);

export const REFERRAL_EDITABLE_STATUSES: ReferralStatus[] = ['not-sent', 'sent', 'given-to-patient'];
export const isReferralEditable = (status: ReferralStatus): boolean => REFERRAL_EDITABLE_STATUSES.includes(status);

export interface ReferralActor {
  id?: string;
  name: string;
}

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

export const REFERRAL_DEFAULTS = {
  responseRequested: false,
  urgency: 'routine' as ReferralUrgency,
  whatIsAsked: 'evaluate-and-treat' as ReferralAsk,
  whoSchedules: 'patient' as ReferralScheduler,
  includeDocuments: ['progress-note', 'lab-results', 'radiology-results'] as PacketDocumentKind[],
};
export const REFERRAL_OVERDUE_DAYS: Record<ReferralUrgency, number> = { routine: 14, urgent: 7, asap: 2 };
export const REFERRAL_RESPONSE_REQUEST_TEXT =
  'Please confirm patient appointment and return results / consultation notes to the referring provider at the fax number above.';

export const REFERRAL_ROLES: RoleType[] = [
  RoleType.Administrator,
  RoleType.Manager,
  RoleType.Provider,
  RoleType.Clinician,
  RoleType.Staff,
  RoleType.CustomerSupport,
];

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

export const REFERRAL_MAX_EARLIER_DOCUMENTS = 50;

const trimmedRequired = z.string().trim().min(1);

export const SaveReferralInputSchema = z.object({
  referralId: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  specialty: trimmedRequired,
  recipientContactId: z.string().uuid().optional(),
  recipientFax: z.string().trim().optional(),
  reason: trimmedRequired,
  urgency: ReferralUrgencySchema,
  whatIsAsked: ReferralAskSchema,
  whoSchedules: ReferralSchedulerSchema,
  responseRequested: z.boolean(),
  includeDocuments: z.array(PacketDocumentKindSchema),
  earlierDocumentIds: z
    .array(z.string().uuid())
    .max(REFERRAL_MAX_EARLIER_DOCUMENTS)
    .transform((ids) => [...new Set(ids)])
    .optional(),
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
  name: string;
  organizationName?: string;
  personName?: string;
  fax?: string;
  phone?: string;
  address?: string;
}

export interface ReferralEarlierDocument {
  id: string;
  title: string;
  date?: string;
  visitDate?: string;
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
  includeDocuments: PacketDocumentKind[];
  earlierDocuments: ReferralEarlierDocument[];
  notesToRecipient?: string;
  referringProvider: { id?: string; name: string };
  status: ReferralStatus;
  createdAt: string;
  sentAt?: string;
  givenToPatientAt?: string;
  givenToPatientBy?: ReferralActor;
  closedAt?: string;
  closedBy?: ReferralActor;
  closeReason?: ReferralCloseReason;
  outcome?: string;
  taskId?: string;
  taskStatus?: string;
  overdueAt?: string;
  formDocumentReferenceId?: string;
  responseDocumentReferenceIds: string[];
  lastFax?: { attemptId: string; status: ActionLogStatus; sentAt?: string };
}

export interface ListReferralsOutput {
  referrals: ReferralDTO[];
}
export interface SaveReferralOutput {
  referral: ReferralDTO;
}
export type UpdateReferralStatusOutput = SaveReferralOutput;

export const referralTaskTitle = (specialty: string, recipientName?: string): string =>
  `Referral: ${specialty}${recipientName ? `, ${recipientName}` : ''}`;
export const referralReviewTaskTitle = (specialty: string, recipientName?: string): string =>
  `Review response: ${specialty}${recipientName ? `, ${recipientName}` : ''} referral`;
