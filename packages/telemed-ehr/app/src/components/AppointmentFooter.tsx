import { AppBar, Box, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { ApptStatus, getVisitStatusHistory, mapEncounterStatusHistory, VisitStatusHistoryEntry } from 'ehr-utils';
import { getSelectors } from '../shared/store/getSelectors';
import InviteParticipant from '../telemed/components/InviteParticipant';
import { useGetAppointmentAccessibility } from '../telemed';
import { useAppointmentStore, useVideoCallStore } from '../telemed';
import { getAppointmentWaitingTime } from '../telemed/utils';
import { AppointmentFooterButton } from '../telemed/features/appointment';
import AppointmentStatusSwitcher from './AppointmentStatusSwitcher';
import { Appointment } from 'fhir/r4';

export const AppointmentFooter: FC = () => {
  const theme = useTheme();

  const appointmentAccessibility = useGetAppointmentAccessibility();
  const { appointment, encounter } = getSelectors(useAppointmentStore, ['appointment', 'encounter']);
  const [appointmentStatus, setAppointmentStatus] = useState<string[]>([]);

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
      {appointmentAccessibility.status &&
        [ApptStatus.ready, ApptStatus['pre-video']].includes(appointmentAccessibility.status) && (
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
            <Box>
              <AppointmentStatusSwitcher appointment={appointment as Appointment} encounter={encounter} />
            </Box>
          </Box>
        )}
    </AppBar>
  );
};
