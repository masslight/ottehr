import { DateTime } from 'luxon';
import { useMemo, useState } from 'react';
import { createVitalsSearchConfig, VitalFieldNames, VitalsObservationDTO } from 'utils';
import useEvolveUser from '../../../../../hooks/useEvolveUser';
import { useAppointment } from '../../../hooks/useAppointment';
import { VitalHistoryEntry } from '../types';
import { ScreenDimensions, useScreenDimensions } from './useScreenDimensions';
import { useVitalsHandlers } from './useVitalsHandlers';

export type HistoryEntriesCreatorFn<
  TypeObsDTO extends VitalsObservationDTO,
  TypeVitalHistoryEntry extends VitalHistoryEntry<TypeObsDTO>,
> = (
  encounterId: string,
  userId: string | undefined,
  vitalsEntitiesByEncounter: VitalsObservationDTO[],
  vitalsEntitiesByPatient: VitalsObservationDTO[]
) => TypeVitalHistoryEntry[];

export type VitalsCardHistory<
  TypeObsDTO extends VitalsObservationDTO,
  TypeVitalHistoryEntry extends VitalHistoryEntry<TypeObsDTO>,
> = {
  historyEntries: TypeVitalHistoryEntry[];
  mainHistoryEntries: TypeVitalHistoryEntry[];
  extraHistoryEntries: TypeVitalHistoryEntry[];
  latestHistoryEntry: TypeVitalHistoryEntry | undefined;
};

export type VitalsCardState<
  TypeObsDTO extends VitalsObservationDTO,
  TypeVitalHistoryEntry extends VitalHistoryEntry<TypeObsDTO>,
> = {
  vitalsEntitiesByEncounter: VitalsObservationDTO[];
  vitalsEntitiesByPatient: VitalsObservationDTO[];
  isLoadingVitalsByEncounter: boolean;

  handleSaveVital: (vitalEntity: VitalsObservationDTO) => Promise<void>;
  handleDeleteVital: (vitalEntity: VitalsObservationDTO) => Promise<void>;

  vitalsHistory: VitalsCardHistory<TypeObsDTO, TypeVitalHistoryEntry>;

  setSavingCardData: (isSaving: boolean) => void;
  isSavingCardData: boolean;

  screenDimensions: ScreenDimensions;
  historyElementSkeletonText: string;
};

export const useVitalsCardState = <
  TypeObsDTO extends VitalsObservationDTO,
  TypeVitalHistoryEntry extends VitalHistoryEntry<TypeObsDTO>,
>(
  fieldName: VitalFieldNames,
  historyEntriesCreator: HistoryEntriesCreatorFn<TypeObsDTO, TypeVitalHistoryEntry>
): VitalsCardState<TypeObsDTO, TypeVitalHistoryEntry> => {
  const user = useEvolveUser();
  const userId = user?.profile?.split('/')?.[1];

  const { resources } = useAppointment();
  const encounterId = resources.encounter!.id!;
  // const patientId = sourceData.patient?.id;

  const [isSavingCardData, setSavingCardData] = useState(false);

  const {
    vitalsEntities: vitalsEntitiesByEncounter,
    isLoading: isLoadingVitalsByEncounter,
    handleSave: handleSaveVital,
    handleDelete: handleDeleteVital,
  } = useVitalsHandlers({
    encounterId,
    searchConfig: createVitalsSearchConfig(fieldName, 'encounter'),
  });

  const { vitalsEntities: vitalsEntitiesByPatient } = useVitalsHandlers({
    encounterId,
    searchConfig: createVitalsSearchConfig(fieldName, 'patient'),
  });

  const screenDimensions = useScreenDimensions();

  // ========================
  // debug
  // useEffect(() => {
  //   if (vitalsEntitiesByEncounter && vitalsEntitiesByEncounter.length > 0) {
  //     console.log(`TemperatureVitalsCard:: vitalsEntitiesByEncounter ln=[${vitalsEntitiesByEncounter.length}] =>`);
  //     console.log(vitalsEntitiesByEncounter);
  //   }
  // }, [vitalsEntitiesByEncounter]);

  // useEffect(() => {
  //   if (vitalsEntitiesByPatient && vitalsEntitiesByPatient.length > 0) {
  //     console.log(`TemperatureVitalsCard:: vitalsEntitiesByPatient ln=[${vitalsEntitiesByPatient.length}] =>`);
  //     console.log(vitalsEntitiesByPatient);
  //   }
  // }, [vitalsEntitiesByPatient]);

  // const userName = user?.userName;
  // useEffect(() => {
  //   console.log(`user_id = [${userId}] :: user_name=[${userName}]`);
  // }, [userId, userName]);
  // ========================

  const historyElementSkeletonText = 'x'.repeat(55);

  const historyEntries = useMemo(() => {
    return historyEntriesCreator(encounterId, userId, vitalsEntitiesByEncounter, vitalsEntitiesByPatient);
  }, [encounterId, historyEntriesCreator, userId, vitalsEntitiesByEncounter, vitalsEntitiesByPatient]);

  const mainHistoryEntries = useMemo(() => {
    return historyEntries.slice(0, Math.min(historyEntries.length, 3));
  }, [historyEntries]);

  const extraHistoryEntries = useMemo(() => {
    const startIndex = Math.min(historyEntries.length, 3);
    return historyEntries.slice(startIndex, historyEntries.length);
  }, [historyEntries]);

  const latestHistoryEntry = useMemo(() => {
    const entriesSortedByDate = [...historyEntries].sort((a, b) => {
      if (!a.recordDateTime) return 0;
      if (!b.recordDateTime) return 0;
      const firstDate = DateTime.fromISO(b.recordDateTime);
      const secondDate = DateTime.fromISO(a.recordDateTime);
      return firstDate.toMillis() - secondDate.toMillis();
    });
    return entriesSortedByDate?.at(0);
  }, [historyEntries]);

  const vitalsHistory: VitalsCardHistory<TypeObsDTO, TypeVitalHistoryEntry> = {
    historyEntries: historyEntries,
    mainHistoryEntries: mainHistoryEntries,
    extraHistoryEntries: extraHistoryEntries,
    latestHistoryEntry: latestHistoryEntry,
  };

  return {
    vitalsEntitiesByEncounter: vitalsEntitiesByEncounter,
    vitalsEntitiesByPatient: vitalsEntitiesByPatient,
    isLoadingVitalsByEncounter: isLoadingVitalsByEncounter,
    handleSaveVital: handleSaveVital,
    handleDeleteVital: handleDeleteVital,
    setSavingCardData: setSavingCardData,
    isSavingCardData: isSavingCardData,
    vitalsHistory: vitalsHistory,
    screenDimensions: screenDimensions,
    historyElementSkeletonText: historyElementSkeletonText,
  };
};
