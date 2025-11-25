import { Box, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { updateLabOrderResources } from 'src/api/api';
import { LoadingScreen } from 'src/components/LoadingScreen';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { useGetUnsolicitedResultsDetail } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useApiClients } from 'src/hooks/useAppClients';
import { TaskReviewedParameters, UnsolicitedResultsRequestType } from 'utils';
import { DetailsWithResults } from '../components/details/DetailsWithResults';

export const UnsolicitedResultsReview: React.FC = () => {
  const { oystehrZambda } = useApiClients();
  const navigate = useNavigate();
  const urlParams = useParams();
  const queryClient = useQueryClient();
  const [markingAsReviewed, setMarkingAsReviewed] = useState<boolean>(false);

  const diagnosticReportId = urlParams.diagnosticReportId as string;

  const {
    data,
    // error: resourceSearchError,
    isLoading: loadingResources,
  } = useGetUnsolicitedResultsDetail({
    requestType: UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_DETAIL,
    diagnosticReportId,
  });

  const markAsReviewed = async (input: TaskReviewedParameters): Promise<void> => {
    if (oystehrZambda) {
      const { taskId, diagnosticReportId } = input;
      try {
        setMarkingAsReviewed(true);
        await Promise.all([
          await updateLabOrderResources(oystehrZambda, {
            taskId,
            serviceRequestId: undefined,
            diagnosticReportId,
            event: 'reviewed',
          }),
          await queryClient.invalidateQueries({
            queryKey: ['get unsolicited results resources'],
            exact: false,
          }),
        ]);
        const patientId = data?.unsolicitedLabDTO.patientId;
        navigate(`/patient/${patientId}`); // todo somehow this needs to select the lab tab
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

  if (!data?.unsolicitedLabDTO) return null;

  return (
    <>
      {!data?.unsolicitedLabDTO ? (
        <Typography color="error" variant="h6" align="center" mt="24px">
          There was loading this page. Please try again.
        </Typography>
      ) : (
        <Box sx={{ paddingTop: '24px' }}>
          <DetailPageContainer>
            <DetailsWithResults
              labOrder={data.unsolicitedLabDTO}
              markTaskAsReviewed={markAsReviewed}
              loading={loadingResources || markingAsReviewed}
            />
          </DetailPageContainer>
        </Box>
      )}
    </>
  );
};
