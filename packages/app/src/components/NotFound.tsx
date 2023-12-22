import React from 'react';
import { CustomContainer } from './CustomContainer';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <CustomContainer isProvider={false} subtitle="Page Not Found" title="404 Error">
      <Box>
        <Typography variant="h2">{t('error.notFound404Header')}</Typography>
        <Typography variant="body1">{t('error.notFound404Message')}</Typography>
      </Box>
    </CustomContainer>
  );
};

export default NotFoundPage;
