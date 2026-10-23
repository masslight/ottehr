import { z } from 'zod';
import { EXPORT_TASK_SYSTEM } from '../api/invoicing.types';

export const MEDICAL_RECORD_EXPORT_TASK_SYSTEM = EXPORT_TASK_SYSTEM;
export const MEDICAL_RECORD_EXPORT_TASK_CODE = 'export-medical-record';

export const MEDICAL_RECORD_EXPORT_OUTPUT_URL_CODE = 'export-medical-record-output-url';
export const MEDICAL_RECORD_EXPORT_FILE_NAME_CODE = 'export-medical-record-file-name';
export const MEDICAL_RECORD_EXPORT_PROGRESS_CODE = 'export-medical-record-progress';
export const MEDICAL_RECORD_EXPORT_DEADLINE_CODE = 'export-medical-record-deadline';
export const MEDICAL_RECORD_EXPORT_FAILURE_CODE = 'export-medical-record-failure';

export const MEDICAL_RECORD_EXPORT_DATE_RANGE_CODE = 'export-medical-record-date-range';

export const NO_MEDICAL_RECORDS_IN_RANGE_MESSAGE = 'No medical records found for the selected date range.';

export const MedicalRecordDateRangeSchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  })
  .refine(({ from, to }) => Date.parse(from) <= Date.parse(to), {
    message: 'The start date must not be after the end date',
    path: ['from'],
  });
export type MedicalRecordDateRange = z.infer<typeof MedicalRecordDateRangeSchema>;

export const StartMedicalRecordExportInputSchema = z.object({
  patientId: z.string().uuid(),
  dateRange: MedicalRecordDateRangeSchema,
});

export type StartMedicalRecordExportInput = z.infer<typeof StartMedicalRecordExportInputSchema>;

export const GetMedicalRecordExportStatusInputSchema = z.object({
  taskId: z.string().min(1),
  patientId: z.string().uuid(),
});
export type GetMedicalRecordExportStatusInput = z.infer<typeof GetMedicalRecordExportStatusInputSchema>;

export const GetMedicalRecordDateSpanInputSchema = z.object({
  patientId: z.string().uuid(),
  dateSpan: z.literal(true),
});
export type GetMedicalRecordDateSpanInput = z.infer<typeof GetMedicalRecordDateSpanInputSchema>;

export interface MedicalRecordDateSpan {
  earliest?: string;
  latest?: string;
}

export type GetPatientMedicalRecordInput =
  | StartMedicalRecordExportInput
  | GetMedicalRecordExportStatusInput
  | GetMedicalRecordDateSpanInput;

export const MEDICAL_RECORD_EXPORT_STATUSES = ['requested', 'in-progress', 'completed', 'failed'] as const;
export type MedicalRecordExportStatus = (typeof MEDICAL_RECORD_EXPORT_STATUSES)[number];

export const isTerminalMedicalRecordExportStatus = (status: MedicalRecordExportStatus | undefined): boolean =>
  status === 'completed' || status === 'failed';

export interface MedicalRecordExportProgress {
  processed: number;
  total: number;
  skipped?: number;
}

export const MedicalRecordExportProgressSchema = z.object({
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative().optional(),
});

export interface GetPatientMedicalRecordOutput {
  taskId: string;
  status: MedicalRecordExportStatus;
  processed?: number;
  total?: number;
  skipped?: number;
  fileName?: string;
  downloadUrl?: string;
  error?: string;
}
