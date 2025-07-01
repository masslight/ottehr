import { QueryObserverResult } from 'react-query';
import { ChartDataFieldsKeys, GetChartDataResponse, MedicationDTO, removePrefix, SearchParams } from 'utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../telemed';
import { useChartData } from './useChartData';

export type MedicationHistoryField = Extract<ChartDataFieldsKeys, 'medications' | 'inhouseMedications'>;

export const useMedicationHistory = (
  search_by: SearchParams['_search_by'] = 'encounter',
  count = 10,
  chartDataField: MedicationHistoryField = 'medications'
): {
  isLoading: boolean;
  medicationHistory: MedicationDTO[];
  refetchHistory: () => Promise<QueryObserverResult<GetChartDataResponse, unknown>>;
} => {
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);

  const {
    isLoading,
    chartData: historyData,
    refetch: refetchHistory,
  } = useChartData({
    encounterId: encounter.id || '',
    requestedFields: {
      [chartDataField]: {
        _sort: '-effective',
        _include: 'MedicationStatement:source',
        _search_by: search_by,
        _count: count,
      },
    },
    enabled: !!encounter.id,
  });

  if (historyData?.practitioners?.length) {
    historyData.inhouseMedications?.forEach((val) => {
      if ('practitioner' in val && val.practitioner && 'reference' in val.practitioner && val.practitioner.reference) {
        const ref = removePrefix('Practitioner/', val.practitioner.reference);
        const practitioner = historyData.practitioners?.find((practitioner) => practitioner.id === ref);
        val.practitioner = practitioner;
      }
    });
  }

  return { isLoading, medicationHistory: historyData?.[chartDataField] || [], refetchHistory };
};
