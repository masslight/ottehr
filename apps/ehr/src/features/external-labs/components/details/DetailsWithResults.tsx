import { Stack } from '@mui/system';
import React from 'react';
import { LabOrderDetailedPageDTO, UpdateLabOrderResourceParams } from 'utils';
import { CSSPageTitle } from '../../../../telemed/components/PageTitle';
import { ResultItem } from './ResultItem';
import { Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { OrderCollection } from '../OrderCollection';

export const DetailsWithResults: React.FC<{
  labOrder: LabOrderDetailedPageDTO;
  updateTask: (params: UpdateLabOrderResourceParams) => Promise<void>;
}> = ({ labOrder, updateTask }) => {
  const navigate = useNavigate();

  const handleBack = (): void => {
    navigate(-1);
  };

  return (
    <div style={{ maxWidth: '890px', width: '100%', margin: '0 auto' }}>
      <Stack spacing={2} sx={{ p: 3 }}>
        <CSSPageTitle>{labOrder.testItem}</CSSPageTitle>

        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
          {labOrder.diagnoses}
        </Typography>

        {labOrder.resultsDetails.map((result) => (
          <ResultItem
            onMarkAsReviewed={() =>
              updateTask({
                taskId: result.taskId,
                serviceRequestId: labOrder.serviceRequestId,
                diagnosticReportId: result.diagnosticReportId,
                event: 'reviewed',
              })
            }
            resultDetails={result}
            labOrder={labOrder}
          />
        ))}

        <OrderCollection showActionButtons={false} showOrderInfo={false} isAOECollapsed={true} labOrder={labOrder} />

        <Button
          variant="outlined"
          color="primary"
          sx={{
            borderRadius: 28,
            padding: '8px 22px',
            alignSelf: 'flex-start',
            marginTop: 2,
            textTransform: 'none',
          }}
          onClick={handleBack}
        >
          Back
        </Button>
      </Stack>
    </div>
  );
};
