import { AppBar, Box, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import {
  getAppointmentWaitingTime,
  getSelectors,
  mapEncounterStatusHistory,
  TelemedAppointmentStatusEnum,
} from 'utils';
import { useVideoCallStore } from '../../state/video-call/video-call.store';
import InviteParticipant from '../appointment/InviteParticipant';
import { AppointmentFooterButton } from './AppointmentFooterButton';

export const AppointmentFooter: FC = () => {
  const theme = useTheme();
  const [isInviteParticipantOpen, setIsInviteParticipantOpen] = useState(false);
  const appointmentAccessibility = useGetAppointmentAccessibility();
  const { appointment, encounter } = useAppointmentData();
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
      data-testid={dataTestIds.telemedEhrFlow.appointmentChartFooter}
    >
      {isInviteParticipantOpen && (
        <InviteParticipant modalOpen={isInviteParticipantOpen} onClose={() => setIsInviteParticipantOpen(false)} />
      )}
      {((appointmentAccessibility.status &&
        [TelemedAppointmentStatusEnum.ready, TelemedAppointmentStatusEnum['pre-video']].includes(
          appointmentAccessibility.status
        )) ||
        (appointmentAccessibility.isEncounterAssignedToCurrentPractitioner &&
          appointmentAccessibility.status &&
          appointmentAccessibility.status === TelemedAppointmentStatusEnum['on-video'] &&
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
