import { Stack } from '@mui/system';
import React, { useState } from 'react';
import { LabOrderDetailedPageDTO, UpdateLabOrderResourceParams, LabOrderResultDetails } from 'utils';
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
  const [loading, setLoading] = useState<boolean>(false);

  const handleBack = (): void => {
    navigate(-1);
  };

  const markAsReviewed = async (result: LabOrderResultDetails): Promise<void> => {
    setLoading(true);
    await updateTask({
      taskId: result.taskId,
      serviceRequestId: labOrder.serviceRequestId,
      diagnosticReportId: result.diagnosticReportId,
      event: 'reviewed',
    });
    setLoading(false);
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
            onMarkAsReviewed={() => markAsReviewed(result)}
            resultDetails={result}
            labOrder={labOrder}
            loading={loading}
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
