import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { CustomButton, CustomContainer, LoadingSpinner } from '../components';
import { createPatientName, getRelativeTime } from '../helpers';
import { useAuth0 } from '@auth0/auth0-react';
import { useParticipant, useVideoParticipant } from '../store';

export const PostCall = (): JSX.Element => {
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { callStart } = useVideoParticipant();
  const { providerName } = useParticipant();
  const location = useLocation();
  const isProvider = location.state?.isProvider || false;

  const goToDashboard = (): void => {
    navigate('/dashboard');
  };
  const callDuration = getRelativeTime(callStart);
  // TODO hard-coded data #Post-Call ticket
  const patient = {
    encounterId: '0b669dc1-ad4c-43c2-84f1-c010400889e2',
    name: 'John Doe',
    queuedTime: '2023-09-29T08:15:00Z',
  };

  if (isProvider && !isAuthenticated) {
    return <LoadingSpinner transparent={false} />;
  }

  return (
    <CustomContainer
      isProvider={isProvider}
      subtitle={isProvider ? createPatientName(patient) : providerName}
      title={isProvider ? t('postCall.callWith') : t('general.waitingRoom')}
    >
      <Typography mb={1} variant="h5">
        {t('postCall.callEnded')}
      </Typography>
      <Typography mb={1} variant="body1">
        {t('postCall.durationPrefix')}
        {callDuration}
      </Typography>
      {isProvider && (
        <CustomButton fitContent onClick={goToDashboard}>
          {t('postCall.goToDashboard')}
        </CustomButton>
      )}
    </CustomContainer>
  );
};
