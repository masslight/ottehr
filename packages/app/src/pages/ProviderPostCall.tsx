import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CustomButton, CustomContainer, LoadingSpinner } from '../components';
import { createPatientName } from '../helpers';
import { useAuth0 } from '@auth0/auth0-react';

export const ProviderPostCall = (): JSX.Element => {
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const goToDashboard = (): void => {
    navigate('/dashboard');
  };

  // TODO hard-coded data #Post-Call ticket
  const mockCallDuration = '15:05';
  const patient = {
    encounterId: '0b669dc1-ad4c-43c2-84f1-c010400889e2',
    name: 'John Doe',
    queuedTime: '2023-09-29T08:15:00Z',
  };

  if (!isAuthenticated) {
    return <LoadingSpinner transparent={false} />;
  }

  return (
    <CustomContainer isProvider={true} subtitle={createPatientName(patient)} title={t('postCall.callWith')}>
      <Typography mb={1} variant="h5">
        {t('postCall.callEnded')}
      </Typography>
      <Typography mb={1} variant="body1">
        {t('postCall.durationPrefix')}
        {mockCallDuration}
        {t('postCall.durationSuffix')}
      </Typography>
      <CustomButton fitContent onClick={goToDashboard}>
        {t('postCall.goToDashboard')}
      </CustomButton>
    </CustomContainer>
  );
};
