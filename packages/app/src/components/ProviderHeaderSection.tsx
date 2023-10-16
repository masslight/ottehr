import { Typography, Box, useTheme } from '@mui/material';
import { FC } from 'react';
import { ottEHRDefaultProvider, ottEHRDefaultPatient } from '../assets/icons';

interface ProviderHeaderSectionProps {
  providerName: string;
  title: string;
  user: string;
}

export const ProviderHeaderSection: FC<ProviderHeaderSectionProps> = ({ providerName, title, user }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        background: 'linear-gradient(89deg, rgba(40, 160, 198, 0.60) 5.05%, rgba(80, 96, 241, 0.17) 50.42%), #263954',
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
                flexDirection: 'column',
                alignItems: 'center',
                mx: 2,
              },
            }}
          >
            {user === 'provider' ? (
              <img src={ottEHRDefaultProvider} style={{ height: '6.25rem', width: '6.25rem' }} />
            ) : (
              <img src={ottEHRDefaultPatient} style={{ height: '6.25rem', width: '6.25rem' }} />
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
