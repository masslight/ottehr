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

/**
 * Searches that return the wrong set on Ottehr data, found on practice B (production, 2026-10-16, 60 days): a clinical
 * record's own date is empty or partial (Condition recorded-date 0 found, MedicationRequest authoredon 0, Procedure date
 * 57 of ~11,700, QuestionnaireResponse authored 2,922 of 9,316), and a follow-up Encounter's period has no end, so
 * date=ge…&le… matches every follow-up since go-live (20,358 vs 4,150 started in the range).
 */
const UNRELIABLE_DATE: Record<string, string[]> = {
  Condition: ['recorded-date', 'onset-date'],
  MedicationRequest: ['authoredon'],
  Procedure: ['date'],
  QuestionnaireResponse: ['authored'],
};
export function dateFieldWarnings(plan: FetchPlanInput): string[] {
  const warnings: string[] = [];
  for (const step of plan.steps) {
    const names = (step.params ?? []).map((p) => p.name);
    const bad = (UNRELIABLE_DATE[step.resourceType] ?? []).filter((n) => names.includes(n));
    if (bad.length) {
      warnings.push(
        `step "${step.id}" searches ${step.resourceType} by ${bad.join(
          ', '
        )}, which Ottehr leaves empty or partial — ` +
          "it returns too few records. Fetch them through the visits' encounters instead (see the data map)."
      );
    }
    const encounterDate = (step.params ?? []).filter((p) => p.name === 'date').map((p) => p.value);
    const followUps = (step.params ?? []).some((p) => p.name === 'part-of:missing' && p.value === 'false');
    if (step.resourceType === 'Encounter' && followUps && encounterDate.some((v) => v.startsWith('ge'))) {
      warnings.push(
        `step "${step.id}" searches follow-up Encounters with date=ge…: their period has no end, so that matches every ` +
          'follow-up since go-live. For "started in the range" use date=sa{{start}}&date=le{{end}}.'
      );
    }
  }
  return warnings;
}

/**
 * Before a run: the requests the plan should take on this date range, from the densities its last run saved,
 * against the budget. Paged batches of a scoped id list are left out: on practice B (production, 2026-10-16) a year of
 * encounters by 130 such batches took 5.4 s and patients by 82 took 2.4 s, against 14.3 s and 15.3 s for the same
 * records searched by visit date (appointment.date / _has) — many cheap requests, not a cost to steer away from.
 * Nothing to say without measurements (a first run) or under the budget.
 */
export function requestBudgetWarnings(
  plan: FetchPlanInput,
  hints: Record<string, FetchStepDensity> | undefined,
  dateRange: DateRange
): string[] {
  if (!hints) return [];
  const estimates = estimatePlanRequests(plan, hints, Math.max(1, rangeDays(dateRange)));
  const counted = estimates.filter((e) => e.requests !== undefined && !e.scopedPaged);
  const total = counted.reduce((sum, e) => sum + (e.requests ?? 0), 0);
  if (total <= REQUEST_BUDGET) return [];
  const steps = counted
    .filter((e) => (e.requests ?? 0) > 1)
    .sort((a, b) => (b.requests ?? 0) - (a.requests ?? 0))
    .map((e) => `"${e.id}" ~${e.requests} (${e.how})`);
  const unknown = estimates.filter((e) => e.requests === undefined).map((e) => `"${e.id}" (${e.how})`);
  return [
    `the plan should take ~${total} requests on this date range, over the budget of ${REQUEST_BUDGET}: ` +
      `${steps.join('; ')}. Trim what each step returns (elements; no _revinclude:iterate Encounter:part-of — the ` +
      'visit encounters already include the follow-ups), count instead of fetching when the report only counts ' +
      '(_summary=count), and fetch clinical data through the visits.' +
      (unknown.length ? ` Not counted: ${unknown.join(', ')}.` : ''),
  ];
}

/** Ids a scoped step may be fed as bulk jobs before the studio suggests paged batches: four batches' worth. */
export const ID_LIST_WARNING_VALUES = 4 * FETCH_PLAN_LIMITS.scopedBatchSize;

/**
 * After a run: a scoped step that ran a long id list as bulk jobs. Paged batches did the same faster on practice B
 * production (a year of vitals for 52,638 encounters: 28.1 s paged vs 39.7 s as bulk jobs of 1,000 ids).
 */
export function idListWarnings(stats: FetchStepStats[]): string[] {
  return stats
    .filter((s) => !s.error && s.mode === 'bulk' && (s.scopedValues ?? 0) > ID_LIST_WARNING_VALUES)
    .map(
      (s) =>
        `step "${s.id}" fetched ${(s.byType[s.resourceType] ?? 0).toLocaleString('en-US')} ${s.resourceType} by a ` +
        `list of ${(s.scopedValues ?? 0).toLocaleString('en-US')} ids as bulk jobs (${s.requests} requests); ` +
        'paged batches are faster for a scoped step — set its mode to "auto"'
    );
}
