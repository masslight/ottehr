import React, { FC } from 'react';
import { Box, Divider, Skeleton, Typography } from '@mui/material';

export const PatientSideListSkeleton: FC = () => {
  return (
    <>
      {[1, 2, 3].map((answer, index, arr) => (
        <Box key={index}>
          <Skeleton width="100%">
            <Typography>{answer}</Typography>
          </Skeleton>
          {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
        </Box>
      ))}
    </>
  );
};
