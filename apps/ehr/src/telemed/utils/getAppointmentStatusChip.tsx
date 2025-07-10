import { Chip } from '@mui/material';
import React, { ReactElement } from 'react';
import { TelemedAppointmentStatus } from 'utils';
import { dataTestIds } from '../../constants/data-test-ids';
import { APPT_STATUS_MAP } from './appointments';

type Mapper<T extends string> = {
  [status in T]: {
    background: {
      primary: string;
      secondary?: string;
    };
    color: {
      primary: string;
      secondary?: string;
    };
  };
};

// added to handle different mappers (e.g. IP ones) with same style
function getAppointmentStatusChip<T extends string>(status?: T, map?: Mapper<T>): ReactElement;
function getAppointmentStatusChip(status?: TelemedAppointmentStatus, count?: number): ReactElement;
function getAppointmentStatusChip<T extends string>(status?: T, item?: number | Mapper<T>): ReactElement {
  const count = typeof item === 'number' ? item : undefined;
  const mapper = typeof item === 'object' ? item : (APPT_STATUS_MAP as Mapper<T>);

  if (!status) {
    return <span>todo1</span>;
  }
  if (!mapper[status]) {
    return <span>todo2</span>;
  }

  // to swap color and background if background is white
  const isBackgroundWhite = /^#(f{3}|f{6})$/i.test(mapper[status].background.primary);

  return (
    <Chip
      size="small"
      label={count ? `${status} - ${count}` : status}
      sx={{
        borderRadius: '4px',
        border: 'none',
        fontWeight: 500,
        textTransform: 'uppercase',
        background: mapper[status][isBackgroundWhite ? 'color' : 'background'].primary,
        color: mapper[status][isBackgroundWhite ? 'background' : 'color'].primary,
      }}
      variant="outlined"
      data-testid={dataTestIds.telemedEhrFlow.appointmentStatusChip}
    />
  );
}

export { getAppointmentStatusChip };
