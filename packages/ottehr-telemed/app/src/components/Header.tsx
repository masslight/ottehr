import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { otherColors } from '../OttehrThemeProvider';
import { defaultPatient, defaultProvider } from '../assets/icons';
import { TopAppBar } from './TopAppBar';

interface HeaderProps {
  isProvider: boolean;
  subtitle: string;
  title: string;
}

export const Header: FC<HeaderProps> = ({ isProvider, subtitle, title }) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const isSmScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const imageStyle = { height: '6.25rem', width: '6.25rem' };

  return (
    <>
      {isProvider && <TopAppBar />}
      <Box
        sx={{
          alignItems: 'center',
          background: otherColors.bannerGradient,
          display: 'flex',
          justifyContent: 'center',
          py: 5,
          [theme.breakpoints.down('md')]: {
            alignItems: 'center',
            flexDirection: 'column',
            py: 3,
          },
        }}
        width="100%"
      >
        {isProvider ? (
          <img alt={t('imageAlts.provider')} src={defaultProvider} style={imageStyle} />
        ) : (
          <img alt={t('imageAlts.patient')} src={defaultPatient} style={imageStyle} />
        )}
        <Box
          sx={{
            ml: 3,
            [theme.breakpoints.down('md')]: {
              alignItems: 'center',
              display: 'flex',
              flexDirection: 'column',
              ml: 0,
              mt: 2,
            },
          }}
        >
          <Typography color="primary.light" variant={isSmScreen ? 'h6' : 'h5'}>
            {title}
          </Typography>
          <Typography color="primary.contrast" variant={isSmScreen ? 'h5' : 'h4'}>
            {subtitle}
          </Typography>
        </Box>
      </Box>
    </>
  );
};
