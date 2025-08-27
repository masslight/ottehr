import { Button, Typography } from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LabOrderDetailedPageDTO, TaskReviewedParameters, UnsolicitedLabDetailedPageDTO } from 'utils';
import { CSSPageTitle } from '../../../../telemed/components/PageTitle';
import { OrderCollection } from '../OrderCollection';
import { ResultItem } from './ResultItem';

export const DetailsWithResults: React.FC<{
  labOrder: LabOrderDetailedPageDTO | UnsolicitedLabDetailedPageDTO;
  markTaskAsReviewed: (parameters: TaskReviewedParameters & { appointmentId?: string }) => Promise<void>;
  loading: boolean;
}> = ({ labOrder, markTaskAsReviewed, loading }) => {
  const navigate = useNavigate();
  console.log('labOrder', labOrder);

  const handleBack = (): void => {
    navigate(-1);
  };

  const isUnsolicitedPage = 'isUnsolicited' in labOrder;

  let serviceRequestId: string | undefined, appointmentId: string | undefined;
  if (!isUnsolicitedPage) {
    serviceRequestId = labOrder.serviceRequestId;
    appointmentId = labOrder.appointmentId;
  }

  return (
    <>
      <CSSPageTitle>{labOrder.testItem}</CSSPageTitle>

      {!isUnsolicitedPage && (
        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
          {labOrder.diagnoses}
        </Typography>
      )}

      {labOrder.resultsDetails.map((result, idx) => (
        <ResultItem
          key={`result-detail-${idx}-${result.diagnosticReportId}`}
          onMarkAsReviewed={() =>
            markTaskAsReviewed({
              taskId: result.taskId,
              serviceRequestId: serviceRequestId,
              diagnosticReportId: result.diagnosticReportId,
              appointmentId: appointmentId,
            })
          }
          resultDetails={result}
          labOrder={labOrder}
          loading={loading}
        />
      ))}

      {!isUnsolicitedPage && (
        <OrderCollection showActionButtons={false} showOrderInfo={false} isAOECollapsed={true} labOrder={labOrder} />
      )}

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
