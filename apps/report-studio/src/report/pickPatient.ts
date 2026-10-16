// "Pick patient" in the Test report window: find, in the chosen environment, a patient with more than `moreThan` visits
// that recorded vitals. Searching every vitals reading of a practice is too heavy for a busy production server (one
// page took 50–90 s on practice B and the job failed at 34 s, for 90 days and a year alike), so it goes visits first:
// one search of the period's visits (patient references only) ranks patients by visits, then the leaders are checked
// one at a time with a per-patient vitals search (data map: vitals told apart by meta.tag, no category), which is
// fast. The last 90 days first, the last year only when nobody qualifies (synth's repeat visits are older than 90 days).
// A failed search stops the pick with its error; it never passes for "nobody qualifies".
import type { Appointment, Observation } from 'fhir/r4b';
import type { FetchPlanInput } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { runFetchPlan } from '../instance/zambdaClient';
import { DATE_RANGE_LABELS, DateRangePreset, resolveDateRange } from './types';

const LOOKBACKS: DateRangePreset[] = ['last90days', 'last365days'];
/** Leaders checked for vitals, most visits first, before giving up on a period. */
const MAX_CANDIDATES = 10;

const VITAL_TAGS = [
  'vital-temperature',
  'vital-heartbeat',
  'vital-respiration-rate',
  'vital-oxygen-sat',
  'vital-blood-pressure',
  'vital-weight',
  'vital-height',
];

// The ad hoc reports' visit search (fetchAppointmentReportResources), limited to visits that took place.
const VISITS_PLAN: FetchPlanInput = {
  version: 1,
  steps: [
    {
      id: 'visits',
      resourceType: 'Appointment',
      description: 'Visits that took place in the date range, patient references only',
      params: [
        { name: 'date', value: 'ge{{start}}' },
        { name: 'date', value: 'le{{end}}' },
        { name: 'status', value: 'arrived,checked-in,fulfilled' },
        { name: '_tag', value: 'OTTEHR-IP,OTTEHR-TM' },
      ],
      elements: ['participant'],
    },
  ],
};

const PATIENT_VITALS_PLAN: FetchPlanInput = {
  version: 1,
  steps: [
    {
      id: 'vitals',
      resourceType: 'Observation',
      description: "One patient's vitals in the date range, visit references only",
      params: [
        { name: 'subject', value: 'Patient/{{patientId}}' },
        { name: '_tag', value: VITAL_TAGS.join(',') },
        { name: 'date', value: 'ge{{start}}' },
        { name: 'date', value: 'le{{end}}' },
      ],
      elements: ['subject', 'encounter'],
    },
  ],
};

/** Visits per patient id, most first. */
export function visitsPerPatient(appointments: Appointment[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const a of appointments) {
    const patient = a.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference?.slice(8);
    if (patient) counts.set(patient, (counts.get(patient) ?? 0) + 1);
  }
  return Array.from(counts).sort((a, b) => b[1] - a[1]);
}

/** Distinct visits with at least one vital, per patient id. */
export function visitsWithVitals(observations: Observation[]): Map<string, number> {
  const visits = new Map<string, Set<string>>();
  for (const o of observations) {
    const patient = o.subject?.reference?.startsWith('Patient/') ? o.subject.reference.slice(8) : undefined;
    const encounter = o.encounter?.reference;
    if (!patient || !encounter) continue;
    visits.set(patient, (visits.get(patient) ?? new Set()).add(encounter));
  }
  return new Map(Array.from(visits, ([patient, encounters]) => [patient, encounters.size]));
}

/** Label of the period searched, e.g. "the last 90 days". */
export type PickResult = { period: string } & (
  | { patientId: string; visits: number }
  | { patientId?: undefined; mostVisits: number }
);

async function fetchStep<T>(
  plan: FetchPlanInput,
  dateRange: ReturnType<typeof resolveDateRange>,
  patientId?: string
): Promise<T[]> {
  const output = await runFetchPlan(plan, dateRange, patientId ? { patientId } : {}, 'direct');
  const error = output.stats.find((s) => s.error)?.error;
  if (error) throw new Error(error);
  return (output.resources[plan.steps[0].id] ?? []) as T[];
}

export async function pickPatient(
  moreThan: number,
  onProgress: (text: string) => void = () => {}
): Promise<PickResult> {
  let mostVisits = 0;
  let period = '';
  for (const preset of LOOKBACKS) {
    period = DATE_RANGE_LABELS[preset].toLowerCase();
    const dateRange = resolveDateRange({ preset });
    onProgress(`Searching visits in ${period}…`);
    const leaders = visitsPerPatient(await fetchStep<Appointment>(VISITS_PLAN, dateRange)).slice(0, MAX_CANDIDATES);
    for (const [index, [patientId, visits]] of leaders.entries()) {
      // visits with vitals can't outnumber visits, so nobody further down the list can qualify
      if (visits <= moreThan) break;
      onProgress(`Checking vitals of candidate ${index + 1} of ${leaders.length} (${visits} visits)…`);
      const withVitals =
        visitsWithVitals(await fetchStep<Observation>(PATIENT_VITALS_PLAN, dateRange, patientId)).get(patientId) ?? 0;
      if (withVitals > moreThan) return { patientId, visits: withVitals, period };
      mostVisits = Math.max(mostVisits, withVitals);
    }
  }
  return { mostVisits, period };
}
