import React from 'react';
import { useParams } from 'react-router-dom';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { LabOrdersSearchBy } from 'utils';
import { DetailsWithoutResults } from '../components/details/DetailsWithoutResults';
import { DetailsWithResults } from '../components/details/DetailsWithResults';
import { ReflexResultDetails } from '../components/details/ReflexResultDetails';
import { LabBreadcrumbs } from '../components/labs-orders/LabBreadcrumbs';
import { LabOrderLoading } from '../components/labs-orders/LabOrderLoading';
import { usePatientLabOrders } from '../components/labs-orders/usePatientLabOrders';

export const OrderDetailsPage: React.FC = () => {
  const urlParams = useParams();
  const id = urlParams.id as string;
  const serviceRequestId = urlParams.serviceRequestID as string;
  const diagnosticReportId = urlParams.diagnosticReportId as string;

  const isReflexLab = !!diagnosticReportId;

  const searchBy: LabOrdersSearchBy['searchBy'] = isReflexLab
    ? { field: 'diagnosticReportId', value: diagnosticReportId }
    : { field: 'serviceRequestId', value: serviceRequestId };

  const { labOrders, reflexResults, loading, markTaskAsReviewed } = usePatientLabOrders({ searchBy });

  // todo: validate response on the get-lab-orders zambda and use labOrder[0]
  const labOrder = labOrders.find((order) => order.serviceRequestId === serviceRequestId);

  const status = labOrder?.orderStatus;

  if (loading) {
    return <LabOrderLoading />;
  }

  if (isReflexLab && reflexResults.length) {
    const matchingResult = reflexResults.find((result) =>
      result.resultsDetails.find((detail) => detail.diagnosticReportId === diagnosticReportId)
    );
    if (matchingResult) {
      return (
        <ReflexResultDetails
          reflexResult={matchingResult}
          loadingOrders={loading}
          appointmentId={id}
        ></ReflexResultDetails>
      );
    } else {
      console.error('Could not match to result result');
      return null;
    }
  } else if (!labOrder) {
    console.error('No external lab order found');
    return null;
  }

  const pageName = labOrder.testItem;

  if (status === 'pending' || status === 'ready' || status?.includes('sent')) {
    return (
      <DetailPageContainer>
        <LabBreadcrumbs sectionName={pageName}>
          <DetailsWithoutResults labOrder={labOrder} />
        </LabBreadcrumbs>
      </DetailPageContainer>
    );
  }

  return (
    <DetailPageContainer>
      <LabBreadcrumbs sectionName={pageName}>
        <DetailsWithResults labOrder={labOrder} markTaskAsReviewed={markTaskAsReviewed} loading={loading} />
      </LabBreadcrumbs>
    </DetailPageContainer>
  );
};
