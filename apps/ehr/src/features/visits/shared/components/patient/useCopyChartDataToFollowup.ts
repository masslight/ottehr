import { useMutation, UseMutationResult } from '@tanstack/react-query';
import { AllChartValues } from 'utils/lib/types/api/chart-data/chart-data.types';
import { SaveChartDataRequest } from 'utils/lib/types/api/chart-data/save-chart-data.types';
import { CopyableFollowupField } from 'utils/lib/types/api/prebook-create-appointment/prebook-create-appointment.types';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import { resetExamObservationsStore } from '../../stores/appointment/reset-exam-observations';
import { resetRosObservationsStore } from '../../stores/appointment/reset-ros-observations';
import { COPYABLE_FOLLOWUP_FIELDS, fetchCopySourceChartData } from './copyFollowupFields';

interface CopyChartDataInput {
  sourceEncounterId: string;
  targetEncounterId: string;
  fields: CopyableFollowupField[];
  overwriteExisting?: boolean;
}

// Copies the client-side chart fields onto the new follow-up via save-chart-data. Diagnosis is
// copied server-side by create-appointment — callers must NOT include it in `fields`.
export const useCopyChartDataToFollowup = (): UseMutationResult<void, Error, CopyChartDataInput> => {
  const apiClient = useOystehrAPIClient();

  return useMutation({
    mutationFn: async ({ sourceEncounterId, targetEncounterId, fields, overwriteExisting }): Promise<void> => {
      const configs = COPYABLE_FOLLOWUP_FIELDS.filter(
        (config) => fields.includes(config.key) && config.extract !== undefined
      );
      if (configs.length === 0) return;
      if (!apiClient) throw new Error('api client not defined');

      const [chartData, targetChartData] = await Promise.all([
        fetchCopySourceChartData(apiClient, sourceEncounterId),
        overwriteExisting ? fetchCopySourceChartData(apiClient, targetEncounterId) : undefined,
      ]);

      const payload: SaveChartDataRequest = {
        encounterId: targetEncounterId,
        ...Object.assign(
          {} as Partial<AllChartValues>,
          ...configs.map((config) => config.extract!(chartData, targetChartData))
        ),
      };
      await apiClient.saveChartData(payload);

      const copied = new Set(configs.map((config) => config.key));
      if (copied.has('examObservations')) resetExamObservationsStore();
      if (copied.has('rosObservations')) resetRosObservationsStore();

      if (!targetChartData) return;
      const stale = Object.assign(
        {} as Partial<AllChartValues>,
        ...configs.map((config) => config.stale?.(chartData, targetChartData) ?? {})
      ) as Partial<AllChartValues>;
      if (Object.keys(stale).length > 0) {
        await apiClient.deleteChartData({ encounterId: targetEncounterId, ...stale });
      }
    },
  });
};
