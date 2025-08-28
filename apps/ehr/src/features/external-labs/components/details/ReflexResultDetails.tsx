import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateLabOrderResources } from 'src/api/api';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { useApiClients } from 'src/hooks/useAppClients';
import { ReflexLabDTO, TaskReviewedParameters } from 'utils';
import { LabBreadcrumbs } from '../labs-orders/LabBreadcrumbs';
import { DetailsWithResults } from './DetailsWithResults';

interface ReflexResultDetailsProps {
  reflexResult: ReflexLabDTO;
  loadingOrders: boolean;
  appointmentId: string;
}

export const ReflexResultDetails: FC<ReflexResultDetailsProps> = ({ reflexResult, loadingOrders, appointmentId }) => {
  const [markingAsReviewed, setMarkingAsReviewed] = useState<boolean>(false);
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();

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
        navigate(`/in-person/${appointmentId}/external-lab-orders`);
      } catch (e) {
        console.log('error: ', e);
      } finally {
        setMarkingAsReviewed(false);
      }
    } else {
      console.log('error making as reviewed');
    }
  };

  return (
    <DetailPageContainer>
      <LabBreadcrumbs sectionName={reflexResult.testItem}>
        <DetailsWithResults
          labOrder={reflexResult}
          markTaskAsReviewed={markAsReviewed}
          loading={loadingOrders || markingAsReviewed}
        />
      </LabBreadcrumbs>
    </DetailPageContainer>
  );
};
