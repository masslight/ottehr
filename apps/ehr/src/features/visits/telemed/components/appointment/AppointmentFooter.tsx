import { AppBar, Box, Divider, Link, Stack, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import {
  getAppointmentWaitingTime,
  getQuestionnaireResponseByLinkId,
  getSelectors,
  getTelemedEncounterStatusHistory,
  INTERPRETER_PHONE_NUMBER,
  TelemedAppointmentStatusEnum,
} from 'utils';
import { useVideoCallStore } from '../../state/video-call/video-call.store';
import InviteParticipant from '../appointment/InviteParticipant';
import { AppointmentFooterButton } from './AppointmentFooterButton';
import { AppointmentFooterEndVisitButton } from './AppointmentFooterEndVisitButton';

export const AppointmentFooter: FC = () => {
  const theme = useTheme();
  const [isInviteParticipantOpen, setIsInviteParticipantOpen] = useState(false);
  const appointmentAccessibility = useGetAppointmentAccessibility();
  const { appointment, encounter, mappedData, questionnaireResponse } = useAppointmentData();
  const { meetingData } = getSelectors(useVideoCallStore, ['meetingData']);

  const statuses =
    encounter.statusHistory && appointment?.status
      ? getTelemedEncounterStatusHistory(encounter.statusHistory, appointment.status)
      : undefined;
  const waitingTime = getAppointmentWaitingTime(statuses);

  const preferredLanguage = getQuestionnaireResponseByLinkId('preferred-language', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const delimiterString = preferredLanguage && isSpanish(preferredLanguage) ? `\u00A0|\u00A0` : '';
  const interpreterString =
    preferredLanguage && isSpanish(preferredLanguage) ? `Interpreter: ${INTERPRETER_PHONE_NUMBER}` : '';
  const relayPhone = getQuestionnaireResponseByLinkId('relay-phone', questionnaireResponse)?.answer?.[0]?.valueString;
  const patientPhoneNumber =
    getQuestionnaireResponseByLinkId('patient-number', questionnaireResponse)?.answer?.[0]?.valueString ||
    getQuestionnaireResponseByLinkId('guardian-number', questionnaireResponse)?.answer?.[0]?.valueString;

  const onVideoStatus = statuses?.find((element) => element.status === TelemedAppointmentStatusEnum['on-video']);
  const onVideoStatusStart = onVideoStatus?.start ? DateTime.fromISO(onVideoStatus.start) : undefined;
  const onVideoStatusEnd = onVideoStatus?.end ? DateTime.fromISO(onVideoStatus.end) : undefined;
  const callDuration =
    onVideoStatusStart && onVideoStatusEnd
      ? onVideoStatusEnd.diff(onVideoStatusStart, 'seconds').toFormat('mm:ss')
      : null;

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
          {(appointmentAccessibility.status === TelemedAppointmentStatusEnum['ready'] ||
            appointmentAccessibility.status === TelemedAppointmentStatusEnum['on-video'] ||
            appointmentAccessibility.status === TelemedAppointmentStatusEnum['pre-video']) &&
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
          {(appointmentAccessibility.status === TelemedAppointmentStatusEnum['ready'] ||
            appointmentAccessibility.status === TelemedAppointmentStatusEnum['on-video'] ||
            appointmentAccessibility.status === TelemedAppointmentStatusEnum['pre-video']) &&
            !meetingData && <AppointmentFooterButton />}
          {appointmentAccessibility.isEncounterAssignedToCurrentPractitioner &&
            appointmentAccessibility.status === TelemedAppointmentStatusEnum['on-video'] && (
              <AppointmentFooterEndVisitButton />
            )}
          {appointmentAccessibility.status === TelemedAppointmentStatusEnum['unsigned'] && (
            <Typography variant="body1">Visit ended. {callDuration ? `Duration ${callDuration}` : null}</Typography>
          )}
        </Stack>
      </Stack>
    </AppBar>
  );
};

function isSpanish(language: string): boolean {
  return language.toLowerCase() === 'Spanish'.toLowerCase();
}
