import React from 'react';
import { useParams } from 'react-router-dom';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { LabOrdersSearchBy } from 'utils/lib/types/data/labs/labs.types';
import { DetailsWithoutResults } from '../components/details/DetailsWithoutResults';
import { DetailsWithResults } from '../components/details/DetailsWithResults';
import { DiagnosticReportCentricResultDetails } from '../components/details/DiagnosticReportCentricResultDetails';
import { LabBreadcrumbs } from '../components/labs-orders/LabBreadcrumbs';
import { LabOrderLoading } from '../components/labs-orders/LabOrderLoading';
import { usePatientLabOrders } from '../components/labs-orders/usePatientLabOrders';

interface OrderDetailsPageProps {
  // set by the Review & Sign inline edit flow, which has no URL params of its own and
  // collapses back to its order list instead of navigating away
  serviceRequestId?: string;
  onBack?: () => void;
}

export const OrderDetailsPage: React.FC<OrderDetailsPageProps> = ({
  serviceRequestId: serviceRequestIdProp,
  onBack,
}) => {
  const urlParams = useParams();
  const id = urlParams.id as string;
  const serviceRequestId = serviceRequestIdProp ?? (urlParams.serviceRequestID as string);
  const diagnosticReportId = urlParams.diagnosticReportId as string;

  // SR driven labs aka solicited labs will not have the url param diagnosticReportId
  // they could have an associated diagnostic report but it won't be passed in the url
  // a "dr centric" lab would be a pdf attachment result or a reflex result.
  // Inline the order is addressed by service request id, so those results stay page-only.
  const isDrCentricLab = !serviceRequestIdProp && !!diagnosticReportId;

  const searchBy: LabOrdersSearchBy['searchBy'] = isDrCentricLab
    ? { field: 'diagnosticReportId', value: diagnosticReportId }
    : { field: 'serviceRequestId', value: serviceRequestId };

  const { labOrders, drDrivenResults, loading, markTaskAsReviewed } = usePatientLabOrders({ searchBy });

  // todo: validate response on the get-lab-orders zambda and use labOrder[0]
  const labOrder = labOrders.find((order) => order.serviceRequestId === serviceRequestId);

  const status = labOrder?.orderStatus;

  if (loading) {
    return <LabOrderLoading />;
  }

  if (isDrCentricLab && drDrivenResults.length) {
    const matchingResult = drDrivenResults.find((result) =>
      result.resultsDetails.find((detail) => detail.diagnosticReportId === diagnosticReportId)
    );
    if (matchingResult) {
      return (
        <DiagnosticReportCentricResultDetails
          results={matchingResult}
          loadingOrders={loading}
          appointmentId={id}
        ></DiagnosticReportCentricResultDetails>
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

  if (status === 'pending' || status === 'ready' || status?.includes('sent') || status === 'rejected abn') {
    return (
      <DetailPageContainer>
        <LabBreadcrumbs sectionName={pageName}>
          <DetailsWithoutResults labOrder={labOrder} onBack={onBack} />
        </LabBreadcrumbs>
      </DetailPageContainer>
    );
  }

  return (
    <DetailPageContainer>
      <LabBreadcrumbs sectionName={pageName}>
        <DetailsWithResults
          labOrder={labOrder}
          markTaskAsReviewed={markTaskAsReviewed}
          loading={loading}
          onBack={onBack}
        />
      </LabBreadcrumbs>
    </DetailPageContainer>
  );
};
