import { Chip } from '@mui/material';
import { ReactElement } from 'react';
import { RadiologyOrderStatus } from 'utils';

interface StatusColorConfig {
  backgroundColor: string;
  color: string;
}

const STATUS_COLORS: Partial<Record<RadiologyOrderStatus, StatusColorConfig>> = {
  [RadiologyOrderStatus.pending]: { backgroundColor: '#E0E0E0', color: '#616161' },
  [RadiologyOrderStatus.ordered]: { backgroundColor: '#E0E0E0', color: '#616161' },
  [RadiologyOrderStatus.performed]: { backgroundColor: '#D1C4E9', color: '#4527A0' },
  [RadiologyOrderStatus.preliminary]: { backgroundColor: '#B2EBF2', color: '#1B5E20' },
  [RadiologyOrderStatus.pendingFinal]: { backgroundColor: '#BBDEFB', color: '#0057B2' },
  [RadiologyOrderStatus.final]: { backgroundColor: '#81C784', color: '#1B5E20' },
  [RadiologyOrderStatus.reviewed]: { backgroundColor: '#C8E6C9', color: '#1B5E20' },
};

const DEFAULT_STATUS_COLORS: StatusColorConfig = { backgroundColor: '#E0E0E0', color: '#616161' };

interface RadiologyTableStatusChipProps {
  status: RadiologyOrderStatus;
}

export const RadiologyTableStatusChip = ({ status }: RadiologyTableStatusChipProps): ReactElement => {
  return (
    <Chip
      label={status.toUpperCase()}
      sx={{
        ...(STATUS_COLORS[status] ?? DEFAULT_STATUS_COLORS),
        borderRadius: 1,
        fontWeight: '500',
        fontSize: '14px',
      }}
    />
  );
};
