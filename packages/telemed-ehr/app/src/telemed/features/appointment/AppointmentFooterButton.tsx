import { FC, useCallback, useEffect, useState } from 'react';
import { LoadingButton } from '@mui/lab';
import { Box, darken, useTheme } from '@mui/material';
import { useQueryClient } from 'react-query';
import { useAuth0 } from '@auth0/auth0-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApptStatus, mapStatusToTelemed } from 'ehr-utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import {
  useAppointmentStore,
  useChangeTelemedAppointmentStatusMutation,
  useGetMeetingData,
  useInitTelemedSessionMutation,
  useVideoCallStore,
} from '../../state';
import useOttehrUser from '../../../hooks/useOttehrUser';
import { useZapEHRAPIClient } from '../../hooks/useZapEHRAPIClient';
import { ConfirmationDialog } from '../../components';
import { useGetAppointmentAccessibility } from '../../hooks';

type AppointmentFooterButtonProps = {
  setError: (error: string) => void;
};

export const AppointmentFooterButton: FC<AppointmentFooterButtonProps> = (props) => {
  const { setError } = props;

  const { encounter, appointment, isAppointmentLoading } = getSelectors(useAppointmentStore, [
    'encounter',
    'appointment',
    'isAppointmentLoading',
  ]);
  const user = useOttehrUser();
  const { getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const apiClient = useZapEHRAPIClient();
  const changeTelemedAppointmentStatus = useChangeTelemedAppointmentStatusMutation();
  const initTelemedSession = useInitTelemedSessionMutation();
  const getMeetingData = useGetMeetingData(
    getAccessTokenSilently,
    (data) => {
      useVideoCallStore.setState({ meetingData: data });
    },
    () => {
      setError('Error trying to connect to a patient.');
    }
  );

  const [buttonType, setButtonType] = useState<string | null>(null);

  const appointmentAccessibility = useGetAppointmentAccessibility();

  useEffect(() => {
    if (appointmentAccessibility.status !== ApptStatus.ready && !appointmentAccessibility.isStatusEditable) {
      setButtonType(null);
    } else if (
      appointmentAccessibility.isAppointmentAvailable &&
      appointmentAccessibility.status === ApptStatus.ready
    ) {
      setButtonType('assignMe');
    } else if (
      appointmentAccessibility.isAppointmentAvailable &&
      appointmentAccessibility.status === ApptStatus['pre-video']
    ) {
      setButtonType('connectUnassign');
    } else if (
      appointmentAccessibility.isAppointmentAvailable &&
      appointmentAccessibility.status === ApptStatus['on-video']
    ) {
      setButtonType('reconnect');
    }
  }, [appointmentAccessibility]);

  const onAssignMe = async (): Promise<void> => {
    if (!apiClient || !appointment?.id) {
      throw new Error('api client not defined or appointment id not provided');
    }
    await changeTelemedAppointmentStatus.mutateAsync(
      { apiClient, appointmentId: appointment.id, newStatus: ApptStatus['pre-video'] },
      {}
    );
    await queryClient.invalidateQueries({ queryKey: ['telemed-appointment'] });
  };

  const onConnect = useCallback((): void => {
    if (mapStatusToTelemed(encounter.status, appointment?.status) === ApptStatus['on-video']) {
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
              encounter: { ...encounter, status: 'in-progress' },
            });
          },
          onError: () => {
            setError('Error trying to connect to a patient.');
          },
        }
      );
    }
  }, [apiClient, appointment?.id, appointment?.status, encounter, getMeetingData, initTelemedSession, setError, user]);

  useEffect(() => {
    if (appointmentAccessibility.isAppointmentAvailable && appointmentAccessibility.status === ApptStatus['on-video']) {
      if (location.state?.reconnect) {
        navigate(location.pathname, {});
        onConnect();
      }
    }
  }, [appointmentAccessibility.isAppointmentAvailable, appointmentAccessibility.status, location, navigate, onConnect]);

  const onUnassign = async (): Promise<void> => {
    if (!apiClient || !appointment?.id) {
      throw new Error('api client not defined or appointment id not provided');
    }
    await changeTelemedAppointmentStatus.mutateAsync(
      { apiClient, appointmentId: appointment.id, newStatus: ApptStatus.ready },
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
              text: 'Assign to me',
            },
            back: { text: 'Cancel' },
          }}
        >
          {(showDialog) => (
            <LoadingButton
              loading={changeTelemedAppointmentStatus.isLoading || isAppointmentLoading}
              onClick={showDialog}
              variant="contained"
              sx={{
                textTransform: 'none',
                fontSize: '15px',
                fontWeight: 700,
                borderRadius: 10,
                backgroundColor: theme.palette.primary.light,
                '&:hover': { backgroundColor: darken(theme.palette.primary.light, 0.125) },
              }}
            >
              Assign to me
            </LoadingButton>
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
              <LoadingButton
                loading={initTelemedSession.isLoading || getMeetingData.isLoading}
                onClick={showDialog}
                variant="contained"
                sx={{
                  textTransform: 'none',
                  fontSize: '15px',
                  fontWeight: 700,
                  borderRadius: 10,
                  backgroundColor: theme.palette.primary.light,
                  '&:hover': { backgroundColor: darken(theme.palette.primary.light, 0.125) },
                }}
              >
                Connect to Patient
              </LoadingButton>
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
              <LoadingButton
                loading={changeTelemedAppointmentStatus.isLoading}
                onClick={showDialog}
                variant="contained"
                sx={{
                  textTransform: 'none',
                  fontSize: '15px',
                  fontWeight: 700,
                  borderRadius: 10,
                  backgroundColor: theme.palette.error.main,
                  '&:hover': { backgroundColor: darken(theme.palette.error.main, 0.125) },
                }}
              >
                Unassign
              </LoadingButton>
            )}
          </ConfirmationDialog>
        </Box>
      );
    }
    case 'reconnect': {
      return (
        <LoadingButton
          loading={initTelemedSession.isLoading || getMeetingData.isLoading}
          onClick={onConnect}
          variant="contained"
          sx={{
            textTransform: 'none',
            fontSize: '15px',
            fontWeight: 700,
            borderRadius: 10,
            backgroundColor: theme.palette.primary.light,
            '&:hover': { backgroundColor: darken(theme.palette.primary.light, 0.125) },
          }}
        >
          Reconnect
        </LoadingButton>
      );
    }
    default: {
      return null;
    }
  }
};
