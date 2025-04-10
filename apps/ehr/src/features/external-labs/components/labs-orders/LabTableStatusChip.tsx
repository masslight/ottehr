import { ReactElement } from 'react';
import { Chip } from '@mui/material';
import { getStatusColor } from './labs.helpers';
import { ExternalLabsStatus } from 'utils';

interface LabTableStatusChipProps {
  status: ExternalLabsStatus;
}

export const LabTableStatusChip = ({ status }: LabTableStatusChipProps): ReactElement => {
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
