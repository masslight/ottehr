import CardWithDescription from '../components/CardWithDescription';
import { clockFullColor } from '../assets/icons';
import { Skeleton } from '@mui/material';
import { otherColors } from '../IntakeThemeProvider';

interface WaitingEstimateCardProps {
  waitingMinutes: number | undefined;
}

export const WaitingEstimateCard = ({ waitingMinutes }: WaitingEstimateCardProps): JSX.Element => {
  return (
    <CardWithDescription
      icon={clockFullColor}
      iconAlt="Clock icon"
      iconHeight={42}
      mainText="Looking to walk-in?"
      descText={
        <>
          Wait time is currently estimated to be&nbsp;
          <b>
            {waitingMinutes ? (
              Math.floor(waitingMinutes).toLocaleString()
            ) : (
              <Skeleton width="80px" sx={{ display: 'inline-block' }} />
            )}
            &nbsp;&ndash;&nbsp;
            {waitingMinutes ? (
              Math.floor(waitingMinutes + 15).toLocaleString()
            ) : (
              <Skeleton width="80px" sx={{ display: 'inline-block' }} />
            )}
          </b>
          &nbsp;minutes
        </>
      }
      bgColor={otherColors.brightPurple}
    />
  );
};
