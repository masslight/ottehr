import { TextField, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { CustomButton, CustomContainer, LoadingSpinner } from '../components';
import { useParticipant } from '../store';
import { getProvider } from '../api';
import { createProviderName } from '../helpers';

export const CheckIn = (): JSX.Element => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { patientName, setPatientName, providerName, setProviderName, setProviderId } = useParticipant();
  const { t } = useTranslation();
  const [isError, setIsError] = useState(false);
  const [name, setName] = useState(patientName);

  const { slug } = useParams();

  useEffect(() => {
    setIsLoading(true);
    const fetchProvider = async (): Promise<void> => {
      try {
        const { response } = await getProvider(slug || '');
        const provider = response?.providerData;
        if (provider) {
          setProviderId(provider.id || '');
          setProviderName(createProviderName(provider));
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching provider:', error);
      } finally {
        setIsLoading(false);
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
  if (isLoading) {
    return <LoadingSpinner transparent={false} />;
  }

  return (
    <CustomContainer isProvider={false} subtitle={providerName || ''} title={t('general.waitingRoom')}>
      {providerName ? (
        <>
          <Typography variant="h5">{t('checkIn.checkIn')}</Typography>
          <Typography sx={{ pb: 2 }} variant="body1">
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
                gap: 1,
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
        </>
      ) : (
        <Box alignItems="center" display="flex" justifyContent="center" style={{ height: '100%', width: '100%' }}>
          <Typography component="h2" style={{ textAlign: 'center' }} variant="h4">
            Provider not found
          </Typography>
        </Box>
      )}
    </CustomContainer>
  );
};
