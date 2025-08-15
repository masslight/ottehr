import { useState } from 'react';
import { getOystehrAPI } from 'ui-components';
import { useOystehrClient } from '../../hooks/zambdaClient';

let _apiClient: ReturnType<typeof getOystehrAPI> | null;

const VITE_APP_IS_LOCAL = import.meta.env.VITE_APP_IS_LOCAL;

export const useOystehrAPIClient = (
  { tokenless }: { tokenless: boolean } = { tokenless: false }
): ReturnType<typeof getOystehrAPI> | null => {
  const zambdaClient = useOystehrClient({ tokenless });
  const [apiClient, setApiClient] = useState<typeof _apiClient>(_apiClient);

  if (zambdaClient && !apiClient) {
    const client = getOystehrAPI(
      {
        cancelAppointmentZambdaID: 'telemed-cancel-appointment',
        deletePaymentMethodZambdaID: 'payment-methods-delete',
        getAppointmentsZambdaID: 'telemed-get-appointments',
        getPastVisitsZambdaID: 'get-past-visits',
        getEligibilityZambdaID: 'get-eligibility',
        getVisitDetailsZambdaID: 'get-visit-details',
        getAnswerOptionsZambdaID: 'get-answer-options',
        getPaperworkZambdaID: 'get-paperwork',
        getPatientsZambdaID: 'telemed-get-patients',
        getPaymentMethodsZambdaID: 'payment-methods-list',
        getPresignedFileURLZambdaID: 'get-presigned-file-url',
        getTelemedStatesZambdaID: 'get-telemed-states',
        getWaitStatusZambdaID: 'get-wait-status',
        isAppLocal: VITE_APP_IS_LOCAL as 'true' | 'false' | undefined,
        joinCallZambdaID: 'join-call',
        setDefaultPaymentMethodZambdaID: 'payment-methods-set-default',
        setupPaymentMethodZambdaID: 'payment-methods-setup',
        updateAppointmentZambdaID: 'telemed-update-appointment',
        patchPaperworkZambdaID: 'patch-paperwork',
        submitPaperworkZambdaID: 'submit-paperwork',
        videoChatCancelInviteZambdaID: 'video-chat-invites-cancel',
        videoChatCreateInviteZambdaID: 'video-chat-invites-create',
        videoChatListInvitesZambdaID: 'video-chat-invites-list',
        listBookablesZambdaID: 'list-bookables',
        getScheduleZambdaID: 'get-schedule',
      },
      zambdaClient
    );
    _apiClient = client;
    setApiClient(client);
  }

  return apiClient;
};
