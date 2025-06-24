import { Box, Divider, Skeleton, Typography } from '@mui/material';
import React, { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { DeleteIconButton } from '../../../components';

export const ProviderSideListSkeleton: FC = () => {
  return (
    <>
      {[1, 2, 3].map((medication, index, arr) => (
        <Box key={medication} data-testid={dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Skeleton width="100%">
              <Typography>{medication}</Typography>
            </Skeleton>
            <Skeleton variant="circular">
              <DeleteIconButton />
            </Skeleton>
          </Box>
          {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
        </Box>
      ))}
    </>
  );
};
