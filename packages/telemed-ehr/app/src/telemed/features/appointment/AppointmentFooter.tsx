import { AppBar, Box, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { ApptStatus, mapEncounterStatusHistory } from 'ehr-utils';
import { getSelectors } from '../../../shared/store/getSelectors';
import InviteParticipant from '../../components/InviteParticipant';
import { useGetAppointmentAccessibility } from '../../hooks';
import { useAppointmentStore, useVideoCallStore } from '../../state';
import { getAppointmentWaitingTime } from '../../utils';
import { AppointmentFooterButton } from './AppointmentFooterButton';

export const AppointmentFooter: FC = () => {
  const theme = useTheme();
  const [isInviteParticipantOpen, setIsInviteParticipantOpen] = useState(false);

  const appointmentAccessibility = useGetAppointmentAccessibility();
  const { appointment, encounter } = getSelectors(useAppointmentStore, ['appointment', 'encounter']);
  const { meetingData } = getSelectors(useVideoCallStore, ['meetingData']);

  const statuses =
    encounter.statusHistory && appointment?.status
      ? mapEncounterStatusHistory(encounter.statusHistory, appointment.status)
      : undefined;
  const waitingTime = getAppointmentWaitingTime(statuses);

  return (
    <AppBar
      position="sticky"
      sx={{
        top: 'auto',
        bottom: 0,
        backgroundColor: theme.palette.primary.dark,
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      {isInviteParticipantOpen && (
        <InviteParticipant modalOpen={isInviteParticipantOpen} onClose={() => setIsInviteParticipantOpen(false)} />
      )}
      {((appointmentAccessibility.status &&
        [ApptStatus.ready, ApptStatus['pre-video']].includes(appointmentAccessibility.status)) ||
        (appointmentAccessibility.status &&
          appointmentAccessibility.status === ApptStatus['on-video'] &&
          !meetingData)) && (
        <Box
          sx={{
            px: 3,
            py: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'white',
            backgroundColor: theme.palette.primary.dark,
          }}
        >
          <Box>
            <Typography variant="h4">Patient waiting</Typography>
            <Typography variant="body2">{waitingTime} mins</Typography>
          </Box>
          <AppointmentFooterButton />
        </Box>
      )}
    </AppBar>
  );
};
