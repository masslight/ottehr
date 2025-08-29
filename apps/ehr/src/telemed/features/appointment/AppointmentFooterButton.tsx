import { useAuth0 } from '@auth0/auth0-react';
import { LoadingButton } from '@mui/lab';
import { Box, darken, styled, useTheme } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { mapStatusToTelemed, TelemedAppointmentStatusEnum } from 'utils';
import { dataTestIds } from '../../../constants/data-test-ids';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { ConfirmationDialog } from '../../components';
import { useGetAppointmentAccessibility } from '../../hooks';
import { useOystehrAPIClient } from '../../hooks/useOystehrAPIClient';
import {
  TELEMED_APPOINTMENT_QUERY_KEY,
  useAppointmentData,
  useChangeTelemedAppointmentStatusMutation,
  useGetMeetingData,
  useInitTelemedSessionMutation,
  useVideoCallStore,
} from '../../state';
import { updateEncounterStatusHistory } from '../../utils';

const FooterButton = styled(LoadingButton)(({ theme }) => ({
  textTransform: 'none',
  fontSize: '15px',
  fontWeight: 500,
  borderRadius: 20,
  backgroundColor: theme.palette.primary.light,
  '&:hover': { backgroundColor: darken(theme.palette.primary.light, 0.125) },
  '&.MuiLoadingButton-loading': {
    backgroundColor: darken(theme.palette.primary.light, 0.25),
  },
  '& .MuiLoadingButton-loadingIndicator': {
    color: darken(theme.palette.primary.contrastText, 0.25),
  },
}));

export const AppointmentFooterButton: FC = () => {
  const { encounter, appointment, isAppointmentLoading, appointmentSetState } = useAppointmentData();
  const user = useEvolveUser();
  const { getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const apiClient = useOystehrAPIClient();
  const changeTelemedAppointmentStatusEnum = useChangeTelemedAppointmentStatusMutation();
  const initTelemedSession = useInitTelemedSessionMutation();
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

  const [buttonType, setButtonType] = useState<'assignMe' | 'connectUnassign' | 'reconnect' | null>(null);

  const appointmentAccessibility = useGetAppointmentAccessibility();

  useEffect(() => {
    if (
      appointmentAccessibility.status !== TelemedAppointmentStatusEnum.ready &&
      !appointmentAccessibility.isStatusEditable
    ) {
      setButtonType(null);
    } else if (
      appointmentAccessibility.isCurrentUserHasAccessToAppointment &&
      appointmentAccessibility.status === TelemedAppointmentStatusEnum.ready
    ) {
      setButtonType('assignMe');
    } else if (
      appointmentAccessibility.isCurrentUserHasAccessToAppointment &&
      appointmentAccessibility.status === TelemedAppointmentStatusEnum['pre-video']
    ) {
      setButtonType('connectUnassign');
    } else if (
      appointmentAccessibility.isCurrentUserHasAccessToAppointment &&
      appointmentAccessibility.status === TelemedAppointmentStatusEnum['on-video']
    ) {
      setButtonType('reconnect');
    }
  }, [appointmentAccessibility]);

  const onAssignMe = async (): Promise<void> => {
    if (!apiClient || !appointment?.id) {
      throw new Error('api client not defined or appointment id not provided');
    }
    await changeTelemedAppointmentStatusEnum.mutateAsync(
      { apiClient, appointmentId: appointment.id, newStatus: TelemedAppointmentStatusEnum['pre-video'] },
      {}
    );

    await queryClient.invalidateQueries({ queryKey: [TELEMED_APPOINTMENT_QUERY_KEY] });
  };

  const onConnect = useCallback((): void => {
    if (mapStatusToTelemed(encounter.status, appointment?.status) === TelemedAppointmentStatusEnum['on-video']) {
      void getMeetingData.refetch({ throwOnError: true });
    } else {
      if (!apiClient || !user || !appointment?.id) {
        throw new Error('api client not defined or userId not provided');
      }
      initTelemedSession.mutate(
        { apiClient, appointmentId: appointment.id, userId: user?.id },
        {
          onSuccess: async (response) => {
            useVideoCallStore.setState({
              meetingData: response.meetingData,
            });
            appointmentSetState({
              encounter: {
                ...encounter,
                status: 'in-progress',
                statusHistory: updateEncounterStatusHistory('in-progress', encounter.statusHistory),
              },
            });
          },
          onError: () => {
            enqueueSnackbar('Error trying to connect to a patient.', {
              variant: 'error',
            });
          },
        }
      );
    }
  }, [
    apiClient,
    appointment?.id,
    appointment?.status,
    encounter,
    getMeetingData,
    initTelemedSession,
    user,
    appointmentSetState,
  ]);

  useEffect(() => {
    if (
      appointmentAccessibility.isCurrentUserHasAccessToAppointment &&
      appointmentAccessibility.status === TelemedAppointmentStatusEnum['on-video']
    ) {
      if (location.state?.reconnect) {
        navigate(location.pathname, {});
        onConnect();
      }
    }
  }, [
    appointmentAccessibility.isCurrentUserHasAccessToAppointment,
    appointmentAccessibility.status,
    location,
    navigate,
    onConnect,
  ]);

  const onUnassign = async (): Promise<void> => {
    if (!apiClient || !appointment?.id) {
      throw new Error('api client not defined or appointment id not provided');
    }
    await changeTelemedAppointmentStatusEnum.mutateAsync(
      { apiClient, appointmentId: appointment.id, newStatus: TelemedAppointmentStatusEnum.ready },
      {}
    );
    navigate('/telemed/appointments');
  };

  switch (buttonType) {
    case 'assignMe': {
      return (
        <ConfirmationDialog
          title="Do you want to assign this appointment?"
          response={onAssignMe}
          actionButtons={{
            proceed: {
              text: 'Assign me',
            },
            back: { text: 'Cancel' },
          }}
        >
          {(showDialog) => (
            <FooterButton
              loading={changeTelemedAppointmentStatusEnum.isPending || isAppointmentLoading}
              onClick={showDialog}
              variant="contained"
              data-testid={dataTestIds.telemedEhrFlow.footerButtonAssignMe}
            >
              Assign to me
            </FooterButton>
          )}
        </ConfirmationDialog>
      );
    }
    case 'connectUnassign': {
      return (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <ConfirmationDialog
            title="Do you want to connect to the patient?"
            description="This action will start the video call."
            response={onConnect}
            actionButtons={{
              proceed: {
                text: 'Connect to Patient',
              },
              back: { text: 'Cancel' },
            }}
          >
            {(showDialog) => (
              <FooterButton
                loading={initTelemedSession.isPending || getMeetingData.isLoading}
                onClick={showDialog}
                variant="contained"
                data-testid={dataTestIds.telemedEhrFlow.footerButtonConnectToPatient}
              >
                Connect to Patient
              </FooterButton>
            )}
          </ConfirmationDialog>

          <ConfirmationDialog
            title="Do you want to unassign this appointment?"
            response={onUnassign}
            actionButtons={{
              proceed: {
                text: 'Unassign',
                color: 'error',
              },
              back: { text: 'Cancel' },
            }}
          >
            {(showDialog) => (
              <FooterButton
                loading={changeTelemedAppointmentStatusEnum.isPending}
                onClick={showDialog}
                variant="contained"
                data-testid={dataTestIds.telemedEhrFlow.footerButtonUnassign}
                sx={{
                  backgroundColor: theme.palette.error.main,
                  '&:hover': { backgroundColor: darken(theme.palette.error.main, 0.125) },
                  '&.MuiLoadingButton-loading': {
                    backgroundColor: darken(theme.palette.error.main, 0.25),
                  },
                  '& .MuiLoadingButton-loadingIndicator': {
                    color: darken(theme.palette.error.contrastText, 0.25),
                  },
                }}
              >
                Unassign
              </FooterButton>
            )}
          </ConfirmationDialog>
        </Box>
      );
    }
    case 'reconnect': {
      return (
        <FooterButton
          loading={initTelemedSession.isPending || getMeetingData.isLoading}
          onClick={onConnect}
          variant="contained"
        >
          Reconnect
        </FooterButton>
      );
    }
    default: {
      return null;
    }
  }
};
