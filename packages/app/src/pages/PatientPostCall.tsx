import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CustomContainer } from '../components';
import { useParticipant } from '../store';

export const PatientPostCall = (): JSX.Element => {
  const { providerName } = useParticipant();
  const { t } = useTranslation();

  // TODO hard-coded data #Post-Call ticket
  const mockCallDuration = '15:05';

  return (
    <CustomContainer isProvider={false} subtitle={providerName} title={t('general.waitingRoom')}>
      <Typography mb={1} variant="h5">
        {t('postCall.callEnded')}
      </Typography>
      <Typography mb={1} variant="body1">
        {t('postCall.durationPrefix')}
        {mockCallDuration}
        {t('postCall.durationSuffix')}
      </Typography>
    </CustomContainer>
  );
};
