import { Task } from 'fhir/r4b';
import { z } from 'zod';
import { Secrets } from '../../secrets';
import { RoleType } from './user.types';

export const ACTION_LOGS_PAGE_SIZE = 10;
export const ACTION_LOGS_DISPLAY_WINDOW_DAYS = 30;
export const GLOBAL_ACTION_LOG_VIEWER_ROLES = [
  RoleType.Administrator,
  RoleType.Manager,
  RoleType.CustomerSupport,
  RoleType.Staff,
];
export const PATIENT_ACTION_LOG_VIEWER_ROLES = [...GLOBAL_ACTION_LOG_VIEWER_ROLES, RoleType.Provider];

export const ActionLogChannelSchema = z.enum(['fax', 'email']);
export type ActionLogChannel = z.infer<typeof ActionLogChannelSchema>;

export const GetActionLogsInputSchema = z.object({
  channel: ActionLogChannelSchema,
  patientId: z.string().uuid().optional(),
  patientName: z.string().trim().optional(),
  visitId: z.string().uuid().optional(),
  // Start of the searched calendar day in the searcher's own timezone (offset required), e.g.
  // "2026-07-21T00:00:00.000-04:00" — lets the server match against the same local day the
  // frontend displays, instead of assuming the day boundary lines up with UTC.
  visitDate: z.string().datetime({ offset: true }).optional(),
  pageIndex: z.number().int().nonnegative().default(0),
});

export type GetActionLogsInput = z.input<typeof GetActionLogsInputSchema>;
export type GetActionLogsInputParsed = z.infer<typeof GetActionLogsInputSchema>;

export const GetActionLogsInputValidatedSchema = GetActionLogsInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
});
export type GetActionLogsInputValidated = z.infer<typeof GetActionLogsInputValidatedSchema>;

export type ActionLogStatus = 'sent' | 'failed' | 'pending';

export interface ActionLogEntry {
  attemptId: string;
  channel: ActionLogChannel;
  status: ActionLogStatus;
  recipientAddress: string;
  recipientName?: string;
  patientName?: string;
  appointmentId?: string;
  visitDate?: string;
  documentReferenceId?: string;
  canRetry: boolean;
}

export interface GetActionLogsOutput {
  logs: ActionLogEntry[];
  totalCount: number;
}

export const RetryActionLogInputSchema = z.object({
  attemptId: z.string().uuid(),
});
export type RetryActionLogInput = z.infer<typeof RetryActionLogInputSchema>;
export const RetryActionLogInputValidatedSchema = RetryActionLogInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
});
export type RetryActionLogInputValidated = z.infer<typeof RetryActionLogInputValidatedSchema>;

export interface RetryActionLogOutput {
  attemptId: string;
}

export interface OutboundDeliveryAttemptData {
  channel: ActionLogChannel;
  patientId: string;
  appointmentId?: string;
  recipientAddress: string;
  recipientName?: string;
  documentReferenceId?: string;
  communicationReference?: string;
  requesterReference?: string;
  senderOrganizationReference?: string;
  senderId?: string;
  senderDisplay?: string;
  parentAttemptId?: string;
  authoredOn?: string;
  sourceIdentifier?: string;
  initialStatus?: Task['status'];
}
