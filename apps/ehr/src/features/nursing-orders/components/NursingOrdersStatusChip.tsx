import { Chip, ChipProps } from '@mui/material';
import { ReactElement } from 'react';
import { NursingOrdersStatus } from 'utils';

interface NursingOrdersStatusChipProps {
  status: NursingOrdersStatus | string;
}

export const NursingOrdersStatusChip = ({ status }: NursingOrdersStatusChipProps): ReactElement => {
  const getChipProps = (): ChipProps & { label: string } => {
    switch (status.toLowerCase()) {
      case NursingOrdersStatus.pending:
        return {
          label: 'PENDING',
          sx: {
            backgroundColor: '#E6E8EE',
            color: '#616161',
            fontWeight: 'bold',
            borderRadius: '4px',
          },
        };
      case NursingOrdersStatus.completed:
        return {
          label: 'COMPLETED',
          sx: {
            backgroundColor: '#C8E6C9',
            color: '#1B5E20',
            fontWeight: 'bold',
            borderRadius: '4px',
          },
        };
      case NursingOrdersStatus.cancelled:
        return {
          label: 'CANCELLED',
          sx: {
            backgroundColor: '#ffffff',
            color: '#616161',
            fontWeight: 'bold',
            borderRadius: '4px',
            border: 1,
            borderColor: '#BFC2C6',
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
