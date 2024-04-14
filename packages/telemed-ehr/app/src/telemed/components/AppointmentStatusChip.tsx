import { ApptStatus, ApptStatusToPalette } from '../utils';
import React, { ReactElement } from 'react';
import { Chip } from '@mui/material';

interface AppointmentStatusChip {
  status?: keyof typeof ApptStatus;
}

export function AppointmentStatusChip({ status }: AppointmentStatusChip): ReactElement {
  if (!status) {
    return <span>todo1</span>;
  }
  if (!ApptStatusToPalette[status]) {
    return <span>todo2</span>;
  }

  return (
    <Chip
      size="small"
      label={status}
      sx={{
        borderRadius: '4px',
        border: 'none',
        fontWeight: 700,
        fontSize: '12px',
        textTransform: 'uppercase',
        background: ApptStatusToPalette[status].background.primary,
        color: ApptStatusToPalette[status].color.primary,
      }}
      variant="outlined"
    />
  );
}
