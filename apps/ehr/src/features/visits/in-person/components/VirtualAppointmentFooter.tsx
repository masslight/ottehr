import { useAuth0 } from '@auth0/auth0-react';
import { AppBar, Box, Divider, Link, Stack, Typography, useTheme } from '@mui/material';
import { DateTime, Duration } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import useEvolveUser from 'src/hooks/useEvolveUser';
import {
  diffInMinutes,
  getInPersonVisitStatus,
  getQuestionnaireResponseByLinkId,
  getSelectors,
  getVisitStatusHistory,
  INTERPRETER_PHONE_NUMBER,
  NON_LOS_STATUSES,
  VisitStatusHistoryEntry,
} from 'utils';
import { useOystehrAPIClient } from '../../shared/hooks/useOystehrAPIClient';
import { useGetMeetingData } from '../../shared/stores/appointment/appointment.queries';
import { useInitTelemedSessionMutation } from '../../shared/stores/tracking-board/tracking-board.queries';
import { FooterButton } from '../../telemed/components/appointment/AppointmentFooterButton';
import InviteParticipant from '../../telemed/components/appointment/InviteParticipant';
import { useVideoCallStore } from '../../telemed/state/video-call/video-call.store';

export const VirtualAppointmentFooter: FC = () => {
  const theme = useTheme();
  const [isInviteParticipantOpen, setIsInviteParticipantOpen] = useState(false);
  const appointmentAccessibility = useGetAppointmentAccessibility();
  const { appointment, encounter, mappedData, questionnaireResponse } = useAppointmentData();
  const { meetingData } = getSelectors(useVideoCallStore, ['meetingData']);
  const appointmentStatus = (appointment && getInPersonVisitStatus(appointment, encounter)) ?? 'unknown';
  const statusHistory = getVisitStatusHistory(encounter);
  const arrivedStart = statusHistory.find((status) => status.status === 'arrived')?.period?.start;
  const waitingTime = arrivedStart ? diffInMinutes(DateTime.now(), DateTime.fromISO(arrivedStart)) : 0;

  const preferredLanguage = getQuestionnaireResponseByLinkId('preferred-language', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const delimiterString = preferredLanguage && isSpanish(preferredLanguage) ? `\u00A0|\u00A0` : '';
  const interpreterString =
    preferredLanguage && isSpanish(preferredLanguage) ? `Interpreter: ${INTERPRETER_PHONE_NUMBER}` : '';
  const relayPhone = getQuestionnaireResponseByLinkId('relay-phone', questionnaireResponse)?.answer?.[0]?.valueString;
  const patientPhoneNumber =
    getQuestionnaireResponseByLinkId('patient-number', questionnaireResponse)?.answer?.[0]?.valueString ||
    getQuestionnaireResponseByLinkId('guardian-number', questionnaireResponse)?.answer?.[0]?.valueString;

  const visitDuration = Duration.fromMillis(
    statusHistory
      .filter((status) => !NON_LOS_STATUSES.includes(status.status))
      .reduce((accumulator, statusTemp) => {
        return accumulator + statusDurationMillis(statusTemp);
      }, 0)
  ).toFormat('mm:ss');

  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();
  const { getAccessTokenSilently } = useAuth0();
  const initTelemedSession = useInitTelemedSessionMutation();
  const getMeetingData = useGetMeetingData(
    getAccessTokenSilently,
    () => {},
    () => {
      enqueueSnackbar('Error trying to connect to a patient.', {
        variant: 'error',
      });
    }
  );
  const onConnect = useCallback(async (): Promise<void> => {
    if (appointmentStatus === 'provider') {
      const meetingDataResponse = await getMeetingData.refetch({ throwOnError: true });
      useVideoCallStore.setState({
        meetingData: meetingDataResponse.data,
      });
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
          },
          onError: () => {
            enqueueSnackbar('Error trying to connect to a patient.', {
              variant: 'error',
            });
          },
        }
      );
    }
  }, [apiClient, appointment?.id, appointmentStatus, getMeetingData, initTelemedSession, user]);

  return (
    <AppBar
      position="sticky"
      sx={{
        top: 'auto',
        bottom: 0,
        backgroundColor: theme.palette.primary.dark,
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
      data-testid={dataTestIds.telemedEhrFlow.appointmentChartFooter}
    >
      {isInviteParticipantOpen && (
        <InviteParticipant modalOpen={isInviteParticipantOpen} onClose={() => setIsInviteParticipantOpen(false)} />
      )}
      <Stack direction="row" justifyContent="space-between" padding={2}>
        <Stack
          direction="row"
          flexGrow={1}
          spacing={3}
          divider={<Divider variant="middle" orientation="vertical" sx={{ borderColor: '#FFFFFF4D' }} flexItem />}
        >
          {['arrived', 'ready', 'intake', 'ready for provider', 'provider'].includes(appointmentStatus) &&
            !meetingData && (
              <Box>
                <Typography variant="body1" style={{ fontWeight: 500 }}>
                  {mappedData.firstName} {mappedData.lastName} is waiting
                </Typography>
                <Typography variant="body2">{waitingTime} mins</Typography>
              </Box>
            )}
          <Box>
            <Typography variant="subtitle2">Preferred Language</Typography>
            <Typography variant="body2">
              {preferredLanguage} {delimiterString} {interpreterString}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2">Hearing Impaired Relay Service? (711)</Typography>
            <Typography variant="body2">{relayPhone}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2">Patient number</Typography>
            <Typography variant="body2">
              <Link sx={{ color: 'inherit' }} component={RouterLink} to={`tel:${patientPhoneNumber}`} variant="body2">
                {patientPhoneNumber}
              </Link>
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center">
          {['arrived', 'ready', 'intake', 'ready for provider', 'provider'].includes(appointmentStatus) &&
            appointmentAccessibility.isPractitionerLicensedInState && (
              <FooterButton
                onClick={() => setIsInviteParticipantOpen(true)}
                variant="contained"
                sx={{ backgroundColor: 'transparent', border: '1px solid white' }}
              >
                Invite participant
              </FooterButton>
            )}
          {['arrived', 'ready', 'intake', 'ready for provider', 'provider'].includes(appointmentStatus) &&
            appointmentAccessibility.isPractitionerLicensedInState &&
            !meetingData && (
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
              </Box>
            )}
          {['discharged', 'awaiting supervisor approval', 'completed'].includes(appointmentStatus) && (
            <Typography variant="body1">Visit ended. {visitDuration ? `Duration ${visitDuration}` : null}</Typography>
          )}
        </Stack>
      </Stack>
    </AppBar>
  );
};

function isSpanish(language: string): boolean {
  return language.toLowerCase() === 'Spanish'.toLowerCase();
}

function statusDurationMillis(statusEntry: VisitStatusHistoryEntry): number {
  if (statusEntry.period.start && statusEntry.period.end) {
    return Math.floor(
      DateTime.fromISO(statusEntry.period.end).diff(DateTime.fromISO(statusEntry.period.start), 'milliseconds')
        .milliseconds
    );
  } else if (statusEntry.period.start) {
    return Math.floor(DateTime.now().diff(DateTime.fromISO(statusEntry.period.start), 'milliseconds').milliseconds);
  }
  return 0;
}
