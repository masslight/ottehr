import Oystehr from '@oystehr/sdk';
import { useMemo } from 'react';
import { useClient } from 'src/providers/intakeOysterClientProvider';
import { getOystehrAPI } from 'ui-components';

const VITE_APP_IS_LOCAL = import.meta.env.VITE_APP_IS_LOCAL;

export const useOystehrAPIClient = (
  { tokenless }: { tokenless: boolean } = { tokenless: false }
): ReturnType<typeof getOystehrAPI> | null => {
  const client = useClient({ tokenless });

  return useMemo(() => {
    return client ? makeOystehrAPI(client) : null;
  }, [client]);
};

const makeOystehrAPI = (zambdaClient: Oystehr): ReturnType<typeof getOystehrAPI> =>
  getOystehrAPI(
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
      getTelemedLocationsZambdaID: 'get-telemed-locations',
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
