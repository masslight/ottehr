import { Box, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { updateLabOrderResources } from 'src/api/api';
import { LoadingScreen } from 'src/components/LoadingScreen';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { useApiClients } from 'src/hooks/useAppClients';
import { useGetUnsolicitedResultsResourcesForReview } from 'src/telemed';
import { TaskReviewedParameters, UnsolicitedResultsRequestType } from 'utils';
import { DetailsWithResults } from '../components/details/DetailsWithResults';

export const UnsolicitedResultsReview: React.FC = () => {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const urlParams = useParams();
  const [markingAsReviewed, setMarkingAsReviewed] = useState<boolean>(false);

  const diagnosticReportId = urlParams.diagnosticReportId as string;
  console.log('diagnosticReportId', diagnosticReportId);

  const {
    data,
    // error: resourceSearchError,
    isLoading: loadingResources,
  } = useGetUnsolicitedResultsResourcesForReview({
    requestType: UnsolicitedResultsRequestType.UNSOLICITED_RESULT_DETAIL,
    diagnosticReportId,
  });

  const markAsReviewed = async (input: TaskReviewedParameters): Promise<void> => {
    if (oystehrZambda) {
      const { taskId, diagnosticReportId } = input;
      try {
        setMarkingAsReviewed(true);
        await updateLabOrderResources(oystehrZambda, {
          taskId,
          serviceRequestId: undefined,
          diagnosticReportId,
          event: 'reviewed',
        });
        const patientId = data?.labOrder.patientId;
        navigate(`/patient/${patientId}`); // todo sarah somehow this needs to select the lab tab
      } catch (e) {
        console.log('error: ', e);
      } finally {
        setMarkingAsReviewed(false);
      }
    } else {
      console.log('error making as reviewed');
    }
  };

  if (loadingResources) {
    return <LoadingScreen />;
  }

  if (!data?.labOrder) return null;

  return (
    <>
      {!data?.labOrder ? (
        <Typography color="error" variant="h6" align="center" mt="24px">
          There was loading this page. Please try again.
        </Typography>
      ) : (
        <DetailPageContainer>
          <Box sx={{ paddingTop: '24px' }}>
            <DetailsWithResults
              labOrder={data.labOrder}
              markTaskAsReviewed={markAsReviewed}
              loading={loadingResources || markingAsReviewed}
            />
          </Box>
        </DetailPageContainer>
      )}
    </>
  );
};
