import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PageTitleStyled } from 'src/features/visits/shared/components/PageTitle';
import {
  LabOrderDetailedPageDTO,
  ReflexLabDTO,
  TaskReviewedParameters,
  UnsolicitedLabDTO,
} from 'utils/lib/types/data/labs/labs.types';
import { OrderCollection } from '../OrderCollection';
import { ResultItem } from './ResultItem';

export const DetailsWithResults: React.FC<{
  labOrder: LabOrderDetailedPageDTO | UnsolicitedLabDTO | ReflexLabDTO;
  markTaskAsReviewed: (parameters: TaskReviewedParameters & { appointmentId?: string }) => Promise<void>;
  loading: boolean;
  onBack: () => void;
}> = ({ labOrder, markTaskAsReviewed, loading, onBack }) => {
  const drCentricResult = 'drCentricResultType' in labOrder || 'isUnsolicited' in labOrder;

  let serviceRequestId: string | undefined, appointmentId: string | undefined;
  if (!drCentricResult) {
    serviceRequestId = labOrder.serviceRequestId;
    appointmentId = labOrder.appointmentId;
  }

  return (
    <Box data-testid={dataTestIds.externalLabs.detailsPg.pageContainer}>
      <PageTitleStyled>
        ({labOrder.testItemCode}) {labOrder.testItem}
      </PageTitleStyled>

      {!drCentricResult && (
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

      {!drCentricResult && (
        <OrderCollection
          showActionButtons={false}
          showOrderInfo={false}
          isAOECollapsed={true}
          labOrder={labOrder}
          onBack={onBack}
        />
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
        onClick={onBack}
      >
        Back
      </Button>
    </Box>
  );
};
