import { AppBar, Box, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { getSelectors, mapEncounterStatusHistory, TelemedAppointmentStatusEnum } from 'utils';
import { dataTestIds } from '../../../constants/data-test-ids';
import InviteParticipant from '../../components/InviteParticipant';
import { useGetAppointmentAccessibility } from '../../hooks';
import { useAppointmentData, useVideoCallStore } from '../../state';
import { getAppointmentWaitingTime } from '../../utils';
import { AppointmentFooterButton } from './AppointmentFooterButton';
import { AppointmentFooterEndVisitButton } from './AppointmentFooterEndVisitButton';

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
      {appointmentAccessibility.status &&
        [
          TelemedAppointmentStatusEnum.ready,
          TelemedAppointmentStatusEnum['pre-video'],
          TelemedAppointmentStatusEnum['on-video'],
        ].includes(appointmentAccessibility.status) && (
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
              {appointmentAccessibility.isEncounterAssignedToCurrentPractitioner &&
                (appointmentAccessibility.status === TelemedAppointmentStatusEnum['ready'] ||
                  appointmentAccessibility.status === TelemedAppointmentStatusEnum['on-video'] ||
                  appointmentAccessibility.status === TelemedAppointmentStatusEnum['pre-video']) &&
                !meetingData && (
                  <>
                    <Typography variant="h4">Patient waiting</Typography>
                    <Typography variant="body2">{waitingTime} mins</Typography>
                  </>
                )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'end', alignItems: 'center', gap: 2 }}>
              {appointmentAccessibility.isEncounterAssignedToCurrentPractitioner &&
                (appointmentAccessibility.status === TelemedAppointmentStatusEnum['ready'] ||
                  appointmentAccessibility.status === TelemedAppointmentStatusEnum['on-video'] ||
                  appointmentAccessibility.status === TelemedAppointmentStatusEnum['pre-video']) &&
                !meetingData && (
                  <>
                    <Box></Box>
                    <AppointmentFooterButton />
                  </>
                )}

              {appointmentAccessibility.isEncounterAssignedToCurrentPractitioner &&
                appointmentAccessibility.status === TelemedAppointmentStatusEnum['on-video'] && (
                  <>
                    <AppointmentFooterEndVisitButton />
                  </>
                )}
            </Box>
          </Box>
        )}
    </AppBar>
  );
};
