import { Typography, Grid } from '@mui/material';
import { Stack } from '@mui/system';
import React from 'react';
import { LabOrderDTO } from 'utils';
import { CSSPageTitle } from '../../../../telemed/components/PageTitle';
import { OrderHistoryCard } from '../OrderHistoryCard';
import { Questionarie } from './Questionarie';
import { LabTableStatusChip } from '../labs-orders/LabTableStatusChip';

export const DetailsWithResults: React.FC<{ labOrder?: LabOrderDTO }> = ({ labOrder }) => {
  if (!labOrder) {
    return null;
  }

  return (
    <>
      <Stack spacing={2} sx={{ p: 3 }}>
        <CSSPageTitle>{labOrder.typeLab}</CSSPageTitle>

        <Stack
          direction="row"
          spacing={2}
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="body1" sx={{ width: '100%' }}>
            {labOrder.diagnoses.map((dx) => {
              const diagnosis = `${dx.code} ${dx.display}`;
              return <div key={diagnosis}>{diagnosis}</div>;
            })}
          </Typography>

          <Grid container justifyContent="end" spacing={2} alignItems="center">
            <Grid item>
              <LabTableStatusChip status={labOrder.orderStatus} />
            </Grid>
            <Grid item>
              <Typography variant="body1" sx={{ textTransform: 'uppercase', fontWeight: 'bold', fontSize: '0.9rem' }}>
                {labOrder.performedBy}
              </Typography>
            </Grid>
          </Grid>
        </Stack>
        <Questionarie />
        <OrderHistoryCard />
      </Stack>
    </>
  );
};
