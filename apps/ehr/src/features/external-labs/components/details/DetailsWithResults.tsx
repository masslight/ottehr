import React from 'react';
import { LabOrderDetailedPageDTO, TaskReviewedParameters } from 'utils';
import { CSSPageTitle } from '../../../../telemed/components/PageTitle';
import { ResultItem } from './ResultItem';
import { Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { OrderCollection } from '../OrderCollection';

export const DetailsWithResults: React.FC<{
  labOrder: LabOrderDetailedPageDTO;
  markTaskAsReviewed: (parameters: TaskReviewedParameters & { appointmentId: string }) => Promise<void>;
  loading: boolean;
}> = ({ labOrder, markTaskAsReviewed, loading }) => {
  const navigate = useNavigate();

  const handleBack = (): void => {
    navigate(-1);
  };

  return (
    <>
      <CSSPageTitle>{labOrder.testItem}</CSSPageTitle>

      <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
        {labOrder.diagnoses}
      </Typography>

      {labOrder.resultsDetails.map((result) => (
        <ResultItem
          onMarkAsReviewed={() =>
            markTaskAsReviewed({
              taskId: result.taskId,
              serviceRequestId: labOrder.serviceRequestId,
              diagnosticReportId: result.diagnosticReportId,
              appointmentId: labOrder.appointmentId,
            })
          }
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
    </>
  );
};
