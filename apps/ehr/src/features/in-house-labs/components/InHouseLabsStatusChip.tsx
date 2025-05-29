import { ReactElement } from 'react';
import { Chip, ChipProps, SxProps } from '@mui/material';
import { TestStatus } from 'utils/lib/types/data/in-house';

interface InHouseLabsStatusChipProps {
  status: TestStatus | string;
  additionalStyling?: SxProps;
}

export const InHouseLabsStatusChip = ({ status, additionalStyling }: InHouseLabsStatusChipProps): ReactElement => {
  const getChipProps = (): ChipProps & { label: TestStatus } => {
    switch (status.toLowerCase()) {
      case 'final':
        return {
          label: 'FINAL',
          sx: {
            backgroundColor: '#e6f4ff',
            color: '#1976d2',
            fontWeight: 'bold',
            borderRadius: '4px',
            ...additionalStyling,
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
          label: 'ORDERED',
          sx: {
            backgroundColor: '#fff4e5',
            color: '#ed6c02',
            fontWeight: 'bold',
            borderRadius: '4px',
          },
        };
      default:
        return {
          label: (status.toUpperCase() || 'UNKNOWN') as TestStatus, // todo: clarify possible statuses
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
