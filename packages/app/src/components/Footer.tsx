import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { footerLogo } from '../assets/icons';
import { otherColors } from '../OttehrThemeProvider';
import { ZapEHRLogo } from './ZapEHRLogo';

export const Footer: FC = () => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        width: '100%',
        background: otherColors.footerBackground,
        bottom: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Box component="img" src={footerLogo} ml={2}></Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" color="primary.light" sx={{ m: 1.25, maxWidth: 400 }}>
          {t('general.footer')}
        </Typography>
        <Box mt={0.7} mr={2}>
          <ZapEHRLogo width={100} />
        </Box>
      </Box>
    </Box>
  );
};
