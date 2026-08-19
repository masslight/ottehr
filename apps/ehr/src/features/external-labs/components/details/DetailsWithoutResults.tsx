import { Alert, Button, Grid, Stack, Typography } from '@mui/material';
import React from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PageTitleStyled } from 'src/features/visits/shared/components/PageTitle';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { PSC_LOCALE } from 'utils/lib/types/data/labs/labs.constants';
import { ExternalLabsStatus, LabOrderDetailedPageDTO } from 'utils/lib/types/data/labs/labs.types';
import { LabsOrderStatusChip } from '../ExternalLabsStatusChip';
import { OrderCollection } from '../OrderCollection';

export const DetailsWithoutResults: React.FC<{
  labOrder: LabOrderDetailedPageDTO;
  // overrides the default back navigation — used by the Review & Sign inline edit flow
  onBack?: () => void;
}> = ({ labOrder, onBack }) => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  return (
    <Stack data-testid={dataTestIds.externalLabs.detailsPg.pageContainer} spacing={2} sx={{ width: '100%' }}>
      <PageTitleStyled>
        ({labOrder.testItemCode}) {labOrder.testItem}
      </PageTitleStyled>
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
          <Grid item sm={12} md={12} lg={12}></Grid>
        </Grid>
      </Stack>
      {labOrder.isGenericOrder && labOrder.orderStatus === ExternalLabsStatus.sent && (
        <Alert severity="warning" sx={{ width: '100%' }}>
          This test will not receive electronic results. Please contact the performing lab for results.
        </Alert>
      )}
      <OrderCollection
        labOrder={labOrder}
        showOrderInfo={labOrder.orderStatus.includes('sent') || labOrder.orderStatus === 'ready'}
        showActionButtons={!isReadOnly}
        onBack={onBack}
      />
      {/* the action buttons (and with them the Back button) are hidden when read-only, but the
          inline flow still needs a way back to the orders list */}
      {isReadOnly && onBack && (
        <Button
          variant="outlined"
          sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600, alignSelf: 'flex-start' }}
          onClick={onBack}
        >
          Back
        </Button>
      )}
    </Stack>
  );
};
