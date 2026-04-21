import { Box, Typography } from '@mui/material';
import React from 'react';

export const BoldedTitleText: React.FC<{ title: string; description: string | null; dataTestId?: string }> = ({
  title,
  description,
  dataTestId,
}) => {
  return (
    <Typography data-testid={dataTestId} component="div">
      <Box fontWeight="bold" display="inline">
        {`${title}:`}
      </Box>{' '}
      {description}
    </Typography>
  );
};
