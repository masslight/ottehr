import { useState } from 'react';
import { getZapEHRAPI, useZambdaClient } from 'ottehr-components';

let _apiClient: ReturnType<typeof getZapEHRAPI> | null;

export const useZapEHRAPIClient = (): ReturnType<typeof getZapEHRAPI> | null => {
  const zambdaClient = useZambdaClient({ tokenless: false });
  const [apiClient, setApiClient] = useState<typeof _apiClient>(_apiClient);

  if (zambdaClient && !apiClient) {
    const client = getZapEHRAPI(
      {
        getPatientsZambdaID: import.meta.env.VITE_APP_GET_PATIENTS_ZAMBDA_ID,
        createAppointmentZambdaID: import.meta.env.VITE_APP_CREATE_APPOINTMENT_ZAMBDA_ID,
        getPaperworkZambdaID: import.meta.env.VITE_APP_GET_PAPERWORK_ZAMBDA_ID,
        updatePaperworkZambdaID: import.meta.env.VITE_APP_UPDATE_PAPERWORK_ZAMBDA_ID,
        getWaitStatusZambdaID: import.meta.env.VITE_APP_GET_WAITING_ROOM_ZAMBDA_ID,
        getPresignedFileURLZambdaID: import.meta.env.VITE_APP_GET_PRESIGNED_FILE_URL_ZAMBDA_ID,
        isAppLocal: import.meta.env.VITE_APP_IS_LOCAL,
      },
      zambdaClient,
    );
    _apiClient = client;
    setApiClient(client);
  }

  return apiClient;
};
