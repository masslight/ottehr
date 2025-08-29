import BiotechOutlinedIcon from '@mui/icons-material/BiotechOutlined';
import { Badge } from '@mui/material';
import { useTheme } from '@mui/system';
import { FC, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { IconButtonContained } from 'src/telemed';
import { useDisplayUnsolicitedResultsIcon } from 'src/telemed';
import { UnsolicitedResultsRequestType } from 'utils';

const POLL_INTERVAL = 1000 * 60 * 3; // 3 minutes

export const UnsolicitedResultsIcon: FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();

  const { data, refetch } = useDisplayUnsolicitedResultsIcon({
    requestType: UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_ICON,
  });
  const displayUnsolicitedResultsIcon = data?.tasksAreReady;

  useEffect(() => {
    const interval = setInterval(() => {
      void refetch();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [refetch]);

  if (!displayUnsolicitedResultsIcon) {
    return <></>;
  }

  const UnsolicitedResultsButton = (
    <GenericToolTip title="Unsolicited results to review" placement="bottom" customWidth="150">
      <IconButtonContained
        id="unsolicited-results-button"
        sx={{ marginRight: { sm: 0, md: 2 } }}
        variant="primary.lightest"
        onClick={() => {
          navigate('/unsolicited-results');
        }}
      >
        <BiotechOutlinedIcon sx={{ color: theme.palette.primary.main }} />
      </IconButtonContained>
    </GenericToolTip>
  );

  return (
    <Badge
      variant="dot"
      color="warning"
      sx={{
        '& .MuiBadge-badge': {
          width: '10px',
          height: '10px',
          borderRadius: '10px',
          top: '6px',
          right: '21px',
        },
      }}
    >
      {UnsolicitedResultsButton}
    </Badge>
  );
};
