import React from 'react';
import { CustomContainer } from './CustomContainer';
import { Box, Typography } from '@mui/material';

const NotFoundPage: React.FC = () => {
  return (
    <CustomContainer isProvider={false} subtitle="Page Not Found" title="404 Error">
      <Box>
        <Typography variant="h2">Oops! Page not found.</Typography>
        <Typography variant="body1">The page you are looking for might be in another castle.</Typography>
      </Box>
    </CustomContainer>
  );
};

export default NotFoundPage;
