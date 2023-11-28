import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CustomButton, CustomContainer, LoadingSpinner } from '../components';
import { createPatientName, createProviderName } from '../helpers';
import { useAuth0 } from '@auth0/auth0-react';
import { getPatients, getProvider } from '../helpers/mockData';
import { useEffect, useState } from 'react';

export const PostCall = (): JSX.Element => {
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const goToDashboard = (): void => {
    navigate('/dashboard');
  };

  // TODO hard-coded data
  const mockCallDuration = '15:05';
  const patient = getPatients()[0];
  const provider = getProvider();

  let subtitle = '';
  let title = '';
  if (isAuthenticated) {
    subtitle = createPatientName(patient);
    title = t('postCall.callWith');
  } else {
    subtitle = createProviderName(provider, false);
    title = t('general.waitingRoom');
  }

  useEffect(() => {
    if (!provider) {
      setIsLoading(true);
    } else if (provider) {
      setIsLoading(false);
    }
  }, [provider]);

  return (
    <CustomContainer isProvider={isAuthenticated} subtitle={subtitle} title={title}>
      {isLoading && <LoadingSpinner transparent={false} />}
      <Typography mb={1} variant="h5">
        {t('postCall.callEnded')}
      </Typography>
      <Typography mb={1} variant="body1">
        {t('postCall.durationPrefix')}
        {mockCallDuration}
        {t('postCall.durationSuffix')}
      </Typography>
      {isAuthenticated && (
        <CustomButton fitContent onClick={goToDashboard}>
          {t('postCall.goToDashboard')}
        </CustomButton>
      )}
    </CustomContainer>
  );
};
