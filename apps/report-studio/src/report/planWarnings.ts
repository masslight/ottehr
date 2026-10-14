// Plan checks that need no run: what a plan is about to ask of the server that is known to go wrong, told
// to Claude as warnings when the plan is set (update_report) and when it runs (run_report).
import { FetchPlanInput, stepIsDateBounded } from 'utils/lib/types/adhoc/plan/fetch-plan';

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
