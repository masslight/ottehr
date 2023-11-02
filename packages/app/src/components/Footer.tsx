import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { otherColors } from '../OttehrThemeProvider';
import { footerLogo } from '../assets/icons';
import { ZapEHRLogo } from './ZapEHRLogo';

export const Footer: FC = () => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        alignItems: 'center',
        background: otherColors.footerBackground,
        bottom: 0,
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
      }}
    >
      <Box component="img" ml={2} src={footerLogo}></Box>
      <Box sx={{ alignItems: 'center', display: 'flex' }}>
        <Typography color="primary.light" sx={{ m: 1.25, maxWidth: 400 }} variant="body2">
          {t('general.footer')}
        </Typography>
        <Box mr={2} mt={0.7}>
          <ZapEHRLogo width={100} />
        </Box>
      </Box>
    </Box>
  );
};
