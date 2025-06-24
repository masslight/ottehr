import { Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PROJECT_NAME_LOWER } from 'utils';
import { otherColors } from '../IntakeThemeProvider';
import { ottehrLightBlue } from '../themes/ottehr/icons';
import CardWithDescription from './CardWithDescription';

interface WaitingEstimateCardProps {
  waitingMinutes: number | undefined;
}

export const WaitingEstimateCard = ({ waitingMinutes }: WaitingEstimateCardProps): JSX.Element => {
  let formattedWaitingMinutes;
  if (waitingMinutes !== undefined) {
    formattedWaitingMinutes = Math.floor(waitingMinutes / 5) * 5;
  }
  const { t } = useTranslation();

  return (
    <CardWithDescription
      icon={ottehrLightBlue}
      iconAlt={`${PROJECT_NAME_LOWER} icon`}
      iconHeight={70}
      mainText={t('waitingEstimate.title')}
      descText={
        waitingMinutes && waitingMinutes > 40 ? (
          'Please contact the office for a walk-in estimate'
        ) : (
          <>
            {t('waitingEstimate.description')}
            <b>
              {formattedWaitingMinutes !== undefined ? (
                formattedWaitingMinutes
              ) : (
                <Skeleton width="80px" sx={{ display: 'inline-block' }} />
              )}
            </b>
            {t('waitingEstimate.minutes')}
            {/* previous waiting minutes display
          <b>
            {waitingMinutes !== undefined ? (
              Math.floor(waitingMinutes).toLocaleString()
            ) : (
              <Skeleton width="80px" sx={{ display: 'inline-block' }} />
            )}
            &nbsp;&ndash;&nbsp;
            {waitingMinutes !== undefined ? (
              Math.floor(waitingMinutes + 15).toLocaleString()
            ) : (
              <Skeleton width="80px" sx={{ display: 'inline-block' }} />
            )}
          </b>
          &nbsp;minutes */}
          </>
        )
      }
      bgColor={otherColors.purple}
      marginTop={0}
      marginBottom={2}
    />
  );
};
