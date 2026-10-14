// The studio's saved report: plain JSON in a folder the user picks, so a developer can also point
// Claude Code at the same files. Mirrors what the redesign saves (plan + code + prompt), not today's
// dataset-based SavedAdHocReportDefinition.
import { DateTime } from 'luxon';
import type { FetchPlanInput, FetchPlanParameters } from 'utils/lib/types/adhoc/plan/fetch-plan';
import type { DateRange } from 'utils/lib/types/adhoc/query/date-range';

export const STUDIO_REPORT_FORMAT = 'ottehr-report-studio/1';
export const STUDIO_RUNTIME_VERSION = 1;

export const DATE_RANGE_PRESETS = [
  'today',
  'yesterday',
  'last7days',
  'last30days',
  'last90days',
  'last365days',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'lastYear',
  'custom',
] as const;
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export const DATE_RANGE_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 days',
  last30days: 'Last 30 days',
  last90days: 'Last 90 days',
  last365days: 'Last 365 days',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  thisYear: 'This year',
  lastYear: 'Last year',
  custom: 'Custom',
};

export interface DateRangeSpec {
  preset: DateRangePreset;
  /** yyyy-MM-dd days in the viewer's zone, custom only. */
  start?: string;
  end?: string;
}

export interface StudioReport {
  format: typeof STUDIO_REPORT_FORMAT;
  name: string;
  description?: string;
  /** The conversation's original request, kept so the report can be regenerated. */
  prompt: string;
  /** The heading the model gave the report. */
  title?: string;
  dateRange: DateRangeSpec;
  /** Run parameters the plan may template ({{patientId}}); the patient box in the top bar. */
  parameters?: FetchPlanParameters;
  plan: FetchPlanInput;
  /** JSX function body over (React, MUI, Report, resources, helpers, params) ending with `return ReportRoot;`. */
  code: string;
  runtimeVersion: number;
  updatedAt?: string;
}

/** The part of a report a Claude turn can change — one undo step. */
export type ReportSnapshot = Pick<
  StudioReport,
  'name' | 'description' | 'prompt' | 'title' | 'dateRange' | 'parameters' | 'plan' | 'code'
>;

export const DEFAULT_PLAN: FetchPlanInput = {
  version: 1,
  steps: [
    {
      id: 'visits',
      resourceType: 'Appointment',
      description: 'Visits in the date range with their encounters, patients and locations',
      params: [
        { name: 'date', value: 'ge{{start}}' },
        { name: 'date', value: 'le{{end}}' },
        { name: '_tag', value: 'OTTEHR-IP,OTTEHR-TM' },
        { name: '_include', value: 'Appointment:patient' },
        { name: '_include', value: 'Appointment:location' },
        { name: '_revinclude', value: 'Encounter:appointment' },
      ],
    },
  ],
};

export const DEFAULT_CODE = `// Report code runs in a sandbox on the fetched FHIR resources.
// In scope: React, MUI, Report, resources (step id -> resources), helpers, params.
const idx = helpers.index(resources.visits);
const appointments = idx.byType.Appointment || [];
const encounters = idx.byType.Encounter || [];
const encounterByAppt = {};
for (const e of encounters) {
  const ref = e.appointment && e.appointment[0] && e.appointment[0].reference;
  if (ref && !encounterByAppt[ref]) encounterByAppt[ref] = e;
}
const byStatus = helpers.countBy(appointments, (a) => helpers.visitStatus(a, encounterByAppt[helpers.ref(a)]));
const rows = Object.entries(byStatus).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);

function ReportRoot() {
  return (
    <Report.Section title="Visits by status">
      <MUI.Stack direction="row" spacing={2} flexWrap="wrap">
        <Report.Kpi label="Visits" value={appointments.length} format="integer" />
        <Report.Kpi label="Statuses" value={rows.length} format="integer" />
      </MUI.Stack>
      {rows.length === 0 ? (
        <Report.Note tone="info">No visits in the selected range.</Report.Note>
      ) : (
        <Report.Table rows={rows} columns={[{ field: 'status', label: 'Status' }, { field: 'count', label: 'Visits', format: 'integer' }]} />
      )}
    </Report.Section>
  );
}
return ReportRoot;
`;

export function emptyReport(): StudioReport {
  return {
    format: STUDIO_REPORT_FORMAT,
    name: 'Untitled report',
    prompt: '',
    dateRange: { preset: 'last30days' },
    plan: DEFAULT_PLAN,
    code: DEFAULT_CODE,
    runtimeVersion: STUDIO_RUNTIME_VERSION,
  };
}

export function snapshotOf(report: StudioReport): ReportSnapshot {
  const { name, description, prompt, title, dateRange, parameters, plan, code } = report;
  return structuredClone({ name, description, prompt, title, dateRange, parameters, plan, code });
}

/** The ISO instant window for a spec, in the viewer's local zone (what the EHR's pickers do). */
export function resolveDateRange(spec: DateRangeSpec, now: DateTime = DateTime.local()): DateRange {
  const day = (d: DateTime): { start: DateTime; end: DateTime } => ({ start: d.startOf('day'), end: d.endOf('day') });
  let range: { start: DateTime; end: DateTime };
  switch (spec.preset) {
    case 'today':
      range = day(now);
      break;
    case 'yesterday':
      range = day(now.minus({ days: 1 }));
      break;
    case 'last7days':
      range = { start: now.minus({ days: 6 }).startOf('day'), end: now.endOf('day') };
      break;
    case 'last30days':
      range = { start: now.minus({ days: 29 }).startOf('day'), end: now.endOf('day') };
      break;
    case 'last90days':
      range = { start: now.minus({ days: 89 }).startOf('day'), end: now.endOf('day') };
      break;
    case 'last365days':
      range = { start: now.minus({ days: 364 }).startOf('day'), end: now.endOf('day') };
      break;
    case 'thisMonth':
      range = { start: now.startOf('month'), end: now.endOf('month') };
      break;
    case 'lastMonth':
      range = { start: now.minus({ months: 1 }).startOf('month'), end: now.minus({ months: 1 }).endOf('month') };
      break;
    case 'thisYear':
      range = { start: now.startOf('year'), end: now.endOf('year') };
      break;
    case 'lastYear':
      range = { start: now.minus({ years: 1 }).startOf('year'), end: now.minus({ years: 1 }).endOf('year') };
      break;
    case 'custom': {
      const start = spec.start ? DateTime.fromISO(spec.start) : now.minus({ days: 29 });
      const end = spec.end ? DateTime.fromISO(spec.end) : now;
      range = { start: start.startOf('day'), end: end.endOf('day') };
      break;
    }
  }
  return { start: range.start.toUTC().toISO()!, end: range.end.toUTC().toISO()! };
}

export function describeDateRange(spec: DateRangeSpec): string {
  if (spec.preset !== 'custom') return DATE_RANGE_LABELS[spec.preset];
  return `${spec.start ?? '…'} to ${spec.end ?? '…'}`;
}
