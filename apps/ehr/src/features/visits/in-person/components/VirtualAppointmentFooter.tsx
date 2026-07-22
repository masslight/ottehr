import { useAuth0 } from '@auth0/auth0-react';
import { LoadingButton } from '@mui/lab';
import { AppBar, Box, darken, Divider, Link, Stack, styled, Typography, useTheme } from '@mui/material';
import { DateTime, Duration } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { ConfirmationDialog } from 'src/components/ConfirmationDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { handleChangeInPersonVisitStatus } from 'src/helpers/inPersonVisitStatusUtils';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import {
  diffInMinutes,
  getInPersonVisitStatus,
  getQuestionnaireResponseByLinkId,
  getSelectors,
  getVirtualServiceResourceExtension,
  getVisitStatusHistory,
  INTERPRETER_PHONE_NUMBER,
  TELEMED_VIDEO_ROOM_CODE,
  VisitStatusHistoryEntry,
} from 'utils';
import { useOystehrAPIClient } from '../../shared/hooks/useOystehrAPIClient';
import { useGetMeetingData } from '../../shared/stores/appointment/appointment.queries';
import { useInitTelemedSessionMutation } from '../../shared/stores/tracking-board/tracking-board.queries';
import InviteParticipant from '../../telemed/components/appointment/InviteParticipant';
import { useVideoCallStore } from '../../telemed/state/video-call/video-call.store';

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

export const VirtualAppointmentFooter: FC = () => {
  const theme = useTheme();
  const [isInviteParticipantOpen, setIsInviteParticipantOpen] = useState(false);
  // True while onConnect is provisioning/joining the room, so the confirmation dialog's proceed button
  // (and the footer button) can show a loader until the video call is ready.
  const [isConnecting, setIsConnecting] = useState(false);
  const appointmentAccessibility = useGetAppointmentAccessibility();
  const { appointment, encounter, mappedData, questionnaireResponse, appointmentRefetch } = useAppointmentData();
  const { meetingData } = getSelectors(useVideoCallStore, ['meetingData']);
  const appointmentStatus = (appointment && getInPersonVisitStatus(appointment, encounter)) ?? 'unknown';
  const isActiveVisitStatus = ['arrived', 'ready', 'intake', 'ready for provider', 'provider'].includes(
    appointmentStatus
  );
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
      .filter((status) => status.status === 'provider')
      .reduce((accumulator, statusTemp) => {
        return accumulator + statusDurationMillis(statusTemp);
      }, 0)
  ).toFormat('mm:ss');

  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();
  const { getAccessTokenSilently } = useAuth0();
  const initTelemedSession = useInitTelemedSessionMutation();
  // Errors are handled inside onConnect's own try/catch (so we can transparently re-provision a dead
  // room instead of surfacing a toast); keep this a no-op to avoid a duplicate error snackbar.
  const getMeetingData = useGetMeetingData(
    getAccessTokenSilently,
    () => {},
    () => {}
  );
  const { oystehrZambda } = useApiClients();

  const reprovisionRoomAndConnect = useCallback(async (): Promise<void> => {
    if (!apiClient || !user || !appointment?.id || !encounter.id) {
      throw new Error('apiClient or user or appointment.id or encounter.id is undefined');
    }
    const encounterId = encounter.id;
    const statusAlreadyProvider = appointmentStatus === 'provider';
    // init-telemed-session always creates a fresh Chime room and Oystehr replaces the addressString on
    // the encounter, so this both starts the first call and restarts one after hang-up / room timeout.
    const response = await initTelemedSession.mutateAsync({
      apiClient,
      appointmentId: appointment.id,
      userId: user.id,
    });
    useVideoCallStore.setState({ meetingData: response.meetingData });
    if (!statusAlreadyProvider) {
      await handleChangeInPersonVisitStatus({ encounterId, updatedStatus: 'provider' }, oystehrZambda);
    }
    await appointmentRefetch();
  }, [
    apiClient,
    appointment?.id,
    appointmentRefetch,
    appointmentStatus,
    encounter.id,
    initTelemedSession,
    oystehrZambda,
    user,
  ]);

  const onConnect = useCallback(async (): Promise<void> => {
    // Self-heal: status can advance to 'provider' without a provisioned Chime room
    // (e.g., when set via ChangeStatusDropdown). If addressString is missing we
    // can't just refetch the meeting token — Oystehr will 400 with code 4006.
    // Fall through to initTelemedSession so the room is provisioned on demand.
    const vsExt = encounter ? getVirtualServiceResourceExtension(encounter, TELEMED_VIDEO_ROOM_CODE) : null;
    const hasRoom = (vsExt?.extension ?? []).some(
      (ext) => ext.url === 'addressString' && typeof ext.valueString === 'string' && ext.valueString.length > 0
    );

    setIsConnecting(true);
    try {
      // If a room already exists, first try to reuse it (e.g. the provider reloaded mid-call and the
      // Chime meeting is still alive). If the meeting is gone — the previous call was ended, or the room
      // auto-destroyed after ~15 min idle — join returns "not found or expired"; re-provision a new one.
      if (appointmentStatus === 'provider' && hasRoom) {
        try {
          const meetingDataResponse = await getMeetingData.refetch({ throwOnError: true });
          useVideoCallStore.setState({ meetingData: meetingDataResponse.data });
          return;
        } catch (error) {
          if (!isMeetingNotFoundOrExpired(error)) {
            throw error;
          }
          // meeting no longer exists — fall through to re-provision a fresh room
        }
      }
      await reprovisionRoomAndConnect();
    } catch (error) {
      console.error('Error connecting to patient video call:', error);
      enqueueSnackbar('Error trying to connect to a patient.', { variant: 'error' });
    } finally {
      setIsConnecting(false);
    }
  }, [appointmentStatus, encounter, getMeetingData, reprovisionRoomAndConnect]);

  const providerAllowedToConnect =
    appointmentAccessibility.isPractitionerLicensedInState &&
    appointmentAccessibility.isEncounterAssignedToCurrentPractitioner;

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
          {isActiveVisitStatus && !meetingData && (
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
          {isActiveVisitStatus && providerAllowedToConnect && (
            <FooterButton
              onClick={() => setIsInviteParticipantOpen(true)}
              variant="contained"
              sx={{ backgroundColor: 'transparent', border: '1px solid white' }}
            >
              Invite participant
            </FooterButton>
          )}
          {isActiveVisitStatus && providerAllowedToConnect && !meetingData && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <ConfirmationDialog
                title="Do you want to connect to the patient?"
                description="This action will start the video call."
                response={onConnect}
                actionButtons={{
                  proceed: {
                    text: 'Connect to Patient',
                    loading: isConnecting,
                  },
                  back: { text: 'Cancel' },
                }}
              >
                {(showDialog) => (
                  <FooterButton
                    loading={isConnecting}
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

// A dead or timed-out Chime meeting surfaces from the join endpoint as e.g.
// "Meeting associated with encounter ID <...> not found or expired". When that happens we re-provision
// a fresh room rather than treating it as a hard error.
function isMeetingNotFoundOrExpired(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.includes('not found or expired');
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
