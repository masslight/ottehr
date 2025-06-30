import { Grid, Stack, Typography } from '@mui/material';
import React from 'react';
import { LabOrderDetailedPageDTO, PSC_LOCALE } from 'utils';
import { CSSPageTitle } from '../../../../telemed/components/PageTitle';
import { LabsOrderStatusChip } from '../ExternalLabsStatusChip';
import { OrderCollection } from '../OrderCollection';

export const DetailsWithoutResults: React.FC<{
  labOrder: LabOrderDetailedPageDTO;
}> = ({ labOrder }) => {
  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <CSSPageTitle>{labOrder.testItem}</CSSPageTitle>
      <Stack
        direction="row"
        spacing={2}
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="body1" width="100%">
          {labOrder.diagnoses}
        </Typography>
        <Grid container justifyContent="end" spacing={2}>
          <Grid item sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 'bold', mr: 1 }}>
              {labOrder.isPSC ? PSC_LOCALE : ''}
            </Typography>
          </Grid>
          <Grid item>
            <LabsOrderStatusChip status={labOrder.orderStatus} />
          </Grid>
        </Grid>
      </Stack>
      {/* {taskStatus === 'pending' && (
          <TaskBanner
            orderName={labOrder.testItem}
            orderingPhysician={labOrder.orderingPhysician}
            orderedOnDate={labOrder.orderAddedDate}
            labName={labOrder?.fillerLab}
            taskStatus={taskStatus}
          />
        )} */}
      <OrderCollection labOrder={labOrder} showOrderInfo={labOrder.orderStatus === 'sent'} />
    </Stack>
  );
};
