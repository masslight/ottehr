import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { AllChartValues, CopyableFollowupField, SaveChartDataRequest } from 'utils';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { COPYABLE_FOLLOWUP_FIELDS, fetchCopySourceChartData } from './copyFollowupFields';

interface CopyChartDataInput {
  sourceEncounterId: string;
  targetEncounterId: string;
  fields: CopyableFollowupField[];
}

// OTR-2467: copies 5 of the 6 chart-data fields from a parent encounter onto the new
// follow-up encounter via save-chart-data. Diagnosis is copied server-side by
// create-appointment (predates OTR-2467) — callers must NOT include it in `fields`.
export const useCopyChartDataToFollowup = (): UseMutationResult<void, Error, CopyChartDataInput> => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationFn: async ({ sourceEncounterId, targetEncounterId, fields }): Promise<void> => {
      const configs = COPYABLE_FOLLOWUP_FIELDS.filter(
        (config) => fields.includes(config.key) && config.extract !== undefined
      );
      if (configs.length === 0) return;
      if (!apiClient) throw new Error('api client not defined');

      const chartData = await fetchCopySourceChartData(apiClient, sourceEncounterId);
      const payload: SaveChartDataRequest = {
        encounterId: targetEncounterId,
        ...Object.assign({} as Partial<AllChartValues>, ...configs.map((c) => c.extract!(chartData))),
      };
      await apiClient.saveChartData(payload);
    },
  });
};
