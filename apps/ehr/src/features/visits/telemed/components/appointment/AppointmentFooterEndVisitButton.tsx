import { useAuth0 } from '@auth0/auth0-react';
import { LoadingButton } from '@mui/lab';
import { darken, styled } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback } from 'react';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useGetMeetingData } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import {
  TELEMED_APPOINTMENT_QUERY_KEY,
  useAppointmentData,
} from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useChangeTelemedAppointmentStatusMutation } from 'src/features/visits/shared/stores/tracking-board/tracking-board.queries';
import { TelemedAppointmentStatusEnum } from 'utils';
import { useVideoCallStore } from '../../state/video-call/video-call.store';
import { updateEncounterStatusHistory } from '../../utils/appointments';

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
          data-testid={dataTestIds.telemedEhrFlow.finishVisitButton}
        >
          Finish visit
        </FooterButton>
      )}
    </ConfirmationDialog>
  );
};
