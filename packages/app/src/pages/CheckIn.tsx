import { TextField, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomButton, CustomContainer } from '../components';
import { usePatient } from '../store';
import { getProvider } from '../api';

export const CheckIn = (): JSX.Element => {
  const navigate = useNavigate();
  const { patientName, setPatientName, providerName, setProviderName, setProviderId } = usePatient();
  const { t } = useTranslation();
  const [isError, setIsError] = useState(false);
  const [name, setName] = useState(patientName);

  const { slug } = useParams();

  // TODO add loading & show provider not found info
  useEffect(() => {
    const fetchProvider = async (): Promise<void> => {
      try {
        const provider = await getProvider(slug || '');
        console.log('provider', provider);
        if (provider) {
          setProviderId(provider.id || '');
          setProviderName(provider.name || '');
        }
      } catch (error) {
        console.error('Error fetching provider:', error);
      }
    };

    if (slug) {
      fetchProvider().catch((error) => {
        console.log(error);
      });
    }
  }, [slug, setProviderId, setProviderName]);

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
    <CustomContainer isProvider={false} subtitle={providerName} title={t('general.waitingRoom')}>
      <Typography sx={{ pb: 1 }} variant="h5">
        {t('checkIn.checkIn')}
      </Typography>
      <Typography sx={{ pb: 3 }} variant="body1">
        {t('checkIn.enterNamePrefix')}
        {providerName}
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
            sx={{ width: '100%' }}
            value={name}
            variant="outlined"
          />
          <CustomButton submit>{t('checkIn.checkIn')}</CustomButton>
        </Box>
      </form>
    </CustomContainer>
  );
};
