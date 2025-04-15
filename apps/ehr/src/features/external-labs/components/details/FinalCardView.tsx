import { Box, Button, Switch, Typography } from '@mui/material';
import { FC } from 'react';
import { ExternalLabsStatus } from 'utils';

interface FinalCardViewProps {
  labStatus: ExternalLabsStatus;
  onMarkAsReviewed: () => void;
}

export const FinalCardView: FC<FinalCardViewProps> = ({ labStatus, onMarkAsReviewed }) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Switch
          disabled={true} // todo: will be released in the future
          checked={false} // todo: will be released in the future
          onChange={() => null} // todo: will be released in the future
          color="primary"
          sx={{ mr: 1 }}
        />
        <Typography variant="body2">Show Results on the Patient Portal</Typography>
      </Box>

      {labStatus === ExternalLabsStatus.received ? (
        <Button
          variant="contained"
          onClick={onMarkAsReviewed}
          sx={{
            borderRadius: '50px',
            textTransform: 'none',
          }}
          color="primary"
        >
          Mark as Reviewed
        </Button>
      ) : null}
    </Box>
  );
};
