// The scope a fetch-plan report's code runs in: the fetched FHIR resources plus the data map's helpers,
// instead of a dataset's rows. Shared by the generation prompt (what the model is told is in scope) and
// the EHR iframe runtime (what it injects). Kept zod-free so the iframe bundle can import it cheaply.
import type { FhirResource } from 'fhir/r4b';
import type { DateRange } from '../query/date-range';

/** The parameters injected into a plan report's code, IN ORDER. */
export const PLAN_REPORT_SCOPE_PARAMS = ['React', 'MUI', 'Report', 'resources', 'helpers', 'params'] as const;

/** Step id → the resources that step fetched (included resources land in the same array). */
export type PlanReportResources = Record<string, FhirResource[]>;

/** The run's values, handed to the code as `params`. */
export interface PlanReportParams {
  /** The run's date range, when the plan templates one ({{start}} / {{end}}). */
  dateRange?: DateRange;
  /** The viewer's IANA zone. */
  timeZone: string;
  /** The run's patient, when the plan templates {{patientId}}. */
  patientId?: string;
  /** Step id → the server's total for a count-only step (`_summary=count`). */
  totals: Record<string, number>;
}
