import { z } from 'zod';
import { EXPORT_TASK_SYSTEM } from '../api/invoicing.types';

// A medical-record export is a background job: the `http_auth` zambda creates a Task and returns its
// id, a Subscription hands the Task to `sub-export-medical-record`, and the front end polls the same
// zambda for progress. The Subscription matches on system|code, so these two must stay in sync with
// the criteria in config/oystehr-core/zambdas.json.
export const MEDICAL_RECORD_EXPORT_TASK_SYSTEM = EXPORT_TASK_SYSTEM;
export const MEDICAL_RECORD_EXPORT_TASK_CODE = 'export-medical-record';

// Codes on the Task.output entries the worker writes. The url is the (un-presigned) Z3 url of the
// finished archive; progress is a JSON blob refreshed as the archive is written.
export const MEDICAL_RECORD_EXPORT_OUTPUT_URL_CODE = 'export-medical-record-output-url';
export const MEDICAL_RECORD_EXPORT_FILE_NAME_CODE = 'export-medical-record-file-name';
export const MEDICAL_RECORD_EXPORT_PROGRESS_CODE = 'export-medical-record-progress';
/**
 * ISO instant the running worker gives up by. Written once when the job starts, so a Task left
 * `in-progress` by an invocation that was killed can be told apart from one still working — without
 * that, the patient's chart would be un-exportable forever (nothing else ever moves the Task off
 * `in-progress`).
 */
export const MEDICAL_RECORD_EXPORT_DEADLINE_CODE = 'export-medical-record-deadline';
/**
 * A failure message the worker deliberately authored for the user — the archive being over the
 * single-file limit, say. Only text written here ever reaches the UI.
 *
 * `Task.statusReason` is not that channel: it carries whatever the thrown error said, which is a server
 * detail. Matching outbound-fax, the raw cause stays in the logs and on the Task, and anything without an
 * authored message here is reported to the user generically.
 */
export const MEDICAL_RECORD_EXPORT_FAILURE_CODE = 'export-medical-record-failure';

export const StartMedicalRecordExportInputSchema = z.object({ patientId: z.string().uuid() });
export type StartMedicalRecordExportInput = z.infer<typeof StartMedicalRecordExportInputSchema>;

// `patientId` travels with the poll as well as the kickoff: the Task id alone would let any caller
// with a valid id presign an archive belonging to a chart they never asked for.
export const GetMedicalRecordExportStatusInputSchema = z.object({
  taskId: z.string().min(1),
  patientId: z.string().uuid(),
});
export type GetMedicalRecordExportStatusInput = z.infer<typeof GetMedicalRecordExportStatusInputSchema>;

/** Either kick off (or re-attach to) an export for a patient, or poll one by Task id. */
export type GetPatientMedicalRecordInput = StartMedicalRecordExportInput | GetMedicalRecordExportStatusInput;

export const MEDICAL_RECORD_EXPORT_STATUSES = ['requested', 'in-progress', 'completed', 'failed'] as const;
export type MedicalRecordExportStatus = (typeof MEDICAL_RECORD_EXPORT_STATUSES)[number];

export const isTerminalMedicalRecordExportStatus = (status: MedicalRecordExportStatus | undefined): boolean =>
  status === 'completed' || status === 'failed';

/**
 * Progress the worker publishes onto the Task while the archive is being written. `total` is exact:
 * it is resolved from document metadata before any bytes are transferred.
 */
export interface MedicalRecordExportProgress {
  processed: number;
  total: number;
  /** Documents dropped because their bytes could not be resolved; reported, not fatal. */
  skipped?: number;
}

export const MedicalRecordExportProgressSchema = z.object({
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative().optional(),
});

/** What the front end polls for. */
export interface GetPatientMedicalRecordOutput {
  taskId: string;
  status: MedicalRecordExportStatus;
  /** Documents written into the archive so far. */
  processed?: number;
  /** Documents the export will archive in total. */
  total?: number;
  /**
   * Documents left out of the archive because their bytes could not be read. Not an error — but the
   * archive is then incomplete, so the caller has to say so rather than reporting a clean success.
   */
  skipped?: number;
  fileName?: string;
  /** Presigned download url; present only once `status` is `completed` and the chart had documents. */
  downloadUrl?: string;
  error?: string;
}
