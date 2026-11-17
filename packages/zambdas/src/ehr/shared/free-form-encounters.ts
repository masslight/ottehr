import { SearchParam } from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FOLLOWUP_SYSTEMS, isFreeFormEncounter } from 'utils/lib/fhir/encounter';
import { FreeFormEncounterHistoryRow } from 'utils/lib/types/api/patient-visit-history.types';

interface FreeFormEncounterDateRange {
  from?: string;
  to?: string;
}

export const getFreeFormEncounterSearchParams = ({
  patientId,
  from,
  to,
}: FreeFormEncounterDateRange & { patientId: string }): SearchParam[] => [
  { name: 'subject', value: `Patient/${patientId}` },
  { name: 'type', value: `${FOLLOWUP_SYSTEMS.type.url}|${FOLLOWUP_SYSTEMS.type.code}` },
  { name: 'part-of:missing', value: 'true' },
  { name: 'status:not', value: 'entered-in-error' },
  ...(from ? [{ name: 'date', value: `ge${from}` }] : []),
  ...(to ? [{ name: 'date', value: `le${to}` }] : []),
];

export const freeFormEncounterHistoryRowFromEncounter = (
  encounter: Encounter
): FreeFormEncounterHistoryRow | undefined => {
  if (!encounter.id) return undefined;
  return {
    encounterId: encounter.id,
    dateTime: encounter.period?.start,
    note:
      encounter.extension?.find((extension) => extension.url === FOLLOWUP_SYSTEMS.messageUrl)?.valueString ||
      encounter.reasonCode?.[0]?.text ||
      '',
    lastUpdated: encounter.meta?.lastUpdated,
  };
};

const startsWithinRange = (start: string | undefined, { from, to }: FreeFormEncounterDateRange): boolean => {
  if (!from && !to) return true;
  const startDateTime = start ? DateTime.fromISO(start) : undefined;
  if (!startDateTime?.isValid) return false;
  if (from && startDateTime < DateTime.fromISO(from)) return false;
  if (to && startDateTime > DateTime.fromISO(to)) return false;
  return true;
};

export const toFreeFormEncounterRows = (
  encounters: Encounter[],
  range: FreeFormEncounterDateRange
): FreeFormEncounterHistoryRow[] =>
  encounters.flatMap((encounter) => {
    if (!isFreeFormEncounter(encounter) || !startsWithinRange(encounter.period?.start, range)) return [];
    const row = freeFormEncounterHistoryRowFromEncounter(encounter);
    return row ? [row] : [];
  });
