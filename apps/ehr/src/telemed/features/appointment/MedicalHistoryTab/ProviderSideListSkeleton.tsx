import React, { FC } from 'react';
import { Box, Divider, Skeleton, Typography } from '@mui/material';
import { DeleteIconButton } from '../../../components';
import { dataTestIds } from '../../../../constants/data-test-ids';

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
