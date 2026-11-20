import Oystehr from '@oystehr/sdk';
import { Appointment, Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { chunkThings } from 'utils/lib/fhir/chat';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  isNewPatient,
  SEEN_VISIT_APPOINTMENT_STATUS,
  VisitSeenBeforeData,
} from 'utils/lib/helpers/screening-questions/new-patient.helper';
import { ADDITIONAL_QUESTIONS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  PATIENT_SEEN_IN_LAST_THREE_YEARS_FIELD,
  SEEN_IN_LAST_THREE_YEARS_FIELD,
} from 'utils/lib/types/data/screening-questions/constants';

const SCREENING_TAG_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/${ADDITIONAL_QUESTIONS_META_SYSTEM}`;
const SEEN_BEFORE_FIELDS = [SEEN_IN_LAST_THREE_YEARS_FIELD, PATIENT_SEEN_IN_LAST_THREE_YEARS_FIELD];
/** The `_tag` value of an Observation search for the seen-before screening answers. */
export const SEEN_BEFORE_ANSWER_TAGS = SEEN_BEFORE_FIELDS.map((field) => `${SCREENING_TAG_SYSTEM}|${field}`).join(',');

/** Each encounter's seen-before answers, newest first (isNewPatient reads the first one of each field). */
export type SeenBeforeAnswers = Map<string, NonNullable<VisitSeenBeforeData['observations']>>;
const ENCOUNTERS_PER_SEARCH = 100;
const SEARCH_CONCURRENCY = 4;

interface VisitInRange {
  appointment: Appointment;
  encounterId?: string;
}

export interface PatientVisitsInRange {
  hasPriorVisit: boolean;
  visits: VisitInRange[];
}

/** The encounters whose seen-before answers can decide a patient without a prior visit (resolveNewPatients). */
export function seenBeforeEncounterIds(visits: VisitInRange[]): string[] {
  return visitsBeforeFirstSeen(visits)
    .map((visit) => visit.encounterId)
    .filter((id): id is string => Boolean(id));
}

function visitsBeforeFirstSeen(visits: VisitInRange[]): VisitInRange[] {
  const earliestFirst = [...visits].sort(
    (a, b) =>
      DateTime.fromISO(a.appointment.start ?? '').toMillis() - DateTime.fromISO(b.appointment.start ?? '').toMillis()
  );

  const firstSeen = earliestFirst.findIndex((visit) => visit.appointment.status === SEEN_VISIT_APPOINTMENT_STATUS);

  return firstSeen === -1 ? earliestFirst : earliestFirst.slice(0, firstSeen + 1);
}

/**
 * `answers`: the seen-before answers when the caller already has them (the ad-hoc reports load them with their own
 * search helpers, beside the prior visits); otherwise they are searched here.
 */
export async function resolveNewPatients<K>(
  oystehr: Oystehr,
  patients: Map<K, PatientVisitsInRange>,
  answers?: SeenBeforeAnswers
): Promise<Map<K, boolean>> {
  const relevantVisits = new Map<K, VisitInRange[]>();

  for (const [key, { hasPriorVisit, visits }] of patients) {
    relevantVisits.set(key, hasPriorVisit ? [] : visitsBeforeFirstSeen(visits));
  }

  const answersByEncounter =
    answers ??
    (await fetchSeenBeforeAnswers(
      oystehr,
      Array.from(relevantVisits.values())
        .flat()
        .map((visit) => visit.encounterId)
        .filter((id): id is string => Boolean(id))
    ));

  const result = new Map<K, boolean>();

  for (const [key, { hasPriorVisit }] of patients) {
    result.set(
      key,
      isNewPatient(
        hasPriorVisit,
        (relevantVisits.get(key) ?? []).map(({ appointment, encounterId }) => ({
          appointment,
          observations: encounterId ? answersByEncounter.get(encounterId) : undefined,
        }))
      )
    );
  }

  return result;
}

async function fetchSeenBeforeAnswers(
  oystehr: Oystehr,
  encounterIds: string[]
): Promise<Map<string, NonNullable<VisitSeenBeforeData['observations']>>> {
  const searches = chunkThings(Array.from(new Set(encounterIds)), ENCOUNTERS_PER_SEARCH).map(
    (ids) => (): Promise<Observation[]> =>
      getAllFhirSearchPages<Observation>(
        {
          resourceType: 'Observation',
          params: [
            { name: 'encounter', value: ids.map((id) => `Encounter/${id}`).join(',') },
            { name: '_tag', value: SEEN_BEFORE_ANSWER_TAGS },
            { name: '_sort', value: '-_lastUpdated' },
          ],
        },
        oystehr
      )
  );

  const observations: Observation[] = [];
  for (const group of chunkThings(searches, SEARCH_CONCURRENCY)) {
    observations.push(...(await Promise.all(group.map((search) => search()))).flat());
  }
  return groupSeenBeforeAnswers(observations);
}

/** Seen-before answer Observations by encounter, newest first whatever order they came in. */
export function groupSeenBeforeAnswers(observations: Observation[]): SeenBeforeAnswers {
  const byEncounter: SeenBeforeAnswers = new Map();
  // A stable sort: answers without a lastUpdated keep the order they came in.
  const updatedAt = (o: Observation): number => Date.parse(o.meta?.lastUpdated ?? '') || 0;
  const newestFirst = [...observations].sort((a, b) => updatedAt(b) - updatedAt(a));

  for (const observation of newestFirst) {
    const encounterId = observation.encounter?.reference?.replace('Encounter/', '');

    const field = observation.meta?.tag?.find(
      (tag) => tag.system === SCREENING_TAG_SYSTEM && SEEN_BEFORE_FIELDS.includes(tag.code ?? '')
    )?.code;

    if (!encounterId || !field) continue;

    byEncounter.set(encounterId, [
      ...(byEncounter.get(encounterId) ?? []),
      { field, value: observation.valueString ?? observation.valueBoolean },
    ]);
  }

  return byEncounter;
}
