import React from 'react';
import { LabOrderDetailedPageDTO, SpecimenDateChangedParameters, TaskReviewedParameters } from 'utils';
import { CSSPageTitle } from '../../../../telemed/components/PageTitle';
import { ResultItem } from './ResultItem';
import { Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { OrderCollection } from '../OrderCollection';

export const DetailsWithResults: React.FC<{
  labOrder: LabOrderDetailedPageDTO;
  markTaskAsReviewed: (parameters: TaskReviewedParameters) => Promise<void>;
  saveSpecimenDate: (parameters: SpecimenDateChangedParameters) => Promise<void>;
  loading: boolean;
}> = ({ labOrder, markTaskAsReviewed, saveSpecimenDate, loading }) => {
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
            })
          }
          resultDetails={result}
          labOrder={labOrder}
          loading={loading}
        />
      ))}

      <OrderCollection
        showActionButtons={false}
        showOrderInfo={false}
        isAOECollapsed={true}
        labOrder={labOrder}
        saveSpecimenDate={saveSpecimenDate}
      />

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
