import { Task } from 'fhir/r4b';
import z from 'zod';
import { Secrets } from '../../secrets';

export const INVOICEABLE_PATIENTS_PAGE_SIZE = 40;
export const GET_INVOICES_TASKS_ZAMBDA_KEY = 'get-invoices-tasks';

export const InvoiceTaskDisplayStatuses = ['ready', 'updating', 'sending', 'sent', 'error'] as const;
export type InvoiceTaskDisplayStatus = (typeof InvoiceTaskDisplayStatuses)[number];

export const InvoiceTaskInputSchemaBase = z.object({
  dueDate: z.string(),
  memo: z.string(),
  smsTextMessage: z.string(),
  amountCents: z.number(),
  claimId: z.string().optional(),
  finalizationDate: z.string().optional(),
});
export const InvoiceTaskInputSchema = InvoiceTaskInputSchemaBase.partial();
export type InvoiceTaskInput = z.infer<typeof InvoiceTaskInputSchema>;
export const SubSendInvoiceToPatientTaskInputSchema = InvoiceTaskInputSchemaBase.extend({
  memo: z.string().optional(),
  amountCents: z.number().gt(0),
});
export type SubSendInvoiceToPatientTaskInput = z.infer<typeof SubSendInvoiceToPatientTaskInputSchema>;

export const UpdateInvoiceTaskZambdaInputSchema = z.object({
  taskId: z.string().uuid(),
  status: z.string(),
  invoiceTaskInput: InvoiceTaskInputSchema.optional(),
  userTimezone: z.string(),
});
export type UpdateInvoiceTaskZambdaInput = z.infer<typeof UpdateInvoiceTaskZambdaInputSchema>;

export type InvoiceMessagesPlaceholders = {
  'patient-full-name'?: string;
  location?: string;
  'visit-date'?: string;
  'url-to-patient-portal'?: string;
  clinic?: string;
  amount?: string;
  'due-date'?: string;
  'invoice-link'?: string;
};

const allowedStatuses = [
  'draft',
  'requested',
  'received',
  'accepted',
  'rejected',
  'ready',
  'cancelled',
  'in-progress',
  'on-hold',
  'failed',
  'completed',
  'entered-in-error',
] as const;

export const GetInvoicesTasksZambdaInputSchema = z.object({
  page: z.number().min(0).optional(),
  status: z.enum(allowedStatuses).optional(),
  patientId: z.string().optional(),
});
export const GetInvoicesTasksZambdaValidatedInputSchema = GetInvoicesTasksZambdaInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
});
export const InvoiceablePatientReportSchema = z.object({
  claimId: z.string(),
  finalizationDateISO: z.string(),
  amountInvoiceable: z.number(),
  task: z.custom<Task>(),
  visitDate: z.string(),
  location: z.string(),
  patient: z.object({
    patientId: z.string(),
    fullName: z.string(),
    dob: z.string().optional(),
    gender: z.string().optional(),
    phoneNumber: z.string(),
  }),
  responsibleParty: z.object({
    fullName: z.string().optional(),
    phoneNumber: z.string().optional(),
    email: z.string().optional(),
    relationshipToPatient: z.string().optional(),
  }),
});
export const GetInvoicesTasksZambdaResponseSchema = z.object({
  reports: z.array(InvoiceablePatientReportSchema),
  totalCount: z.number(),
});

export type GetInvoicesTasksValidatedInput = z.infer<typeof GetInvoicesTasksZambdaValidatedInputSchema>;
export type GetInvoicesTasksInput = z.infer<typeof GetInvoicesTasksZambdaInputSchema>;
export type InvoiceablePatientReport = z.infer<typeof InvoiceablePatientReportSchema>;
export type GetInvoicesTasksResponse = z.infer<typeof GetInvoicesTasksZambdaResponseSchema>;
