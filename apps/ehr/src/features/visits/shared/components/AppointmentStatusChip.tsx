import { Chip } from '@mui/material';
import { ReactElement } from 'react';
import { TelemedAppointmentStatusEnum } from 'utils';
import { TelemedAppointmentStatusToPalette } from '../../telemed/utils/appointments';

interface AppointmentStatusChip {
  status?: keyof typeof TelemedAppointmentStatusEnum;
}

export function AppointmentStatusChip({ status }: AppointmentStatusChip): ReactElement {
  if (!status) {
    return <span>todo1</span>;
  }
  if (!TelemedAppointmentStatusToPalette[status]) {
    return <span>todo2</span>;
  }

  return (
    <Chip
      size="small"
      label={status}
      sx={{
        borderRadius: '4px',
        border: 'none',
        fontWeight: 500,
        fontSize: '12px',
        textTransform: 'uppercase',
        background: TelemedAppointmentStatusToPalette[status].background.primary,
        color: TelemedAppointmentStatusToPalette[status].color.primary,
      }}
      variant="outlined"
    />
  );
}
