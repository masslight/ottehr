import { ReactElement } from 'react';
import { Chip, ChipProps } from '@mui/material';
import { ExternalLabsStatus } from 'utils/lib/types/data/labs';

interface InHouseLabsStatusChipProps {
  status: ExternalLabsStatus | string;
}

export const InHouseLabsStatusChip = ({ status }: InHouseLabsStatusChipProps): ReactElement => {
  const getChipProps = (): ChipProps & { label: string } => {
    switch (status.toLowerCase()) {
      case 'final':
        return {
          label: 'FINAL',
          sx: {
            backgroundColor: '#e6f4ff',
            color: '#1976d2',
            fontWeight: 'bold',
            borderRadius: '4px',
          },
        };
      case 'collected':
        return {
          label: 'COLLECTED',
          sx: {
            backgroundColor: '#e8deff',
            color: '#5e35b1',
            fontWeight: 'bold',
            borderRadius: '4px',
          },
        };
      case 'pending':
        return {
          label: 'PENDING',
          sx: {
            backgroundColor: '#fff4e5',
            color: '#ed6c02',
            fontWeight: 'bold',
            borderRadius: '4px',
          },
        };
      case 'received':
      case 'reviewed':
        return {
          label: 'RECEIVED',
          sx: {
            backgroundColor: '#e3f2fd',
            color: '#2196f3',
            fontWeight: 'bold',
            borderRadius: '4px',
          },
        };
      case 'cancelled':
        return {
          label: 'CANCELLED',
          sx: {
            backgroundColor: '#f5f5f5',
            color: '#757575',
            fontWeight: 'bold',
            borderRadius: '4px',
          },
        };
      default:
        return {
          label: status.toUpperCase(),
          sx: {
            backgroundColor: '#f5f5f5',
            color: '#757575',
            fontWeight: 'bold',
            borderRadius: '4px',
          },
        };
    }
  };

  const chipProps = getChipProps();

  return <Chip size="small" {...chipProps} />;
};
