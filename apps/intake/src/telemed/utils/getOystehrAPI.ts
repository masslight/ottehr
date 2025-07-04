import { useState } from 'react';
import { getOystehrAPI } from 'ui-components';
import { useOystehrClient } from '../../hooks/zambdaClient';

let _apiClient: ReturnType<typeof getOystehrAPI> | null;

export const useOystehrAPIClient = (
  { tokenless }: { tokenless: boolean } = { tokenless: false }
): ReturnType<typeof getOystehrAPI> | null => {
  const {
    VITE_APP_TELEMED_CANCEL_APPOINTMENT_ZAMBDA_ID,
    VITE_APP_CREATE_PAPERWORK_ZAMBDA_ID,
    VITE_APP_DELETE_PAYMENT_METHOD_ZAMBDA_ID,
    VITE_APP_TELEMED_GET_APPOINTMENTS_ZAMBDA_ID,
    VITE_APP_GET_PAST_VISITS_ZAMBDA_ID,
    VITE_APP_GET_ELIGIBILITY_ZAMBDA_ID,
    VITE_APP_GET_VISIT_DETAILS_ZAMBDA_ID,
    VITE_APP_GET_ANSWER_OPTIONS_ZAMBDA_ID,
    VITE_APP_GET_PAPERWORK_ZAMBDA_ID,
    VITE_APP_TELEMED_GET_PATIENTS_ZAMBDA_ID,
    VITE_APP_GET_PAYMENT_METHODS_ZAMBDA_ID,
    VITE_APP_GET_PRESIGNED_FILE_URL_ZAMBDA_ID,
    VITE_APP_GET_TELEMED_STATES_ZAMBDA_ID,
    VITE_APP_GET_WAITING_ROOM_ZAMBDA_ID,
    VITE_APP_IS_LOCAL,
    VITE_APP_JOIN_CALL_ZAMBDA_ID,
    VITE_APP_SET_DEFAULT_PAYMENT_METHOD_ZAMBDA_ID,
    VITE_APP_SETUP_PAYMENT_METHOD_ZAMBDA_ID,
    VITE_APP_TELEMED_UPDATE_APPOINTMENT_ZAMBDA_ID,
    VITE_APP_PATCH_PAPERWORK_ZAMBDA_ID,
    VITE_APP_SUBMIT_PAPERWORK_ZAMBDA_ID,
    VITE_APP_VIDEO_CHAT_CANCEL_INVITE_ZAMBDA_ID,
    VITE_APP_VIDEO_CHAT_CREATE_INVITE_ZAMBDA_ID,
    VITE_APP_VIDEO_CHAT_LIST_INVITES_ZAMBDA_ID,
    VITE_APP_LIST_BOOKABLES_ZAMBDA_ID,
    VITE_APP_GET_SCHEDULE_ZAMBDA_ID,
  } = import.meta.env;

  const zambdaClient = useOystehrClient({ tokenless });
  const [apiClient, setApiClient] = useState<typeof _apiClient>(_apiClient);

  if (zambdaClient && !apiClient) {
    const client = getOystehrAPI(
      {
        cancelAppointmentZambdaID: VITE_APP_TELEMED_CANCEL_APPOINTMENT_ZAMBDA_ID,
        createPaperworkZambdaID: VITE_APP_CREATE_PAPERWORK_ZAMBDA_ID,
        deletePaymentMethodZambdaID: VITE_APP_DELETE_PAYMENT_METHOD_ZAMBDA_ID,
        getAppointmentsZambdaID: VITE_APP_TELEMED_GET_APPOINTMENTS_ZAMBDA_ID,
        getPastVisitsZambdaID: VITE_APP_GET_PAST_VISITS_ZAMBDA_ID,
        getEligibilityZambdaID: VITE_APP_GET_ELIGIBILITY_ZAMBDA_ID,
        getVisitDetailsZambdaID: VITE_APP_GET_VISIT_DETAILS_ZAMBDA_ID,
        getAnswerOptionsZambdaID: VITE_APP_GET_ANSWER_OPTIONS_ZAMBDA_ID,
        getPaperworkZambdaID: VITE_APP_GET_PAPERWORK_ZAMBDA_ID,
        getPatientsZambdaID: VITE_APP_TELEMED_GET_PATIENTS_ZAMBDA_ID,
        getPaymentMethodsZambdaID: VITE_APP_GET_PAYMENT_METHODS_ZAMBDA_ID,
        getPresignedFileURLZambdaID: VITE_APP_GET_PRESIGNED_FILE_URL_ZAMBDA_ID,
        getTelemedStatesZambdaID: VITE_APP_GET_TELEMED_STATES_ZAMBDA_ID,
        getWaitStatusZambdaID: VITE_APP_GET_WAITING_ROOM_ZAMBDA_ID,
        isAppLocal: VITE_APP_IS_LOCAL as 'true' | 'false' | undefined,
        joinCallZambdaID: VITE_APP_JOIN_CALL_ZAMBDA_ID,
        setDefaultPaymentMethodZambdaID: VITE_APP_SET_DEFAULT_PAYMENT_METHOD_ZAMBDA_ID,
        setupPaymentMethodZambdaID: VITE_APP_SETUP_PAYMENT_METHOD_ZAMBDA_ID,
        updateAppointmentZambdaID: VITE_APP_TELEMED_UPDATE_APPOINTMENT_ZAMBDA_ID,
        patchPaperworkZambdaID: VITE_APP_PATCH_PAPERWORK_ZAMBDA_ID,
        submitPaperworkZambdaID: VITE_APP_SUBMIT_PAPERWORK_ZAMBDA_ID,
        videoChatCancelInviteZambdaID: VITE_APP_VIDEO_CHAT_CANCEL_INVITE_ZAMBDA_ID,
        videoChatCreateInviteZambdaID: VITE_APP_VIDEO_CHAT_CREATE_INVITE_ZAMBDA_ID,
        videoChatListInvitesZambdaID: VITE_APP_VIDEO_CHAT_LIST_INVITES_ZAMBDA_ID,
        listBookablesZambdaID: VITE_APP_LIST_BOOKABLES_ZAMBDA_ID,
        getScheduleZambdaID: VITE_APP_GET_SCHEDULE_ZAMBDA_ID,
      },
      zambdaClient
    );
    _apiClient = client;
    setApiClient(client);
  }

  return apiClient;
};
