import { APPT_STATUS_MAP, ApptStatus } from './appointments';
import React, { ReactElement } from 'react';
import { Chip } from '@mui/material';

export function getAppointmentStatusChip(status?: ApptStatus, count?: number): ReactElement {
  if (!status) {
    return <span>todo1</span>;
  }
  if (!APPT_STATUS_MAP[status]) {
    return <span>todo2</span>;
  }

  return (
    <Chip
      size="small"
      label={count ? `${status} - ${count}` : status}
      sx={{
        borderRadius: '4px',
        border: 'none',
        fontWeight: 700,
        textTransform: 'uppercase',
        background: APPT_STATUS_MAP[status].background.primary,
        color: APPT_STATUS_MAP[status].color.primary,
      }}
      variant="outlined"
    />
  );
}
