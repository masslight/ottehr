import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { otherColors } from '../OttehrThemeProvider';
import { defaultPatient, defaultProvider } from '../assets/icons';

interface HeaderProps {
  isProvider: boolean;
  providerName: string;
  title: string;
}

export const Header: FC<HeaderProps> = ({ isProvider, providerName, title }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        background: otherColors.bannerGradient,
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'center',
          py: 5,
          [theme.breakpoints.down('md')]: {
            flexDirection: 'column',
            py: 3,
          },
        }}
      >
        <Box maxWidth="md" width="100%">
          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              justifyContent: 'start',
              mx: 12.5,
              [theme.breakpoints.down('md')]: {
                alignItems: 'center',
                flexDirection: 'column',
                mx: 2,
              },
            }}
          >
            {isProvider ? (
              <img alt="Provider Image" src={defaultProvider} style={{ height: '6.25rem', width: '6.25rem' }} />
            ) : (
              <img alt="Patient Image" src={defaultPatient} style={{ height: '6.25rem', width: '6.25rem' }} />
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
              <Typography color="primary.light" variant="h5">
                {title}
              </Typography>
              <Typography color="primary.contrast" variant="h4">
                {providerName}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
