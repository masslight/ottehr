import { TextField, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CustomButton, CustomContainer } from '../components';
import { createProviderName } from '../helpers';
import { usePatient } from '../store';
import { getProvider } from '../helpers/mockData';

export const CheckIn = (): JSX.Element => {
  const navigate = useNavigate();
  const { patientName, setPatientName } = usePatient();
  const { t } = useTranslation();
  const [isError, setIsError] = useState(false);
  const [name, setName] = useState(patientName);

  // TODO hard-coded data
  const provider = getProvider();

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
    <CustomContainer isProvider={false} subtitle={createProviderName(provider, false)} title={t('general.waitingRoom')}>
      <Typography sx={{ pb: 1 }} variant="h5">
        {t('checkIn.checkIn')}
      </Typography>
      <Typography sx={{ pb: 3 }} variant="body1">
        {t('checkIn.enterNamePrefix')}
        {createProviderName(provider)}
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
