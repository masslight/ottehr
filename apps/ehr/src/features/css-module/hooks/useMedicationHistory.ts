import { useEffect, useState } from 'react';
import { MedicationDTO, removePrefix, SearchParams } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { useChartData } from './useChartData';

export const useMedicationHistory = (
  search_by: SearchParams['_search_by'] = 'encounter',
  count = 10
): { isLoading: boolean; medicationHistory: MedicationDTO[] } => {
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);
  const [_, setCurrentMeds] = useState<MedicationDTO[] | null | undefined>(null);

  const { chartData: currentMedicationsData } = getSelectors(useAppointmentStore, ['chartData', 'isChartDataLoading']);

  const {
    isLoading,
    chartData: historyData,
    refetch: refetchHistory,
  } = useChartData({
    encounterId: encounter.id || '',
    requestedFields: {
      medications: {
        _sort: '-effective',
        _include: 'MedicationStatement:source',
        _search_by: search_by,
        _count: count,
      },
    },
    enabled: !!encounter.id,
  });

  useEffect(() => {
    setCurrentMeds((oldCurrentMeds) => {
      console.log(oldCurrentMeds, currentMedicationsData?.medications);
      if (
        oldCurrentMeds &&
        currentMedicationsData?.medications &&
        oldCurrentMeds.length !== currentMedicationsData.medications.length
      ) {
        void refetchHistory();
      }
      return currentMedicationsData?.medications;
    });
  }, [currentMedicationsData?.medications, refetchHistory]);

  if (historyData?.practitioners?.length && historyData.practitioners.length > 0) {
    historyData.medications?.forEach((val) => {
      if ('practitioner' in val && val.practitioner && 'reference' in val.practitioner && val.practitioner.reference) {
        const ref = removePrefix('Practitioner/', val.practitioner.reference);
        const practitioner = historyData.practitioners?.find((practitioner) => practitioner.id === ref);
        val.practitioner = practitioner;
      }
    });
  }

  return { isLoading, medicationHistory: historyData?.medications || [] };
};
