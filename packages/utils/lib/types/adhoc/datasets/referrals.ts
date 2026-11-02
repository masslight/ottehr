// Referrals dataset (one row per referral created in range). Zod is the single source of truth: TS types,
// response validation, prompt schema, UI checkboxes, and endpoint input flags all derive from the
// objects below.
import { z } from 'zod';
import {
  REFERRAL_ASKS,
  REFERRAL_CLOSE_REASONS,
  REFERRAL_SCHEDULERS,
  REFERRAL_STATUSES,
  REFERRAL_URGENCIES,
} from '../../api/referrals/referrals.types';
import { AdHocLayerMap, DatasetInput, datasetInputSchema, datasetRowSchema, LayerRowFields } from './dataset';

export const ReferralBaseRowSchema = z.object({
  // --- Referral ---
  referralId: z.string().describe('Referral id.'),
  patientId: z.string().describe('Patient id.'),
  encounterId: z
    .string()
    .nullable()
    .describe('Visit (encounter) id. Null for a referral made from the patient record.'),
  appointmentId: z.string().nullable().describe('Appointment id of the visit. Null when there is no visit.'),
  locationId: z.string().nullable().describe('Location id of the visit. Null when there is no visit.'),
  locationName: z.string().describe('Location name of the visit. "" when there is no visit.'),
  specialty: z.string().describe('Specialty referred to, as the provider picked it.'),
  recipientContactId: z
    .string()
    .nullable()
    .describe('Address-book contact id of the recipient. Null when the patient chooses the specialist.'),
  recipientName: z.string().describe('Recipient (specialist / practice) name. "" when the patient chooses.'),
  referringProviderId: z.string().nullable().describe('Referring provider (practitioner) id.'),
  referringProviderName: z.string().describe('Referring provider name.'),
  urgency: z.enum(REFERRAL_URGENCIES).describe('routine / urgent / asap.'),
  whatIsAsked: z
    .enum(REFERRAL_ASKS)
    .describe('What the specialist is asked to do: advise, evaluate-and-treat, procedure, take-over-care.'),
  whoSchedules: z.enum(REFERRAL_SCHEDULERS).describe('Who books the specialist visit: patient, recipient, practice.'),
  responseRequested: z.boolean().describe('The recipient was asked to send a response back.'),
  status: z
    .enum(REFERRAL_STATUSES)
    .describe(
      'not-sent / sent / given-to-patient / response-received / closed / cancelled. Open = not closed and not cancelled.'
    ),
  createdAt: z.string().describe('Full ISO instant the referral was created.'),
  sentAt: z.string().nullable().describe('Full ISO instant the fax was delivered or the form given to the patient.'),
  responseReceivedAt: z
    .string()
    .nullable()
    .describe('Full ISO instant the first response document was filed. Null when none.'),
  closedAt: z.string().nullable().describe('Full ISO instant the referral was closed. Null while open.'),
  closeReason: z
    .enum(REFERRAL_CLOSE_REASONS)
    .nullable()
    .describe('Why it was closed (reviewed, patient-seen, patient-declined, no-show, cancelled, sent-elsewhere).'),
  daysSentToResponse: z
    .number()
    .nullable()
    .describe('Days from sentAt to responseReceivedAt. Null unless both are known.'),
});

/** Internal fields not to show the model (none; ids are useful for joins). */
export const REFERRAL_INTERNAL_FIELDS: readonly (keyof AdHocReferralRow)[] = [];

/** Fields the planner treats as domain (grouping) fields. */
export const REFERRAL_DOMAIN_FIELDS: readonly (keyof AdHocReferralRow)[] = [
  'specialty',
  'recipientName',
  'referringProviderName',
  'locationName',
  'urgency',
  'whatIsAsked',
  'whoSchedules',
  'status',
  'closeReason',
];

export const REFERRAL_LAYERS = {
  task: {
    label: 'Follow-up task',
    description: 'The Referrals-category task tracking the response: its status, assignee and overdue date.',
    schema: z.object({
      taskId: z.string().nullable().describe('Task id. Null when no response was requested (no task).'),
      taskStatus: z
        .string()
        .nullable()
        .describe('FHIR task status (ready, in-progress, completed, …). Null when no task.'),
      overdueAt: z
        .string()
        .nullable()
        .describe('Full ISO instant after which the task counts as overdue. Null when no task.'),
      assignee: z.string().describe('Task assignee (owner) name. "" when unassigned or no task.'),
    }),
  },
} as const satisfies AdHocLayerMap;

export type ReferralLayerId = keyof typeof REFERRAL_LAYERS;

export type AdHocReferralRow = z.infer<typeof ReferralBaseRowSchema> & LayerRowFields<typeof REFERRAL_LAYERS>;
export const AdHocReferralRowSchema = datasetRowSchema(ReferralBaseRowSchema, REFERRAL_LAYERS).describe(
  'One row per referral created in range.'
) as unknown as z.ZodType<AdHocReferralRow>;

export const AdHocReferralsInputSchema = datasetInputSchema(REFERRAL_LAYERS);
export type AdHocReferralsInput = DatasetInput<typeof REFERRAL_LAYERS>;

export const AdHocReferralsOutputSchema = z.object({
  referrals: z.array(AdHocReferralRowSchema),
});
export type AdHocReferralsOutput = { referrals: AdHocReferralRow[] };
