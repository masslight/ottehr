import React, { useState } from 'react';
import { Typography, Stack, Grid } from '@mui/material';
import { OrderCollection } from '../OrderCollection';
import { CSSPageTitle } from '../../../../telemed/components/PageTitle';
import { LabOrderDetailedPageDTO } from 'utils';
import { LabTableStatusChip } from '../labs-orders/LabTableStatusChip';

interface CollectionInstructions {
  container: string;
  volume: string;
  minimumVolume: string;
  storageRequirements: string;
  collectionInstructions: string;
}

export const DetailsWithoutResults: React.FC<{ labOrder: LabOrderDetailedPageDTO }> = ({ labOrder }) => {
  // Note: specimens are no longer MVP, and also we'll be getting specimens from Create Order
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [specimen, setSpecimen] = useState({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [collectionInstructions, setCollectionInstructions] = useState({} as CollectionInstructions);

  return (
    <>
      <Stack spacing={2} sx={{ p: 3 }}>
        <CSSPageTitle>{labOrder.testItem}</CSSPageTitle>
        <Stack
          direction="row"
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography sx={{ minWidth: '400px' }} variant="body1">
            {labOrder.diagnoses}
          </Typography>
          <Grid container justifyContent="end" spacing={2}>
            <Grid item>
              <LabTableStatusChip status={labOrder.orderStatus} />
            </Grid>
            <Grid item>
              <Typography variant="body1">{labOrder.orderSource}</Typography>
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
        <OrderCollection labOrder={labOrder} />
      </Stack>
    </>
  );
};
