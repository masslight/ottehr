// Plan checks that need no run: what a plan is about to ask of the server that is known to go wrong, told
// to Claude as warnings when the plan is set (update_report) and when it runs (run_report) — and, after a run,
// the step shapes the run showed to be expensive.
import {
  estimatePlanRequests,
  FETCH_PLAN_LIMITS,
  FetchPlanInput,
  FetchStepDensity,
  FetchStepStats,
  REQUEST_BUDGET,
  stepIsDateBounded,
} from 'utils/lib/types/adhoc/plan/fetch-plan';
import type { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import { rangeDays } from './fetchMode';

const INCLUDE_PARAM = /^_(rev)?include(:iterate)?$/;
const PATIENT_TEMPLATE = /\{\{\s*patientId\s*\}\}/;

/** The type an _include / _revinclude value brings along: "Encounter:appointment" → Encounter, "Appointment:patient" → Patient. */
const includedType = (name: string, value: string): string => {
  const [source, param, target] = value.split(':');
  if (name.startsWith('_revinclude')) return source;
  return target ?? param.charAt(0).toUpperCase() + param.slice(1);
};

/**
 * A date-range search that also pulls in other types comes back whole — `_elements` does not trim included
 * resources — so a range of any size can exceed the server's 6 MB / 14 s limits per request. A search bounded
 * by one patient ({{patientId}}) is small whatever it includes.
 */
export function heavySearchWarnings(plan: FetchPlanInput): string[] {
  const warnings: string[] = [];
  for (const step of plan.steps) {
    const params = step.params ?? [];
    if (step.from || !stepIsDateBounded(step) || params.some((p) => PATIENT_TEMPLATE.test(p.value))) continue;
    const included = params.filter((p) => INCLUDE_PARAM.test(p.name)).map((p) => includedType(p.name, p.value));
    if (!included.length) continue;
    warnings.push(
      `step "${step.id}" pulls in ${Array.from(new Set(included)).join(', ')} with _include/_revinclude across a ` +
        "date range; included records come back whole and can exceed Oystehr's 6 MB / 14 s limits. Fetch them as " +
        'separate scoped steps with elements.'
    );
  }
  return warnings;
}

/** The by-date search that replaces a list of ids, for the types a visit report fetches that way. */
const BY_DATE_SEARCH: Record<string, string> = {
  Encounter: 'Encounter?appointment.date=ge{{start}}&appointment.date=le{{end}}',
  Patient: 'Patient?_has:Appointment:patient:date=ge{{start}}&_has:Appointment:patient:date=le{{end}}',
};
const byDateSearch = (type: string): string =>
  BY_DATE_SEARCH[type] ?? `${type} by a date parameter of its own over {{start}}..{{end}} (see the data map)`;

/**
 * Before a run: the requests the plan should take on this date range, from the densities its last run saved,
 * against the budget. Nothing to say without measurements (a first run) or under the budget.
 */
export function requestBudgetWarnings(
  plan: FetchPlanInput,
  hints: Record<string, FetchStepDensity> | undefined,
  dateRange: DateRange
): string[] {
  if (!hints) return [];
  const estimates = estimatePlanRequests(plan, hints, Math.max(1, rangeDays(dateRange)));
  const counted = estimates.filter((e) => e.requests !== undefined);
  const total = counted.reduce((sum, e) => sum + (e.requests ?? 0), 0);
  if (total <= REQUEST_BUDGET) return [];
  const steps = counted
    .filter((e) => (e.requests ?? 0) > 1)
    .sort((a, b) => (b.requests ?? 0) - (a.requests ?? 0))
    .map((e) => `"${e.id}" ~${e.requests} (${e.how})`);
  const unknown = estimates.filter((e) => e.requests === undefined).map((e) => `"${e.id}" (${e.how})`);
  return [
    `the plan should take ~${total} requests on this date range, over the budget of ${REQUEST_BUDGET}: ` +
      `${steps.join('; ')}. Fetch a large step by date instead of by a list of ids — ${BY_DATE_SEARCH.Encounter}, ` +
      `${BY_DATE_SEARCH.Patient} — a large date-bounded step is one bulk job.` +
      (unknown.length ? ` Not counted: ${unknown.join(', ')}.` : ''),
  ];
}

/** Ids a scoped step may be fed before the studio says to fetch it by date: four paged batches. */
export const ID_LIST_WARNING_VALUES = 4 * FETCH_PLAN_LIMITS.scopedBatchSize;

/** After a run: a scoped step fed a long list of ids, with the by-date search that replaces it. */
export function idListWarnings(stats: FetchStepStats[]): string[] {
  return stats
    .filter((s) => !s.error && (s.scopedValues ?? 0) > ID_LIST_WARNING_VALUES)
    .map(
      (s) =>
        `step "${s.id}" fetches ${(s.byType[s.resourceType] ?? 0).toLocaleString('en-US')} ${s.resourceType} by a ` +
        `list of ${(s.scopedValues ?? 0).toLocaleString('en-US')} ids (${s.requests} requests); fetch it by date ` +
        `instead, e.g. ${byDateSearch(s.resourceType)}`
    );
}
