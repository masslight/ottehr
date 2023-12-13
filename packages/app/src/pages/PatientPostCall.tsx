import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CustomContainer } from '../components';
import { useParticipant, useVideoParticipant } from '../store';
import { getRelativeTime } from '../helpers';

// TODO: Merge 2 post call pages in one
export const PatientPostCall = (): JSX.Element => {
  const { providerName } = useParticipant();
  const { t } = useTranslation();
  const { callStart } = useVideoParticipant();
  const callDuration = getRelativeTime(callStart);

  return (
    <CustomContainer isProvider={false} subtitle={providerName} title={t('general.waitingRoom')}>
      <Typography mb={1} variant="h5">
        {t('postCall.callEnded')}
      </Typography>
      <Typography mb={1} variant="body1">
        {t('postCall.durationPrefix')}
        {callDuration}
      </Typography>
    </CustomContainer>
  );
};
