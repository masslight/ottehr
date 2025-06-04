import React from 'react';
import { usePatientLabOrders } from '../components/labs-orders/usePatientLabOrders';
import { useParams } from 'react-router-dom';
import { DetailsWithoutResults } from '../components/details/DetailsWithoutResults';
import { LabOrderLoading } from '../components/labs-orders/LabOrderLoading';
import { DetailsWithResults } from '../components/details/DetailsWithResults';
import { LabBreadcrumbs } from '../components/labs-orders/LabBreadcrumbs';
import DetailPageContainer from 'src/features/common/DetailPageContainer';

export const OrderDetailsPage: React.FC = () => {
  const urlParams = useParams();
  const serviceRequestId = urlParams.serviceRequestID as string;

  const { labOrders, loading, markTaskAsReviewed, saveSpecimenDate } = usePatientLabOrders({
    searchBy: { field: 'serviceRequestId', value: serviceRequestId },
  });

  // todo: validate response on the get-lab-orders zambda and use labOrder[0]
  const labOrder = labOrders.find((order) => order.serviceRequestId === serviceRequestId);

  const status = labOrder?.orderStatus;

  if (loading) {
    return <LabOrderLoading />;
  }

  if (!labOrder) {
    console.error('No lab order found');
    return null;
  }

  const pageName = `${labOrder.testItem}${labOrder.reflexResultsCount > 0 ? ' + Reflex' : ''}`;

  if (status === 'pending' || status === 'sent') {
    return (
      <DetailPageContainer>
        <LabBreadcrumbs sectionName={pageName}>
          <DetailsWithoutResults labOrder={labOrder} saveSpecimenDate={saveSpecimenDate} />
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
          saveSpecimenDate={saveSpecimenDate}
          loading={loading}
        />
      </LabBreadcrumbs>
    </DetailPageContainer>
  );
};
