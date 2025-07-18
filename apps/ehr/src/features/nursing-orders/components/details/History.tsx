import { Box, Grid, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { NursingOrderHistoryRow } from 'utils';
import { NursingOrdersStatusChip } from '../NursingOrdersStatusChip';

const formatDateTime = (dateString: string): string => {
  try {
    return DateTime.fromISO(dateString).toFormat("MM/dd/yyyy 'at' h:mm a");
  } catch {
    return dateString;
  }
};

type HistoryProps = {
  orderHistory: NursingOrderHistoryRow[];
};

export const History: FC<HistoryProps> = ({ orderHistory }) => {
  return (
    <Box>
      {orderHistory.map((item) => (
        <Box key={item.status}>
          <Grid container sx={{ px: 2, py: 1.5 }}>
            <Grid item xs={3}>
              <NursingOrdersStatusChip status={item.status} />
            </Grid>
            <Grid item xs={4}>
              <Typography variant="body2">{item.performer}</Typography>
            </Grid>
            <Grid item xs={5}>
              <Typography variant="body2">{formatDateTime(item.date)}</Typography>
            </Grid>
          </Grid>
        </Box>
      ))}
    </Box>
  );
};
