import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BirthdayConfig,
  getOrCreateOutreachConfig,
  parsePlanDefinitionToActions,
} from '../../../scheduled-outreach-config/helpers';
import { produceOutreachTasks } from './produce-outreach-tasks';

export interface ProduceBirthdayOutreachResult {
  patientsEvaluated: number;
  tasksCreated: number;
  tasksSkipped: number;
  errors: number;
}

/**
 * Scans FHIR Patient resources for upcoming birthdays and produces outreach tasks.
 *
 * Reads the PlanDefinition to find all `patient-birthday` triggered actions,
 * determines the maximum offset window (daysAfter for "before" direction),
 * then searches for patients whose birthday (month + day) falls within that window.
 */
export async function produceBirthdayOutreach(oystehr: Oystehr): Promise<ProduceBirthdayOutreachResult> {
  const planDefinition = await getOrCreateOutreachConfig(oystehr);
  const allActions = parsePlanDefinitionToActions(planDefinition);
  const birthdayActions = allActions.filter((a) => a.trigger.event === 'patient-birthday');

  if (birthdayActions.length === 0) {
    console.log('produceBirthdayOutreach: No patient-birthday actions configured, skipping');
    return { patientsEvaluated: 0, tasksCreated: 0, tasksSkipped: 0, errors: 0 };
  }

  // Determine the scan window: we need to find patients with birthdays
  // from today out to the maximum "before" offset so tasks are created in advance.
  // "After" offset actions get tasks created on the birthday itself.
  const maxBeforeDays = birthdayActions.reduce((max, a) => {
    if (a.trigger.direction === 'before') {
      return Math.max(max, a.trigger.daysAfter);
    }
    return max;
  }, 0);

  // Scan window: today through today + maxBeforeDays
  // This ensures tasks for "X days before birthday" actions are created in time.
  const today = DateTime.now().startOf('day');
  const scanDays = maxBeforeDays + 1; // +1 to include today

  console.log(
    `produceBirthdayOutreach: ${birthdayActions.length} birthday action(s), scan window: ${scanDays} day(s) from today`
  );

  // Collect birthday configs (target ages) per action for filtering
  const actionBirthdayConfigs = new Map<string, BirthdayConfig | undefined>();
  for (const action of birthdayActions) {
    actionBirthdayConfigs.set(action.id, action.birthdayConfig);
  }

  // Build the set of MM-dd strings to search for
  const targetMonthDays = new Set<string>();
  for (let i = 0; i < scanDays; i++) {
    const date = today.plus({ days: i });
    targetMonthDays.add(date.toFormat('MM-dd'));
  }

  // Fetch patients whose birthDate matches any of the target month-day combos
  const patients = await findPatientsWithUpcomingBirthdays(oystehr, targetMonthDays);

  console.log(`produceBirthdayOutreach: Found ${patients.length} patient(s) with upcoming birthdays`);

  let tasksCreated = 0;
  let tasksSkipped = 0;
  let errors = 0;

  for (const patient of patients) {
    if (!patient.birthDate || !patient.id) continue;

    const birthDate = DateTime.fromISO(patient.birthDate);
    // Calculate the patient's next birthday date (this year or next)
    let nextBirthday = birthDate.set({ year: today.year });
    if (nextBirthday < today) {
      nextBirthday = nextBirthday.plus({ years: 1 });
    }

    const turningAge = nextBirthday.year - birthDate.year;

    for (const action of birthdayActions) {
      try {
        // Check age filter if configured
        const bConfig = actionBirthdayConfigs.get(action.id);
        if (bConfig?.ageMode && bConfig.age != null) {
          const effectiveMaxAge = bConfig.maxAge ?? 100;
          if (bConfig.ageMode === 'at') {
            if (turningAge !== bConfig.age) {
              tasksSkipped++;
              continue;
            }
          } else if (bConfig.ageMode === 'after') {
            if (turningAge < bConfig.age || turningAge > effectiveMaxAge) {
              tasksSkipped++;
              continue;
            }
          }
        }

        const result = await produceOutreachTasks({
          triggerEvent: 'patient-birthday',
          patient: { reference: `Patient/${patient.id}` },
          // Focus is the Patient themselves for birthday outreach (no encounter/invoice)
          focus: { reference: `Patient/${patient.id}` },
          eventTimestamp: nextBirthday.toISO()!,
          oystehr,
          // Only produce this specific action (not all birthday actions)
          actionFilter: (a) => a.id === action.id,
        });

        tasksCreated += result.created.length;
        tasksSkipped += result.skipped.length;
      } catch (err) {
        console.error(`Failed to produce birthday outreach for patient ${patient.id}, action ${action.id}:`, err);
        errors++;
      }
    }
  }

  console.log(`produceBirthdayOutreach: Created ${tasksCreated} tasks, skipped ${tasksSkipped}, errors ${errors}`);

  return { patientsEvaluated: patients.length, tasksCreated, tasksSkipped, errors };
}

/**
 * Find patients whose birthDate month-day matches any of the given MM-dd strings.
 * Uses FHIR search with birthdate parameter, querying each target date across all years.
 */
async function findPatientsWithUpcomingBirthdays(oystehr: Oystehr, targetMonthDays: Set<string>): Promise<Patient[]> {
  const allPatients: Patient[] = [];
  const seenIds = new Set<string>();
  const pageSize = 200;
  const maxPages = 50; // Safety limit: 50 pages × 200 = 10,000 patients max
  let offset = 0;
  let page = 0;

  // FHIR date search doesn't support month-day matching directly.
  // We search for all active patients and filter by birthDate month-day.
  let searchBundle = await oystehr.fhir.search<Patient>({
    resourceType: 'Patient',
    params: [
      { name: 'active', value: 'true' },
      { name: 'birthdate:missing', value: 'false' },
      { name: '_count', value: pageSize.toString() },
      { name: '_offset', value: offset.toString() },
      { name: '_elements', value: 'id,birthDate,name' },
    ],
  });
  page++;

  let patients = searchBundle.unbundle();
  collectMatchingPatients(patients, targetMonthDays, seenIds, allPatients);

  while (searchBundle.link?.find((l) => l.relation === 'next')) {
    if (page >= maxPages) {
      console.warn(
        `findPatientsWithUpcomingBirthdays: Reached max page limit (${maxPages} pages, ${
          offset + pageSize
        } patients scanned). ` +
          `Some patients may not have been evaluated. Consider increasing maxPages if this is expected.`
      );
      break;
    }
    offset += pageSize;
    searchBundle = await oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params: [
        { name: 'active', value: 'true' },
        { name: 'birthdate:missing', value: 'false' },
        { name: '_count', value: pageSize.toString() },
        { name: '_offset', value: offset.toString() },
        { name: '_elements', value: 'id,birthDate,name' },
      ],
    });
    page++;
    patients = searchBundle.unbundle();
    collectMatchingPatients(patients, targetMonthDays, seenIds, allPatients);
  }

  return allPatients;
}

function collectMatchingPatients(
  patients: Patient[],
  targetMonthDays: Set<string>,
  seenIds: Set<string>,
  result: Patient[]
): void {
  for (const patient of patients) {
    if (!patient.id || !patient.birthDate || seenIds.has(patient.id)) continue;

    const monthDay = DateTime.fromISO(patient.birthDate).toFormat('MM-dd');
    if (targetMonthDays.has(monthDay)) {
      seenIds.add(patient.id);
      result.push(patient);
    }
  }
}
