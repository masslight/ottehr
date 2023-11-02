import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CustomButton, CustomContainer } from '../components';
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
      <Typography mb={1} variant="h5">
        {t('postCall.callEnded')}
      </Typography>
      <Typography mb={1} variant="body1">
        {t('postCall.durationPrefix')}
        {mockCallDuration}
        {t('postCall.durationSuffix')}
      </Typography>
      {isProvider && (
        <CustomButton fitContent onClick={goToDashboard}>
          {t('postCall.goToDashboard')}
        </CustomButton>
      )}
    </CustomContainer>
  );
};
