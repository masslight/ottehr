import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { otherColors } from '../OttehrThemeProvider';
import { footerLogo } from '../assets/icons';
import { ZapEHRLogo } from './ZapEHRLogo';

export const Footer: FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();

  const handleFooterClick = (): void => {
    // TODO: Placeholder for adding analytics to onClick
  };

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
      <Box alt="Footer Logo" component="img" ml={2} src={footerLogo}></Box>
      <a href="https://zapehr.com/" onClick={handleFooterClick} rel="noopener noreferrer" target="_blank">
        <Box sx={{ alignItems: 'center', display: 'flex' }}>
          <Typography
            color="primary.light"
            sx={{
              m: 1.25,
              maxWidth: 400,
              [theme.breakpoints.down('sm')]: {
                display: 'none',
              },
            }}
            variant="body2"
          >
            {t('general.footer')}
          </Typography>
          <Box mr={2} mt={0.7}>
            <ZapEHRLogo width={100} />
          </Box>
        </Box>
      </a>
    </Box>
  );
};
