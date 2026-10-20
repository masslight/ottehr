// Report inputs: what a host screen (or a Studio test case) hands a report — `params.inputs.<name>` in the code,
// {{patientId}} and the date templates in the plan. Mirrors the EHR's SystemReportInput (utils adhoc/system);
// the `dateRange` kind is the report's date range, as the EHR's shared picker names it (DateRangeFilter).
import type { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { z } from 'zod';
import { DATE_RANGE_PRESETS, DateRangePreset, DateRangeSpec, resolveDateRange, StudioReport } from './types';

export const INPUT_KINDS = ['id', 'text', 'number', 'date', 'dateRange', 'list', 'table', 'object'] as const;
export type InputKind = (typeof INPUT_KINDS)[number];

export const DATE_RANGE_FILTERS = [
  'today',
  'yesterday',
  'last-7-days',
  'last-30-days',
  'last-90-days',
  'last-365-days',
  'this-month',
  'last-month',
  'this-year',
  'last-year',
  'custom',
  'customRange',
] as const;
/** The EHR's DateRangeFilter names (the shared picker). */
export type DateRangeFilter = (typeof DATE_RANGE_FILTERS)[number];

export const DATE_RANGE_FILTER_LABELS: Record<DateRangeFilter, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  'last-7-days': 'Last 7 Days',
  'last-30-days': 'Last 30 Days',
  'last-90-days': 'Last 90 Days',
  'last-365-days': 'Last 365 Days',
  'this-month': 'This Month',
  'last-month': 'Last Month',
  'this-year': 'This Year',
  'last-year': 'Last Year',
  custom: 'Custom Date',
  customRange: 'Custom Date Range',
};

/** A dateRange input's value: a preset, one custom day (`start`) or a custom range (`start`..`end`), yyyy-MM-dd. */
export const DateRangeValueSchema = z.object({
  preset: z.enum(DATE_RANGE_FILTERS),
  start: z.string().optional(),
  end: z.string().optional(),
});
export type DateRangeValue = z.infer<typeof DateRangeValueSchema>;

export const ReportInputSchema = z.object({
  name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'input name must be an identifier'),
  kind: z.enum(INPUT_KINDS),
  required: z.boolean(),
  description: z.string().optional(),
  default: z.unknown().optional(),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;

export interface TestCase {
  name: string;
  values: Record<string, unknown>;
}

const PRESET_TO_FILTER: Record<Exclude<DateRangePreset, 'custom'>, DateRangeFilter> = {
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
const FILTER_TO_PRESET = Object.fromEntries(Object.entries(PRESET_TO_FILTER).map(([p, f]) => [f, p])) as Record<
  DateRangeFilter,
  DateRangePreset
>;

export const DEFAULT_DATE_RANGE: DateRangeValue = { preset: 'last-30-days' };

/** The old report file's date range (Studio preset names) → a dateRange input value (the EHR's names). */
export const toDateRangeValue = (spec: DateRangeSpec): DateRangeValue =>
  spec.preset === 'custom'
    ? { preset: 'customRange', start: spec.start, end: spec.end }
    : { preset: PRESET_TO_FILTER[spec.preset] };

/** A dateRange value → the spec resolveDateRange understands ('custom' is one day). */
export const toDateRangeSpec = (value: DateRangeValue): DateRangeSpec =>
  value.preset === 'custom'
    ? { preset: 'custom', start: value.start, end: value.start }
    : value.preset === 'customRange'
    ? { preset: 'custom', start: value.start, end: value.end }
    : { preset: FILTER_TO_PRESET[value.preset] };

export const describeDateRangeValue = (value: DateRangeValue): string =>
  value.preset === 'custom'
    ? value.start ?? '…'
    : value.preset === 'customRange'
    ? `${value.start ?? '…'} to ${value.end ?? '…'}`
    : DATE_RANGE_FILTER_LABELS[value.preset];

export function inputValueMatches(kind: InputKind, value: unknown): boolean {
  switch (kind) {
    case 'id':
    case 'text':
    case 'date':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'dateRange':
      return DateRangeValueSchema.safeParse(value).success;
    case 'list':
    case 'table':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

/** The declared inputs, checked: identifiers, kinds, unique names, at most one dateRange and it has a default. */
export function validateInputs(inputs: unknown): { ok: true; inputs: ReportInput[] } | { ok: false; errors: string[] } {
  const parsed = z.array(ReportInputSchema).safeParse(inputs);
  if (!parsed.success)
    return { ok: false, errors: parsed.error.issues.map((i) => `inputs.${i.path.join('.')}: ${i.message}`) };
  const errors: string[] = [];
  const names = new Set<string>();
  for (const input of parsed.data) {
    if (names.has(input.name)) errors.push(`inputs: duplicate name "${input.name}"`);
    names.add(input.name);
    if (input.default !== undefined && !inputValueMatches(input.kind, input.default))
      errors.push(`inputs.${input.name}: default is not a ${input.kind}`);
  }
  const ranges = parsed.data.filter((i) => i.kind === 'dateRange');
  if (ranges.length > 1) errors.push("inputs: at most one dateRange input (it is the report's date range)");
  if (ranges.length === 1 && ranges[0].default === undefined)
    errors.push(`inputs.${ranges[0].name}: a dateRange input needs a default (e.g. { "preset": "last-30-days" })`);
  return errors.length ? { ok: false, errors } : { ok: true, inputs: parsed.data };
}

const DATE_TEMPLATE = /\{\{\s*(start|end|startDate|endDate)\s*\}\}/;
const PATIENT_TEMPLATE = /\{\{\s*patientId\s*\}\}/;
const paramValues = (plan: StudioReport['plan']): string[] =>
  plan.steps.flatMap((s) => (s.params ?? []).map((p) => p.value));

/**
 * A report saved before inputs existed: its date range becomes a dateRange input "range" (when the plan uses the
 * date templates) and its patient parameter a required "patientId" id input with a test case "Default" holding the
 * value. Plan and code are untouched; a report that already declares inputs is returned as it is.
 */
export function convertLegacyReport(report: StudioReport): StudioReport {
  if (report.inputs) return report;
  const { dateRange, parameters, ...rest } = report;
  const values = paramValues(report.plan);
  const inputs: ReportInput[] = [];
  if (values.some((v) => DATE_TEMPLATE.test(v)))
    inputs.push({
      name: 'range',
      kind: 'dateRange',
      required: true,
      description: 'The date range the report covers',
      default: toDateRangeValue(dateRange ?? { preset: 'last30days' }),
    });
  const testCases: TestCase[] = [];
  if (values.some((v) => PATIENT_TEMPLATE.test(v))) {
    inputs.push({ name: 'patientId', kind: 'id', required: true, description: 'The patient this report runs for' });
    if (parameters?.patientId) testCases.push({ name: 'Default', values: { patientId: parameters.patientId } });
  }
  return ensureTestCase({ ...rest, inputs, ...(testCases.length ? { testCases } : {}) });
}

export const DEFAULT_TEST_CASE = 'Default';

/**
 * A report that declares inputs always has a test case to put values in: without one, a "Default" case with no
 * values (so the defaults apply) is added — on open, on conversion, when the first input arrives, when the last
 * case is deleted.
 */
export function ensureTestCase<T extends Pick<StudioReport, 'inputs' | 'testCases'>>(
  report: T
): T & Pick<StudioReport, 'testCases'> {
  if (!report.inputs?.length || report.testCases?.length) return report;
  return { ...report, testCases: [{ name: DEFAULT_TEST_CASE, values: {} }] };
}

/** The values a run uses: the test case's over the defaults; `missing` lists required inputs with no value. */
export function resolveInputs(
  report: Pick<StudioReport, 'inputs' | 'testCases'>,
  testCase: string | undefined
): { values: Record<string, unknown>; missing: string[] } {
  const given = report.testCases?.find((t) => t.name === testCase)?.values ?? {};
  const values: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const input of report.inputs ?? []) {
    const value = given[input.name] ?? input.default;
    if (value === undefined || value === null || value === '') {
      if (input.required) missing.push(input.name);
    } else values[input.name] = value;
  }
  return { values, missing };
}

export const dateRangeInput = (report: Pick<StudioReport, 'inputs'>): ReportInput | undefined =>
  report.inputs?.find((i) => i.kind === 'dateRange');

/** What the resolved inputs mean for a run: the plan's date range and patient, and `params.inputs` for the code. */
export function runParameters(
  report: Pick<StudioReport, 'inputs'>,
  values: Record<string, unknown>
): { dateRange: DateRange; patientId?: string; inputs: Record<string, unknown> } {
  const range = dateRangeInput(report);
  const rangeValue = range ? values[range.name] : undefined;
  const spec = DateRangeValueSchema.safeParse(rangeValue);
  const dateRange = resolveDateRange(spec.success ? toDateRangeSpec(spec.data) : toDateRangeSpec(DEFAULT_DATE_RANGE));
  const patientId =
    typeof values.patientId === 'string' && values.patientId.trim() ? values.patientId.trim() : undefined;
  return { dateRange, patientId, inputs: values };
}

export const presetNames = DATE_RANGE_PRESETS;
