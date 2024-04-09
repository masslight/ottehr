import { useMemo } from 'react';
import { useApiClients } from '../../hooks/useAppClients';
import { getZapEHRTelemedAPI } from '../data';

export const useZapEHRTelemedAPIClient = (): ReturnType<typeof getZapEHRTelemedAPI> | null => {
  const { zambdaClient } = useApiClients();

  const apiClient = useMemo(() => {
    if (zambdaClient)
      return getZapEHRTelemedAPI(
        {
          getTelemedAppointmentsZambdaID: import.meta.env.VITE_APP_GET_TELEMED_APPOINTMENTS_ZAMBDA_ID,
          getUserZambdaID: import.meta.env.VITE_APP_GET_USER_ZAMBDA_ID,
          initTelemedSessionZambdaID: import.meta.env.VITE_APP_INIT_TELEMED_SESSION_ZAMBDA_ID,
          getChartDataZambdaID: import.meta.env.VITE_APP_GET_CHART_DATA_ZAMBDA_ID,
          saveChartDataZambdaID: import.meta.env.VITE_APP_SAVE_CHART_DATA_ZAMBDA_ID,
          deleteChartDataZambdaID: import.meta.env.VITE_APP_DELETE_CHART_DATA_ZAMBDA_ID,
          isAppLocal: import.meta.env.VITE_APP_IS_LOCAL,
        },
        zambdaClient,
      );
    return null;
  }, [zambdaClient]);

  return apiClient;
};
