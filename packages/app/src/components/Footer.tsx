import { FC } from 'react';
import { Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { otherColors } from '../IntakeThemeProvider';
import { Logo } from './Logo';
import FooterLogo from '../assets/icons/footerLogo.svg';

const Footer: FC = () => {
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
      <Box component="img" src={FooterLogo} ml={2}></Box>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body2" color="primary.light" sx={{ m: 1.25, maxWidth: 400 }}>
          {t('general.footer')}
        </Typography>
        <Box mt={0.7} mr={2}>
          <Logo width={100} />
        </Box>
      </Box>
    </Box>
  );
};
export default Footer;
