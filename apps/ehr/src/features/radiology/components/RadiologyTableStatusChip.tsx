import { Chip } from '@mui/material';
import { ReactElement } from 'react';
import { RadiologyOrderStatus } from 'utils';

interface RadiologyTableStatusChipProps {
  status: RadiologyOrderStatus;
}

export const RadiologyTableStatusChip = ({ status }: RadiologyTableStatusChipProps): ReactElement => {
  return (
    <Chip
      label={status.toUpperCase()}
      size="small"
      sx={{
        backgroundColor: getStatusColor(status),
        borderRadius: '4px',
        fontWeight: 'bold',
      }}
    />
  );
};

const getStatusColor = (status: RadiologyOrderStatus): string => {
  switch (status) {
    case 'pending':
      return '#E0E0E0';
    case 'performed':
      return '#90CAF9';
    case 'preliminary':
      return '#A5D6A7';
    case 'final':
      return '#CE93D8';
    case 'reviewed':
      return '#81C784';
    default:
      return '#E0E0E0';
  }
};
