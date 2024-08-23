import { FC, useState } from 'react';
import { Alert, AppBar, Box, Button, Container, darken, Divider, Snackbar, Typography, useTheme } from '@mui/material';
import { ApptStatus, getQuestionnaireResponseByLinkId, mapEncounterStatusHistory } from 'ehr-utils';
import InviteParticipant from '../../components/InviteParticipant';
import { AppointmentFooterButton } from './AppointmentFooterButton';
import { useGetAppointmentAccessibility } from '../../hooks';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useAppointmentStore, useVideoCallStore } from '../../state';
import { getAppointmentWaitingTime } from '../../utils';
import { otherColors } from '../../../CustomThemeProvider';

export const AppointmentFooter: FC = () => {
  const theme = useTheme();
  const [error, setError] = useState<string>();
  const [isInviteParticipantOpen, setIsInviteParticipantOpen] = useState(false);

  const appointmentAccessibility = useGetAppointmentAccessibility();
  const { appointment, encounter, questionnaireResponse } = getSelectors(useAppointmentStore, [
    'appointment',
    'encounter',
    'questionnaireResponse',
  ]);
  const { meetingData } = getSelectors(useVideoCallStore, ['meetingData']);

  const statuses =
    encounter.statusHistory && appointment?.status
      ? mapEncounterStatusHistory(encounter.statusHistory, appointment.status)
      : undefined;
  const waitingTime = getAppointmentWaitingTime(statuses);

  const preferredLanguage = getQuestionnaireResponseByLinkId('preferred-language', questionnaireResponse)?.answer?.[0]
    .valueString;
  const relayPhone = getQuestionnaireResponseByLinkId('relay-phone', questionnaireResponse)?.answer?.[0].valueString;
  const number =
    getQuestionnaireResponseByLinkId('patient-number', questionnaireResponse)?.answer?.[0].valueString ||
    getQuestionnaireResponseByLinkId('guardian-number', questionnaireResponse)?.answer?.[0].valueString;

  return (
    <AppBar
      position="sticky"
      sx={{
        top: 'auto',
        bottom: 0,
        backgroundColor: theme.palette.primary.dark,
      }}
    >
      {isInviteParticipantOpen && (
        <InviteParticipant modalOpen={isInviteParticipantOpen} onClose={() => setIsInviteParticipantOpen(false)} />
      )}
      <Container
        maxWidth="xl"
        sx={{
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          color: 'white',
          backgroundColor: otherColors.headerBackground,
        }}
      >
        {((appointmentAccessibility.status &&
          [ApptStatus.ready, ApptStatus['pre-video']].includes(appointmentAccessibility.status)) ||
          (appointmentAccessibility.isEncounterForPractitioner &&
            appointmentAccessibility.status &&
            appointmentAccessibility.status === ApptStatus['on-video'] &&
            !meetingData)) && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="h4">Patient waiting</Typography>
              <Typography variant="body2">{waitingTime} mins</Typography>
            </Box>
            <AppointmentFooterButton setError={setError} />
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Box>
              <Typography variant="subtitle2">Preferred Language</Typography>
              <Typography>{preferredLanguage}</Typography>
            </Box>
            <Divider orientation="vertical" variant="fullWidth" flexItem sx={{ borderColor: '#FFFFFF4D' }} />
            <Box>
              <Typography variant="subtitle2">Hearing Impaired Relay Service? (711)</Typography>
              <Typography>{relayPhone}</Typography>
            </Box>
            <Divider orientation="vertical" variant="fullWidth" flexItem sx={{ borderColor: '#FFFFFF4D' }} />
            <Box>
              <Typography variant="subtitle2">Patient number</Typography>
              <Typography>{number}</Typography>
            </Box>
          </Box>

          {appointmentAccessibility.isEncounterForPractitioner &&
            appointmentAccessibility.status &&
            [ApptStatus['pre-video'], ApptStatus['on-video']].includes(appointmentAccessibility.status) && (
              <Button
                variant="outlined"
                sx={{
                  textTransform: 'none',
                  fontSize: '14px',
                  fontWeight: 700,
                  borderRadius: 10,
                  color: 'white',
                  borderColor: theme.palette.primary.light,
                  '&:hover': { borderColor: darken(theme.palette.primary.light, 0.125) },
                }}
                onClick={() => setIsInviteParticipantOpen(true)}
              >
                Invite participant
              </Button>
            )}
        </Box>
      </Container>
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(undefined)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setError(undefined)} severity="error" variant="filled" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </AppBar>
  );
};
