import { Typography, Box, useTheme } from '@mui/material';
import { ottehrDefaultProvider } from '../assets/icons';

interface ProviderHeaderSectionProps {
  providerName: string;
  title: string;
}

export const ProviderHeaderSection: React.FC<ProviderHeaderSectionProps> = ({ providerName, title }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        background: 'linear-gradient(89deg, rgba(40, 160, 198, 0.60) 5.05%, rgba(80, 96, 241, 0.17) 50.42%), #263954',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          py: 5,
          alignItems: 'center',
          [theme.breakpoints.down('md')]: {
            flexDirection: 'column',
            py: 3,
          },
        }}
      >
        <Box maxWidth="md" width="100%">
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'start',
              alignItems: 'center',
              mx: 12.5,
              [theme.breakpoints.down('md')]: {
                flexDirection: 'column',
                alignItems: 'center',
                mx: 2,
              },
            }}
          >
            <img src={ottehrDefaultProvider} style={{ width: '6.25rem', height: '6.25rem' }} />
            <Box
              sx={{
                ml: 3,
                [theme.breakpoints.down('md')]: {
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  ml: 0,
                  mt: 2,
                },
              }}
            >
              <Typography variant="h5" color="primary.light">
                {title}
              </Typography>
              <Typography variant="h4" color="primary.contrast">
                {providerName}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
