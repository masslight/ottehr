import { Chip, ChipProps, SxProps } from '@mui/material';
import { ReactElement } from 'react';
import { TestStatus } from 'utils/lib/types/data/in-house';

interface StatusColorConfig {
  backgroundColor: string;
  color: string;
}

interface InHouseLabsStatusChipProps {
  status: TestStatus | string;
  additionalStyling?: SxProps;
}

export const getStatusColor = (status: string): StatusColorConfig => {
  switch (status.toLowerCase()) {
    case 'final':
      return {
        backgroundColor: '#e6f4ff',
        color: '#1976d2',
      };
    case 'collected':
      return {
        backgroundColor: '#e8deff',
        color: '#5e35b1',
      };
    case 'pending':
      return {
        backgroundColor: '#fff4e5',
        color: '#ed6c02',
      };
    default:
      return {
        backgroundColor: '#f5f5f5',
        color: '#757575',
      };
  }
};

export const InHouseLabsStatusChip = ({ status, additionalStyling }: InHouseLabsStatusChipProps): ReactElement => {
  const getChipProps = (): ChipProps & { label: TestStatus } => {
    const colors = getStatusColor(status);

    switch (status.toLowerCase()) {
      case 'final':
        return {
          label: 'FINAL',
          sx: {
            ...colors,
            fontWeight: 'bold',
            borderRadius: '4px',
            ...additionalStyling,
          },
        };
      case 'collected':
        return {
          label: 'COLLECTED',
          sx: {
            ...colors,
            fontWeight: 'bold',
            borderRadius: '4px',
          },
        };
      case 'pending':
        return {
          label: 'ORDERED',
          sx: {
            ...colors,
            fontWeight: 'bold',
            borderRadius: '4px',
          },
        };
      default:
        return {
          label: (status.toUpperCase() || 'UNKNOWN') as TestStatus, // todo: clarify possible statuses
          sx: {
            ...colors,
            fontWeight: 'bold',
            borderRadius: '4px',
          },
        };
    }
  };

  const chipProps = getChipProps();

  return <Chip size="small" {...chipProps} />;
};
