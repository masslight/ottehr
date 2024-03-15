import React, { FC } from 'react';
import { Box, Divider, IconButton, Skeleton, Typography } from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';

export const ProviderSideListSkeleton: FC = () => {
  return (
    <>
      {[1, 2, 3].map((medication, index, arr) => (
        <Box key={medication}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Skeleton width="100%">
              <Typography>{medication}</Typography>
            </Skeleton>
            <Skeleton variant="circular">
              <IconButton size="small">
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            </Skeleton>
          </Box>
          {index + 1 !== arr.length && <Divider sx={{ pt: 1 }} />}
        </Box>
      ))}
    </>
  );
};
