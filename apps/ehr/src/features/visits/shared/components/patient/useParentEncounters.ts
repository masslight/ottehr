import { Appointment, Encounter, Location, Schedule } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import type { LocationWithWalkinSchedule } from 'src/pages/AddPatient';
import { isFollowupEncounter } from 'utils';

export interface EncounterRow {
  id: string | undefined;
  typeLabel: string;
  dateTime: string | undefined;
  appointment: Appointment;
  encounter: Encounter;
  location?: LocationWithWalkinSchedule;
}

interface UseParentEncountersResult {
  previousEncounters: EncounterRow[];
  selectedParentEncounter: EncounterRow | undefined;
  setSelectedParentEncounter: (encounter: EncounterRow | undefined) => void;
}

export function useParentEncounters(
  patientId: string | undefined,
  initialEncounterId?: string
): UseParentEncountersResult {
  const { oystehrZambda } = useApiClients();
  const [previousEncounters, setPreviousEncounters] = useState<EncounterRow[]>([]);
  const [selectedParentEncounter, setSelectedParentEncounter] = useState<EncounterRow | undefined>(undefined);

  useEffect(() => {
    const getPreviousEncounters = async (): Promise<void> => {
      if (!oystehrZambda || !patientId) return;
      try {
        const resources = (
          await oystehrZambda.fhir.search({
            resourceType: 'Encounter',
            params: [
              { name: 'patient', value: patientId },
              { name: '_include', value: 'Encounter:appointment' },
              { name: '_include', value: 'Encounter:location' },
              { name: '_revinclude:iterate', value: 'Schedule:actor:Location' },
              { name: '_sort', value: '-date' },
            ],
          })
        ).unbundle();

        const encounters = resources.filter((r) => r.resourceType === 'Encounter') as Encounter[];
        const appointments = resources.filter((r) => r.resourceType === 'Appointment') as Appointment[];
        const rawLocations = resources.filter((r) => r.resourceType === 'Location') as Location[];
        const schedules = resources.filter((r) => r.resourceType === 'Schedule') as Schedule[];
        const locations: LocationWithWalkinSchedule[] = rawLocations.map((loc) => ({
          ...loc,
          walkinSchedule: schedules.find((s) => s.actor?.some((actor) => actor.reference === `Location/${loc.id}`)),
        }));

        // Only show non-followup (top-level) encounters as parent options
        const nonFollowupEncounters = encounters.filter((encounter) => !isFollowupEncounter(encounter));

        const encounterRows: EncounterRow[] = nonFollowupEncounters
          .map((encounter) => {
            const appointment = encounter.appointment?.[0]?.reference
              ? appointments.find((app) => `Appointment/${app.id}` === encounter.appointment?.[0]?.reference)
              : undefined;

            const locationRef = encounter.location?.[0]?.location?.reference?.replace('Location/', '');
            const encounterLocation = locationRef ? locations.find((loc) => loc.id === locationRef) : undefined;

            return {
              id: encounter.id,
              typeLabel: appointment?.appointmentType?.text || 'Visit',
              dateTime: appointment?.start,
              appointment: appointment!,
              encounter: encounter,
              location: encounterLocation,
            };
          })
          .filter((row) => row.id)
          .sort((a, b) => {
            const dateA = DateTime.fromISO(a.dateTime ?? '');
            const dateB = DateTime.fromISO(b.dateTime ?? '');
            return dateB.diff(dateA).milliseconds;
          });

        setPreviousEncounters(encounterRows);

        if (initialEncounterId && encounterRows.length > 0) {
          console.log(
            '[ScheduledSelector] Looking for initialEncounterId:',
            initialEncounterId,
            'in',
            encounterRows.map((r) => r.id)
          );
          const matchingVisit = encounterRows.find((row) => row.encounter?.id === initialEncounterId);
          console.log('[ScheduledSelector] Match:', matchingVisit?.id);
          if (matchingVisit) {
            setSelectedParentEncounter(matchingVisit);
          }
        }
      } catch (err) {
        console.error('Error fetching previous encounters:', err);
      }
    };

    void getPreviousEncounters();
  }, [oystehrZambda, patientId, initialEncounterId]);

  return { previousEncounters, selectedParentEncounter, setSelectedParentEncounter };
}
