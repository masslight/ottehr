// System reports: vetted Report Studio reports published for a practice, either shipped with Ottehr
// (config/oystehr/system-reports.json) or by staff with the practice's service credentials
// (packages/zambdas/src/scripts/publish-system-report.ts). A report knows only what to fetch and how to draw:
// the EHR screen that shows one names it (`get-system-report`), passes its inputs and decides who sees it and
// for which patients. It renders in the page, without the sandbox — so only a report loaded under the
// system-report code ever runs that way, and the browser never sends a plan or code: the `run-system-report`
// zambda loads both from the Basic and runs the plan with the shared runner.
import { z } from 'zod';
import { StartAdHocReportResponseSchema } from '../generation/report-task';
import { chooseFetchMode, FetchMode, MeasuredFetch } from '../plan/fetch-mode';
import {
  FetchPlanParametersSchema,
  FetchPlanSchema,
  FetchStepParam,
  planNeedsPatient,
  planUsesDateRange,
  RunFetchPlanOutputSchema,
} from '../plan/fetch-plan';
import { AD_HOC_DATE_RANGE_PRESETS, AdHocDateRangePreset, DateRange, DateRangeSchema } from '../query/date-range';
import { DateRangePreset, DateRangeSpec, DateRangeSpecSchema } from '../query/date-range-spec';
import { DateRangeInputDefault, DateRangeInputDefaultSchema, SavedAdHocReportInputSchema } from '../saved/saved.types';

/** The Report Studio file format (`*.report.json`). */
export const STUDIO_REPORT_FORMAT = 'ottehr-report-studio/1';

/** Basic.code under SAVED_ADHOC_REPORT_SYSTEM; distinct from the saved-report code on purpose. */
export const SYSTEM_REPORT_CODE = 'system-report';

/** Run parameters a plan may template besides the date range; the viewer asks for each before running. */
export const SYSTEM_REPORT_PARAMETER_NAMES = ['patientId'] as const;
export type SystemReportParameterName = (typeof SYSTEM_REPORT_PARAMETER_NAMES)[number];

/** The kinds of input a host screen may hand a report (`params.inputs`); checked shallowly before a run. */
export const SYSTEM_REPORT_INPUT_KINDS = [
  'id',
  'text',
  'number',
  'date',
  'dateRange',
  'list',
  'table',
  'object',
] as const;
export type SystemReportInputKind = (typeof SYSTEM_REPORT_INPUT_KINDS)[number];

/** A dateRange input's default (saved.types), its preset limited to the EHR picker's relative ranges. */
const SystemDateRangeInputDefaultSchema = DateRangeInputDefaultSchema.refine(
  (value) => !('preset' in value) || (AD_HOC_DATE_RANGE_PRESETS as readonly string[]).includes(value.preset),
  { message: `preset must be one of ${AD_HOC_DATE_RANGE_PRESETS.join(', ')}` }
);

/** A saved report's input with the kinds a host screen may pass and a description for the publisher. */
export const SystemReportInputSchema = SavedAdHocReportInputSchema.extend({
  kind: z.enum(SYSTEM_REPORT_INPUT_KINDS),
  description: z.string().optional(),
});
export type SystemReportInput = z.infer<typeof SystemReportInputSchema>;

/** The one dateRange input of a report, whose value fills the plan's date templates. */
export const dateRangeInputOf = (inputs: SystemReportInput[] | undefined): SystemReportInput | undefined =>
  inputs?.find((input) => input.kind === 'dateRange');

const inputKindMatches = (kind: SystemReportInputKind, value: unknown): boolean => {
  switch (kind) {
    case 'id':
    case 'text':
    case 'date':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'dateRange':
      return DateRangeSchema.safeParse(value).success;
    case 'list':
    case 'table':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
};

// The rules across a report's inputs and plan: one dateRange input at most, with a default; other defaults of
// the input's kind; and a plan that templates the date range only when there is one.
function checkInputsAndPlan(
  report: { inputs?: SystemReportInput[]; plan?: { steps: { params?: FetchStepParam[] }[] } },
  ctx: z.RefinementCtx
): void {
  const inputs = report.inputs ?? [];
  inputs.forEach((input, i) => {
    if (input.kind === 'dateRange') {
      if (!SystemDateRangeInputDefaultSchema.safeParse(input.default).success) {
        ctx.addIssue({
          code: 'custom',
          path: ['inputs', i, 'default'],
          message: 'a dateRange input needs a default: { preset } of the date picker, or { start, end } days',
        });
      }
    } else if (input.default !== undefined && !inputKindMatches(input.kind, input.default)) {
      ctx.addIssue({ code: 'custom', path: ['inputs', i, 'default'], message: `default must be a ${input.kind}` });
    }
  });
  if (inputs.filter((input) => input.kind === 'dateRange').length > 1) {
    ctx.addIssue({ code: 'custom', path: ['inputs'], message: 'a report may declare one dateRange input at most' });
  }
  if (report.plan && planUsesDateRange(report.plan) && !dateRangeInputOf(inputs)) {
    ctx.addIssue({
      code: 'custom',
      path: ['plan'],
      message: 'the plan uses {{start}} / {{end}} but no dateRange input is declared',
    });
  }
}

/** What a Report Studio file must hold to be published. Everything else in the file is dropped. */
export const StudioReportFileSchema = z.object({
  format: z.literal(STUDIO_REPORT_FORMAT),
  name: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  /** The studio's own range: becomes a dateRange input when the plan needs one (see systemReportFromStudioFile). */
  dateRange: DateRangeSpecSchema.optional(),
  /** Without a plan nothing is fetched: the code renders from `params.inputs` alone. */
  plan: FetchPlanSchema.optional(),
  /** JSX function body over PLAN_REPORT_SCOPE_PARAMS ending with `return ReportRoot;`. */
  code: z.string().min(1),
  runtimeVersion: z.number(),
  inputs: z.array(SystemReportInputSchema).optional(),
});

const SystemReportDefinitionObject = StudioReportFileSchema.omit({ format: true, dateRange: true }).extend({
  parameters: z.array(z.enum(SYSTEM_REPORT_PARAMETER_NAMES)),
  // Measured on THIS practice by the runs (fetch-mode.ts); the file's own measurements are never kept,
  // because they were made on another instance.
  fetchMode: z.enum(['direct', 'task']).optional(),
  measuredFetchSeconds: z.number().optional(),
  measuredRangeDays: z.number().optional(),
});
export const SystemReportDefinitionSchema = SystemReportDefinitionObject.superRefine(checkInputsAndPlan);
export type SystemReportDefinition = z.infer<typeof SystemReportDefinitionSchema>;

export const SystemReportSchema = SystemReportDefinitionObject.extend({
  id: z.string(),
  updatedAt: z.string().optional(),
}).superRefine(checkInputsAndPlan);
export type SystemReport = z.infer<typeof SystemReportSchema>;

/** One system report by its published name — what a screen that shows it asks for. */
export const GetSystemReportInputSchema = z.object({
  name: z.string().min(1),
});
export type GetSystemReportInput = z.infer<typeof GetSystemReportInputSchema>;

export const GetSystemReportOutputSchema = z.object({
  report: SystemReportSchema,
});
export type GetSystemReportOutput = z.infer<typeof GetSystemReportOutputSchema>;

export const RunSystemReportInputSchema = z.object({
  reportId: z.string().min(1),
  /** The report's dateRange input, when it declares one. */
  dateRange: DateRangeSchema.optional(),
  parameters: FetchPlanParametersSchema.optional(),
});
export type RunSystemReportInput = z.infer<typeof RunSystemReportInputSchema>;

/** The fetched resources (inline, or as a Z3 url) when the run went direct; the Task to poll when it did not. */
export const RunSystemReportOutputSchema = z.union([StartAdHocReportResponseSchema, RunFetchPlanOutputSchema]);
export type RunSystemReportOutput = z.infer<typeof RunSystemReportOutputSchema>;

/** The EHR picker's filter for each relative Report Studio range preset. */
const FILTER_FOR_STUDIO_PRESET: Record<Exclude<DateRangePreset, 'custom'>, AdHocDateRangePreset> = {
  today: 'today',
  yesterday: 'yesterday',
  last7days: 'last-7-days',
  last30days: 'last-30-days',
  last90days: 'last-90-days',
  last365days: 'last-365-days',
  thisMonth: 'this-month',
  lastMonth: 'last-month',
  thisYear: 'this-year',
  lastYear: 'last-year',
};

/** A Report Studio range as a dateRange input's default. */
const dateRangeInputDefault = (spec: DateRangeSpec): DateRangeInputDefault =>
  spec.preset === 'custom'
    ? { start: spec.start ?? '', end: spec.end ?? '' }
    : { preset: FILTER_FOR_STUDIO_PRESET[spec.preset] };

/**
 * A Report Studio file → the definition a system report Basic stores: validated (format, plan against the
 * plan schema, inputs, code present), with the per-instance measurements (stepDensity, fetchMode,
 * measuredFetchSeconds, measuredRangeDays), the prompt and any test parameter values left behind — only the
 * parameter NAMES the plan needs are kept. The studio's own date range becomes a dateRange input named
 * `range` when the plan uses the date templates and no input declares one; otherwise it is dropped.
 */
export function systemReportFromStudioFile(
  file: unknown
): { ok: true; definition: SystemReportDefinition } | { ok: false; errors: string[] } {
  const issues = (error: z.ZodError): string[] =>
    error.issues.map((i) => `${i.path.join('.') || 'file'}: ${i.message}`);
  const parsed = StudioReportFileSchema.safeParse(file);
  if (!parsed.success) return { ok: false, errors: issues(parsed.error) };
  const { format: _format, dateRange, ...report } = parsed.data;
  const inputs =
    dateRange && report.plan && planUsesDateRange(report.plan) && !dateRangeInputOf(report.inputs)
      ? [
          ...(report.inputs ?? []),
          { name: 'range', kind: 'dateRange' as const, required: false, default: dateRangeInputDefault(dateRange) },
        ]
      : report.inputs;
  const definition = SystemReportDefinitionSchema.safeParse({
    ...report,
    ...(inputs ? { inputs } : {}),
    parameters: report.plan && planNeedsPatient(report.plan) ? ['patientId'] : [],
  });
  return definition.success
    ? { ok: true, definition: definition.data }
    : { ok: false, errors: issues(definition.error) };
}

/**
 * How a system report fetches: one patient's data is small, so a per-patient plan with no date range always runs
 * directly, whatever was measured; everything else as fetch-mode.ts decides from this practice's measurements.
 */
export function systemReportFetchMode(
  report: MeasuredFetch & { plan?: { steps: { params?: FetchStepParam[] }[] }; inputs?: SystemReportInput[] },
  dateRange?: DateRange
): FetchMode {
  if (report.plan && planNeedsPatient(report.plan) && !dateRangeInputOf(report.inputs)) return 'direct';
  return chooseFetchMode(report, dateRange);
}

/** The host's inputs with the declared defaults filled in where it passed nothing (a dateRange is resolved by the viewer). */
export function withSystemReportInputDefaults(
  declared: SystemReportInput[] | undefined,
  provided: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...provided };
  for (const input of declared ?? []) {
    if (
      (out[input.name] === undefined || out[input.name] === null) &&
      input.kind !== 'dateRange' &&
      input.default !== undefined
    ) {
      out[input.name] = input.default;
    }
  }
  return out;
}

/** What is wrong with the inputs a host passed for a report: a required one missing, or one of another kind. */
export function checkSystemReportInputs(
  declared: SystemReportInput[] | undefined,
  provided: Record<string, unknown>
): string[] {
  const errors: string[] = [];
  for (const input of declared ?? []) {
    const value = provided[input.name];
    if (value === undefined || value === null) {
      if (input.required) errors.push(`input "${input.name}" is required`);
    } else if (!inputKindMatches(input.kind, value)) {
      errors.push(`input "${input.name}" must be a ${input.kind}`);
    }
  }
  return errors;
}
