import { Box, Typography } from '@mui/material';
import React from 'react';

export const BoldedTitleText: React.FC<{ title: string; description: string }> = ({ title, description }) => {
  return (
    <Typography component="div">
      <Box fontWeight="bold" display="inline">
        {`${title}:`}
      </Box>{' '}
      {description}
    </Typography>
  );
};
