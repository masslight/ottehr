import { Box, Skeleton, Tooltip, Typography } from '@mui/material';
import { FC } from 'react';
import { useGetPatient } from '../../../hooks/useGetPatient';
import { dataTestIds } from '../../../constants/data-test-ids';

type Props = {
  id?: string;
};

export const IdentifiersRow: FC<Props> = ({ id }) => {
  const { loading, patient } = useGetPatient(id);

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {loading ? (
        <Skeleton width={300} />
      ) : (
        <Tooltip title={patient?.id}>
          <Typography variant="body2" data-testid={dataTestIds.patientHeader.patientId}>
            PID: {patient?.id}
          </Typography>
        </Tooltip>
      )}
    </Box>
  );
};
