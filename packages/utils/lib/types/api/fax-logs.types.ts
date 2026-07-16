import { z } from 'zod';
import { Secrets } from '../../secrets';

export const FAX_LOGS_PAGE_SIZE = 10;
/** Faxes older than this many days are hidden from the default view but stay reachable via search. */
export const FAX_LOGS_DISPLAY_WINDOW_DAYS = 30;

export const GetFaxLogsInputSchema = z.object({
  /** Scope the log to a single patient (patient record Action Logs page). */
  patientId: z.string().uuid().optional(),
  patientName: z.string().optional(),
  visitId: z.string().uuid().optional(),
  /** Appointment date in YYYY-MM-DD format. */
  visitDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  pageIndex: z.number().int().nonnegative().default(0),
  itemsPerPage: z.number().int().positive().max(50).default(FAX_LOGS_PAGE_SIZE),
});

export type GetFaxLogsInput = z.input<typeof GetFaxLogsInputSchema>;
export type GetFaxLogsInputParsed = z.infer<typeof GetFaxLogsInputSchema>;

export const GetFaxLogsInputValidatedSchema = GetFaxLogsInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
});

export type GetFaxLogsInputValidated = z.infer<typeof GetFaxLogsInputValidatedSchema>;

export type FaxLogStatus = 'sent' | 'failed' | 'pending';

export interface FaxLogEntry {
  communicationId: string;
  status: FaxLogStatus;
  /** When the fax was submitted to the fax service. */
  sentAt?: string;
  /** Recipient fax number in E.164 format. */
  faxNumber?: string;
  patientId?: string;
  /** Formatted as "LastName, FirstName[, MiddleName]". */
  patientName?: string;
  recipientName?: string;
  appointmentId?: string;
  /** Appointment start (ISO). */
  visitDate?: string;
}

export interface GetFaxLogsOutput {
  logs: FaxLogEntry[];
  totalCount: number;
}
