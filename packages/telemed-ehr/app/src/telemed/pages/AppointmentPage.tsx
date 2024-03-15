import React, { FC, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  useAppointmentStore,
  useGetTelemedAppointment,
  useGetVideoToken,
  useInitTelemedSessionMutation,
  useVideoCallStore,
} from '../state';
import { getSelectors } from '../../shared/store/getSelectors';
import { Appointment, Encounter, FhirResource, Location, Patient, QuestionnaireResponse } from 'fhir/r4';
import { Box, Button, Card, Container, Divider, Typography, useTheme } from '@mui/material';
import { AppointmentHeader, AppointmentTabs, VideoChatContainer } from '../components';
import { LoadingButton } from '@mui/lab';
import { useZapEHRTelemedAPIClient } from '../hooks/useZapEHRAPIClient';
import { useCommonStore } from '../../state/common.store';
import { useAuth0 } from '@auth0/auth0-react';
import { ApptStatus, mapStatusToTelemed } from '../utils';

export const AppointmentPage: FC = () => {
  const theme = useTheme();
  const { id } = useParams();
  const { getAccessTokenSilently } = useAuth0();

  const { appointment, encounter } = getSelectors(useAppointmentStore, [
    'appointment',
    'patient',
    'location',
    'encounter',
    'questionnaireResponse',
  ]);
  const { videoToken } = getSelectors(useVideoCallStore, ['videoToken']);

  const { isFetching } = useGetTelemedAppointment(
    {
      appointmentId: id,
    },
    (data) => {
      useAppointmentStore.setState({
        appointment: data?.find(
          (resource: FhirResource) => resource.resourceType === 'Appointment',
        ) as any as Appointment,
        patient: data?.find((resource: FhirResource) => resource.resourceType === 'Patient') as any as Patient,
        location: data?.find((resource: FhirResource) => resource.resourceType === 'Location') as any as Location,
        encounter: data?.find((resource: FhirResource) => resource.resourceType === 'Encounter') as any as Encounter,
        questionnaireResponse: data?.find(
          (resource: FhirResource) => resource.resourceType === 'QuestionnaireResponse',
        ) as any as QuestionnaireResponse,
      });
    },
  );

  useEffect(() => {
    useAppointmentStore.setState({ isAppointmentLoading: isFetching });
  }, [isFetching]);

  const commonState = useCommonStore.getState();
  const apiClient = useZapEHRTelemedAPIClient();
  const initTelemedSession = useInitTelemedSessionMutation();
  const getVideoToken = useGetVideoToken(getAccessTokenSilently, (data) => {
    useVideoCallStore.setState({ videoToken: data.token });
  });

  const onClick = (): void => {
    if (mapStatusToTelemed(encounter.status, appointment?.status) === ApptStatus['on-video']) {
      loadVideoToken();
    } else {
      initVideo();
    }
  };

  const initVideo = (): void => {
    if (!apiClient || !commonState.user || !appointment?.id) {
      throw new Error('api client not defined or userId not provided');
    }
    initTelemedSession.mutate(
      { apiClient, appointmentId: appointment.id, userId: commonState.user?.id },
      {
        onSuccess: async (response) => {
          useVideoCallStore.setState({
            videoToken: response.videoToken,
            videoRoomId: response.videoRoomId,
            encounterId: response.encounterId,
          });
          useAppointmentStore.setState({
            encounter: { ...encounter, status: 'in-progress' },
          });
        },
        onError: (error) => {
          throw error;
        },
      },
    );
  };

  const loadVideoToken = (): void => {
    void getVideoToken.refetch();
  };

  return (
    <Box>
      <AppointmentHeader />

      {videoToken && <VideoChatContainer />}

      <Container maxWidth="xl" sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Card sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, backgroundColor: '#4D15B714' }}>
          {!videoToken && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="h4" color="primary.dark">
                  Patient waiting
                </Typography>
                <Typography variant="body2" color={theme.palette.secondary.light}>
                  11 mins
                </Typography>
              </Box>
              <LoadingButton
                loading={initTelemedSession.isLoading || getVideoToken.isLoading}
                onClick={onClick}
                variant="contained"
                sx={{ textTransform: 'none', fontSize: '15px', fontWeight: 700, borderRadius: 10 }}
              >
                Connect to Patient
              </LoadingButton>
            </Box>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Box>
                <Typography color="primary.dark" sx={{ fontSize: '12px', fontWeight: 700 }}>
                  Preferred Language
                </Typography>
                <Typography>English</Typography>
              </Box>
              <Divider orientation="vertical" variant="fullWidth" flexItem sx={{ borderColor: '#4D15B74D' }} />
              <Box>
                <Typography color="primary.dark" sx={{ fontSize: '12px', fontWeight: 700 }}>
                  Hearing Impaired Relay Service? (711)
                </Typography>
                <Typography>No</Typography>
              </Box>
              <Divider orientation="vertical" variant="fullWidth" flexItem sx={{ borderColor: '#4D15B74D' }} />
              <Box>
                <Typography color="primary.dark" sx={{ fontSize: '12px', fontWeight: 700 }}>
                  Patient number
                </Typography>
                <Typography>(123) 456-7890</Typography>
              </Box>
            </Box>
            <Button
              variant="outlined"
              sx={{ textTransform: 'none', fontSize: '14px', fontWeight: 700, borderRadius: 10 }}
            >
              Invite participant
            </Button>
          </Box>
        </Card>

        <AppointmentTabs />
      </Container>
    </Box>
  );
};
