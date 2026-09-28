// The executor's write layer. It goes through the shared chart-data mutations on purpose: the read-only
// rule for a signed visit is enforced there, client-side, and not by the save-chart-data zambda.

import { useMemo } from 'react';
import { useDeleteChartData, useSaveChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { AllChartValues } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ChartWriter } from '../executor/types';

export function useChartWriter(encounterId: string): ChartWriter {
  const { mutateAsync: saveChartData } = useSaveChartData();
  const { mutateAsync: deleteChartData } = useDeleteChartData();

  // The encounter is passed explicitly: the appointment store may not be populated where this runs.
  return useMemo<ChartWriter>(
    () => ({
      save: async (fields) => (await saveChartData({ encounterId, ...fields })).createdResourceIds,
      remove: async (field, item) => {
        const rows = { [field]: [{ resourceId: item.resourceId }] } as AllChartValues;
        await deleteChartData({ encounterId, ...rows });
      },
    }),
    [saveChartData, deleteChartData, encounterId]
  );
}
