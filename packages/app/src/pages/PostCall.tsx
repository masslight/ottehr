import { Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { otherStyling } from '../OttehrThemeProvider';
import { CustomContainer } from '../components';
import { createPatientName, createProviderName } from '../helpers';
import { getPatients, getProvider } from '../helpers/mockData';

export const PostCall = (): JSX.Element => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const goToDashboard = (): void => {
    navigate('/dashboard');
  };

  // TODO hard-coded data
  const mockCallDuration = '15:05';
  const isProvider = true;
  const patient = getPatients()[0];
  const provider = getProvider();

  let subtitle = '';
  let title = '';
  if (isProvider) {
    subtitle = createPatientName(patient);
    title = t('postCall.callWith');
  } else {
    subtitle = createProviderName(provider, false);
    title = t('general.waitingRoom');
  }

  return (
    <CustomContainer isProvider={isProvider} subtitle={subtitle} title={title}>
      <Typography variant="h5">{t('postCall.callEnded')}</Typography>
      <Typography mb={2} variant="body1">
        {t('postCall.durationPrefix')}
        {mockCallDuration}
        {t('postCall.durationSuffix')}
      </Typography>
      {isProvider && (
        <Button
          onClick={goToDashboard}
          sx={{
            ...otherStyling.buttonPrimary,
            px: 2,
            text: 'primary.contrast',
            width: 'fit-content',
          }}
          variant="contained"
        >
          {t('postCall.goToDashboard')}
        </Button>
      )}
    </CustomContainer>
  );
};
