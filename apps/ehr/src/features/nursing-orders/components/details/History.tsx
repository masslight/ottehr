import { FC } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { NursingOrder } from '../../nursingOrderTypes';
import { NursingOrdersStatusChip } from '../NursingOrdersStatusChip';

const formatDateTime = (dateString: string): string => {
  try {
    return DateTime.fromISO(dateString).toFormat("MM/dd/yyyy 'at' h:mm a");
  } catch (error) {
    return dateString;
  }
};

type HistoryProps = {
  orderDetails: NursingOrder;
};

export const History: FC<HistoryProps> = ({ orderDetails }) => {
  return (
    <Box>
      {orderDetails.orderDetails && (
        <Box>
          <Grid container sx={{ px: 2, py: 1.5 }}>
            <Grid item xs={3}>
              <NursingOrdersStatusChip status={orderDetails.status} />
            </Grid>
            <Grid item xs={4}>
              <Typography variant="body2">{orderDetails.orderDetails.orderedBy}</Typography>
            </Grid>
            <Grid item xs={5}>
              <Typography variant="body2">{formatDateTime(orderDetails.orderDetails.orderedDate)}</Typography>
            </Grid>
          </Grid>
        </Box>
      )}
    </Box>
  );
};
