import { Box, Skeleton, Tooltip, Typography } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

type Props = {
  loading?: boolean;
  id?: string;
};

export const IdentifiersRow: FC<Props> = ({ id, loading }) => {
  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      {loading ? (
        <Skeleton width={300} />
      ) : (
        <Tooltip title={id}>
          <Typography variant="body2" data-testid={dataTestIds.patientHeader.patientId}>
            PID: {id ?? '?'}
          </Typography>
        </Tooltip>
      )}
    </Box>
  );
};
