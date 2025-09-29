import { useAuth0 } from '@auth0/auth0-react';
import { LoadingButton } from '@mui/lab';
import { darken, styled } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback } from 'react';
import { TelemedAppointmentStatusEnum } from 'utils';
import { dataTestIds } from '../../../constants/data-test-ids';
import { ConfirmationDialog } from '../../components';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import {
  TELEMED_APPOINTMENT_QUERY_KEY,
  useAppointmentData,
  useChangeTelemedAppointmentStatusMutation,
  useGetMeetingData,
  useVideoCallStore,
} from '../../state';
import { updateEncounterStatusHistory } from '../../utils';

const FooterButton = styled(LoadingButton)(({ theme }) => ({
  textTransform: 'none',
  fontSize: '15px',
  fontWeight: 500,
  borderRadius: 20,
  backgroundColor: theme.palette.error.main,
  '&:hover': { backgroundColor: darken(theme.palette.error.main, 0.125) },
  '&.MuiLoadingButton-loading': {
    backgroundColor: darken(theme.palette.error.main, 0.25),
  },
  '& .MuiLoadingButton-loadingIndicator': {
    color: darken(theme.palette.error.contrastText, 0.25),
  },
}));

export const AppointmentFooterEndVisitButton: FC = () => {
  const { encounter, appointment, isAppointmentLoading, appointmentSetState } = useAppointmentData();
  const queryClient = useQueryClient();
  const apiClient = useOystehrAPIClient();
  const changeTelemedAppointmentStatusMutation = useChangeTelemedAppointmentStatusMutation();
  const { getAccessTokenSilently } = useAuth0();

  const getMeetingData = useGetMeetingData(
    getAccessTokenSilently,
    (data) => {
      useVideoCallStore.setState({ meetingData: data });
    },
    () => {
      enqueueSnackbar('Error trying to connect to a patient.', {
        variant: 'error',
      });
    }
  );

  const onClick = useCallback(async (): Promise<void> => {
    if (apiClient && appointment?.id) {
      await changeTelemedAppointmentStatusMutation
        .mutateAsync({ apiClient, appointmentId: appointment.id, newStatus: TelemedAppointmentStatusEnum.unsigned }, {})
        .catch((error) => {
          console.error(error);
        });
      appointmentSetState({
        encounter: {
          ...encounter,
          status: 'finished',
          statusHistory: updateEncounterStatusHistory('finished', encounter.statusHistory),
        },
      });
      await queryClient.invalidateQueries({ queryKey: [TELEMED_APPOINTMENT_QUERY_KEY] });
      await getMeetingData.refetch();
    }
  }, [
    apiClient,
    appointment?.id,
    changeTelemedAppointmentStatusMutation,
    appointmentSetState,
    encounter,
    queryClient,
    getMeetingData,
  ]);

  return (
    <ConfirmationDialog
      title="Are you sure you want to finish the visit?"
      response={onClick}
      description="It will move to the Unsigned tab on the tracking board."
      actionButtons={{
        proceed: {
          text: 'Finish visit',
        },
        back: { text: 'Cancel' },
      }}
    >
      {(showDialog) => (
        <FooterButton
          loading={changeTelemedAppointmentStatusMutation.isPending || isAppointmentLoading}
          onClick={showDialog}
          variant="contained"
          data-testid={dataTestIds.telemedEhrFlow.footerButtonAssignMe}
        >
          Finish visit
        </FooterButton>
      )}
    </ConfirmationDialog>
  );
  //   }
  //   case 'connectUnassign': {
  //     return (
  //       <Box sx={{ display: 'flex', gap: 1 }}>
  //         <ConfirmationDialog
  //           title="Do you want to connect to the patient?"
  //           description="This action will start the video call."
  //           response={onClick}
  //           actionButtons={{
  //             proceed: {
  //               text: 'Connect to Patient',
  //             },
  //             back: { text: 'Cancel' },
  //           }}
  //         >
  //           {(showDialog) => (
  //             <FooterButton
  //               loading={initTelemedSession.isPending || getMeetingData.isLoading}
  //               onClick={showDialog}
  //               variant="contained"
  //               data-testid={dataTestIds.telemedEhrFlow.footerButtonConnectToPatient}
  //             >
  //               Connect to Patient
  //             </FooterButton>
  //           )}
  //         </ConfirmationDialog>

  //         <ConfirmationDialog
  //           title="Do you want to unassign this appointment?"
  //           response={onUnassign}
  //           actionButtons={{
  //             proceed: {
  //               text: 'Unassign',
  //               color: 'error',
  //             },
  //             back: { text: 'Cancel' },
  //           }}
  //         >
  //           {(showDialog) => (
  //             <FooterButton
  //               loading={changeTelemedAppointmentStatusMutation.isPending}
  //               onClick={showDialog}
  //               variant="contained"
  //               data-testid={dataTestIds.telemedEhrFlow.footerButtonUnassign}
  //               sx={{
  //
  //               }}
  //             >
  //               Unassign
  //             </FooterButton>
  //           )}
  //         </ConfirmationDialog>
  //       </Box>
  //     );
  //   }
  //   case 'reconnect': {
  //     return (
  //       <FooterButton
  //         loading={initTelemedSession.isPending || getMeetingData.isLoading}
  //         onClick={onClick}
  //         variant="contained"
  //       >
  //         Reconnect
  //       </FooterButton>
  //     );
  //   }
  //   default: {
  //     return null;
  //   }
  // }
};
