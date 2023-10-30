import { Button, TextField, Typography, useTheme } from '@mui/material';
import { Box } from '@mui/system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { otherStyling } from '../OttehrThemeProvider';
import { Footer, Header } from '../components';
import { needsDot } from '../helpers';
import { usePatient } from '../store';

export const CheckIn = (): JSX.Element => {
  const navigate = useNavigate();
  const { patientName, setPatientName } = usePatient();
  const theme = useTheme();
  const { t } = useTranslation();
  const [isError, setIsError] = useState(false);
  const [name, setName] = useState(patientName);

  const provider = {
    checkboxes: true,
    email: 'osmith@provider.com',
    'first name': 'Olivia',
    'last name': 'Smith',
    slug: 'oliviasmith',
    title: 'Dr',
  };

  const handleSubmit = (event: any): void => {
    event.preventDefault();
    if (name) {
      setPatientName(name);
      navigate('/video-settings');
    } else {
      setIsError(true);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        justifyContent: 'space-between',
      }}
    >
      <Header
        isProvider={true}
        providerName={`${provider.title} ${provider['last name']}`}
        title={t('checkIn.headerTitle')}
      />
      {/* Middle Section */}
      <Box
        sx={{
          display: 'flex',
          flexGrow: '1',
          justifyContent: 'center',
        }}
      >
        <Box
          maxWidth="md"
          sx={{
            [theme.breakpoints.down('md')]: {
              px: 2,
            },
          }}
          width="100%"
        >
          <Box
            sx={{
              ...otherStyling.boxPadding,
              [theme.breakpoints.down('md')]: {
                ...otherStyling.boxPaddingMobile,
              },
            }}
          >
            <Typography sx={{ pb: 1 }} variant="h5">
              {t('checkIn.checkIn')}
            </Typography>
            <Typography sx={{ pb: 3 }} variant="body1">
              {t('checkIn.enterNamePrefix')}
              {provider.title}
              {needsDot(provider.title) ? '.' : ''} {provider['first name']} {provider['last name']}
              {t('checkIn.enterNameSuffix')}
            </Typography>
            <form onSubmit={handleSubmit}>
              <Box
                sx={{
                  alignItems: 'flex-start',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <TextField
                  error={isError}
                  label={t('checkIn.yourName')}
                  onChange={(e) => setName(e.target.value)}
                  sx={{ pb: 2, width: '100%' }}
                  value={name}
                  variant="outlined"
                />
                <Button
                  sx={{
                    ...otherStyling.buttonPrimary,
                    width: '100%',
                  }}
                  type="submit"
                  variant="contained"
                >
                  {t('checkIn.checkIn')}
                </Button>
              </Box>
            </form>
          </Box>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
};
