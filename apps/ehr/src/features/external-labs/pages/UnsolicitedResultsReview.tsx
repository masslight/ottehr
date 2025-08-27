import { Box } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import { updateLabOrderResources } from 'src/api/api';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetUnsolicitedResultsResourcesForReview } from 'src/telemed';
import { TaskReviewedParameters, UnsolicitedResultsRequestType } from 'utils';
import { DetailsWithResults } from '../components/details/DetailsWithResults';

export const UnsolicitedResultsReview: React.FC = () => {
  const { oystehrZambda } = useApiClients();
  const urlParams = useParams();
  const diagnosticReportId = urlParams.diagnosticReportId as string;
  console.log('diagnosticReportId', diagnosticReportId);

  const {
    data,
    // error: resourceSearchError,
    isLoading,
  } = useGetUnsolicitedResultsResourcesForReview({
    requestType: UnsolicitedResultsRequestType.UNSOLICITED_RESULT_DETAIL,
    diagnosticReportId,
  });

  const markAsReviewed = async (input: TaskReviewedParameters): Promise<void> => {
    if (oystehrZambda) {
      const { taskId, serviceRequestId, diagnosticReportId } = input;
      await updateLabOrderResources(oystehrZambda, { taskId, serviceRequestId, diagnosticReportId, event: 'reviewed' });
    } else {
      console.log('error making as reviewed');
    }
  };

  console.log('data.labOrder', data?.labOrder);

  if (!data?.labOrder) return null;

  return (
    <DetailPageContainer>
      <Box sx={{ paddingTop: '24px' }}>
        <DetailsWithResults labOrder={data.labOrder} markTaskAsReviewed={markAsReviewed} loading={isLoading} />
      </Box>
    </DetailPageContainer>
  );
};
