import { Box } from '@mui/material';
import { ReactElement } from 'react';
import { UCAppointmentInformation } from 'ehr-utils';
import { classifyAppointments } from '../helpers';
import { getInPersonAppointmentStatusChip } from './AppointmentTableRow';

export interface AppointmentChip {
  appointments: UCAppointmentInformation[];
}

const ORDER_STATUS = [
  'pending',
  'arrived',
  'ready',
  'intake',
  'ready for provider',
  'provider',
  'ready for discharge',
  'checked out',
  'canceled',
  'no show',
  'left not seen',
  'unknown',
];
export const AppointmentsStatusChipsCount = ({ appointments }: AppointmentChip): ReactElement => {
  const statusCounts = classifyAppointments(appointments);

  return (
    <Box sx={{ display: 'flex', gap: 2, padding: 2, paddingLeft: 0, flexWrap: 'wrap' }}>
      {Array.from(statusCounts)
        .sort(
          ([statusOne, _countOne], [statusTwo, _countTwo]) =>
            ORDER_STATUS.indexOf(statusOne) - ORDER_STATUS.indexOf(statusTwo),
        )
        .map(([status, count]) => (
          <Box key={status}>{getInPersonAppointmentStatusChip(status, count)}</Box>
        ))}
    </Box>
  );
};
