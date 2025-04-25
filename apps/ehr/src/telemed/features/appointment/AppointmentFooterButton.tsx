import { useAuth0 } from '@auth0/auth0-react';
import { LoadingButton } from '@mui/lab';
import { Box, darken, styled, useTheme } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useState } from 'react';
import { useQueryClient } from 'react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { TelemedAppointmentStatusEnum, mapStatusToTelemed } from 'utils';
import useEvolveUser from '../../../hooks/useEvolveUser';
import { getSelectors } from '../../../shared/store/getSelectors';
import { ConfirmationDialog } from '../../components';
import { useGetAppointmentAccessibility } from '../../hooks';
import { useZapEHRAPIClient } from '../../hooks/useOystehrAPIClient';
import {
  useAppointmentStore,
  useChangeTelemedAppointmentStatusMutation,
  useGetMeetingData,
  useInitTelemedSessionMutation,
  useVideoCallStore,
} from '../../state';
import { updateEncounterStatusHistory } from '../../utils';
import { dataTestIds } from '../../../constants/data-test-ids';

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
  const { encounter, appointment, isAppointmentLoading } = getSelectors(useAppointmentStore, [
    'encounter',
    'appointment',
    'isAppointmentLoading',
  ]);
  const user = useEvolveUser();
  const { getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const apiClient = useZapEHRAPIClient();
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

    await queryClient.invalidateQueries({ queryKey: ['telemed-appointment'] });
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
            useAppointmentStore.setState({
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
  }, [apiClient, appointment?.id, appointment?.status, encounter, getMeetingData, initTelemedSession, user]);

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
              loading={changeTelemedAppointmentStatusEnum.isLoading || isAppointmentLoading}
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
                loading={initTelemedSession.isLoading || getMeetingData.isLoading}
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
                loading={changeTelemedAppointmentStatusEnum.isLoading}
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
          loading={initTelemedSession.isLoading || getMeetingData.isLoading}
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
