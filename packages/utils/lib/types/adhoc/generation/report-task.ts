import { z } from 'zod';
import { ottehrCodeSystemUrl } from '../../../fhir/systemUrls';
import { RunFetchPlanInputSchema } from '../plan/fetch-plan';
import { DateRangeSchema } from '../query/date-range';

export const ADHOC_REPORT_TASK_SYSTEM = ottehrCodeSystemUrl('adhoc-report-task');
export const ADHOC_REPORT_TASK_CODE = 'adhoc-report';
export const ADHOC_REPORT_PARAMS_CODE = 'adhoc-report-params';
export const ADHOC_REPORT_OUTPUT_URL_CODE = 'adhoc-report-output-url';

// Report-code generation runs as a Task too: an http zambda is capped at 27s, slower models need longer.
export const ADHOC_GENERATE_TASK_CODE = 'adhoc-generate';

export const ADHOC_GENERATE_PARAMS_CODE = 'adhoc-generate-params';
export const ADHOC_GENERATE_OUTPUT_CODE = 'adhoc-generate-output';

export const StartAdHocDatasetReportInputSchema = z.object({
  datasetId: z.string().min(1),
  dateRange: DateRangeSchema,
  options: z.record(z.boolean()).optional(),
});
export type StartAdHocDatasetReportInput = z.infer<typeof StartAdHocDatasetReportInputSchema>;

/** A dataset report or a fetch plan (a plan report); both run in the background Task. */
export const StartAdHocReportInputSchema = z.union([StartAdHocDatasetReportInputSchema, RunFetchPlanInputSchema]);
export type StartAdHocReportInput = z.infer<typeof StartAdHocReportInputSchema>;

export const StartAdHocReportResponseSchema = z.object({ taskId: z.string().min(1) });
export type StartAdHocReportResponse = z.infer<typeof StartAdHocReportResponseSchema>;

export const GetAdHocReportStatusInputSchema = z.object({ taskId: z.string().min(1) });
export type GetAdHocReportStatusInput = z.infer<typeof GetAdHocReportStatusInputSchema>;

export const AdHocReportStatusSchema = z.object({
  status: z.enum(['requested', 'in-progress', 'completed', 'failed']),
  downloadUrl: z.string().optional(),
  error: z.string().optional(),
});
export type AdHocReportStatus = z.infer<typeof AdHocReportStatusSchema>;
