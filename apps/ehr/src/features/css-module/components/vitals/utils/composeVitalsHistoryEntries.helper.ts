import { formatDateTimeToLocalTimezone, VitalsObservationDTO } from 'utils';
import { VitalHistoryEntry } from '../types';

export function composeVitalsHistoryEntries<
  TypeObsDTO extends VitalsObservationDTO,
  TypeVitalHistoryEntry extends VitalHistoryEntry<TypeObsDTO>,
>(
  encounterId: string,
  userId: string | undefined,
  vitalsEntitiesByEncounter: VitalsObservationDTO[],
  vitalsEntitiesByPatient: VitalsObservationDTO[],
  isObsOfTypeGuardFn: (observation: VitalsObservationDTO) => observation is TypeObsDTO,
  toHistoryEntryMapFn: (observation: TypeObsDTO) => Omit<TypeVitalHistoryEntry, keyof VitalHistoryEntry<TypeObsDTO>>
): TypeVitalHistoryEntry[] {
  const byEncounterResourcesIds = new Set(
    vitalsEntitiesByEncounter
      ?.filter((observation) => observation.resourceId)
      ?.map((observation) => observation.resourceId!) ?? []
  );

  const notCurrentEncounterObservations = vitalsEntitiesByPatient.filter((observation) => {
    return observation.encounterId !== encounterId && !byEncounterResourcesIds.has(observation.resourceId ?? '');
  });

  const allObservations = [...vitalsEntitiesByEncounter, ...notCurrentEncounterObservations];

  return allObservations
    .filter((vitalDTO) => isObsOfTypeGuardFn(vitalDTO))
    .map((vitalDTO) => {
      const baseProps: VitalHistoryEntry<TypeObsDTO> = {
        vitalObservationDTO: vitalDTO as TypeObsDTO,
        fhirResourceId: vitalDTO.resourceId,
        recordDateTime: formatDateTimeToLocalTimezone(vitalDTO.lastUpdated),
        author: vitalDTO.authorName,
        isDeletable: !!userId && userId === vitalDTO.authorId && encounterId === vitalDTO.encounterId,
        // debugEntrySource: byEncounterResourcesIds.has(vitalDTO.resourceId ?? '') ? 'encounter' : 'patient',
      };
      const extraProps = toHistoryEntryMapFn(vitalDTO as TypeObsDTO);

      return { ...baseProps, ...extraProps } as TypeVitalHistoryEntry;
    });
}
