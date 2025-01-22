import { useMemo } from 'react';
import { useApiClients } from '../../hooks/useAppClients';
import { getZapEHRTelemedAPI } from '../data';

export const useZapEHRAPIClient = (): ReturnType<typeof getZapEHRTelemedAPI> | null => {
  const { zambdaClient } = useApiClients();

  const apiClient = useMemo(() => {
    if (zambdaClient)
      return getZapEHRTelemedAPI(
        {
          getTelemedAppointmentsZambdaID: import.meta.env.VITE_APP_GET_TELEMED_APPOINTMENTS_ZAMBDA_ID,
          initTelemedSessionZambdaID: import.meta.env.VITE_APP_INIT_TELEMED_SESSION_ZAMBDA_ID,
          getChartDataZambdaID: import.meta.env.VITE_APP_GET_CHART_DATA_ZAMBDA_ID,
          saveChartDataZambdaID: import.meta.env.VITE_APP_SAVE_CHART_DATA_ZAMBDA_ID,
          deleteChartDataZambdaID: import.meta.env.VITE_APP_DELETE_CHART_DATA_ZAMBDA_ID,
          changeTelemedAppointmentStatusZambdaID: import.meta.env.VITE_APP_CHANGE_TELEMED_APPOINTMENT_STATUS_ZAMBDA_ID,
          getPatientInstructionsZambdaID: import.meta.env.VITE_APP_GET_PATIENT_INSTRUCTIONS_ZAMBDA_ID,
          syncUserZambdaID: import.meta.env.VITE_APP_SYNC_USER_ZAMBDA_ID,
          savePatientInstructionZambdaID: import.meta.env.VITE_APP_SAVE_PATIENT_INSTRUCTION_ZAMBDA_ID,
          deletePatientInstructionZambdaID: import.meta.env.VITE_APP_DELETE_PATIENT_INSTRUCTION_ZAMBDA_ID,
          icdSearchZambdaId: import.meta.env.VITE_APP_ICD_SEARCH_ZAMBDA_ID,
          isAppLocal: import.meta.env.VITE_APP_IS_LOCAL,
        },
        zambdaClient,
      );
    return null;
  }, [zambdaClient]);

  return apiClient;
};
