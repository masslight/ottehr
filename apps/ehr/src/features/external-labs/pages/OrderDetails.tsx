import React from 'react';
import { usePatientLabOrders } from '../components/labs-orders/usePatientLabOrders';
import { useParams } from 'react-router-dom';
import { DetailsWithoutResults } from '../components/details/DetailsWithoutResults';
import { LabOrderLoading } from '../components/labs-orders/LabOrderLoading';
import { DetailsWithResults } from '../components/details/DetailsWithResults';
import { WithLabBreadcrumbs } from '../components/labs-orders/LabBreadcrumbs';

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

  if (status === 'pending' || status === 'sent') {
    return (
      <WithLabBreadcrumbs sectionName={labOrder.testItem}>
        <DetailsWithoutResults labOrder={labOrder} saveSpecimenDate={saveSpecimenDate} />
      </WithLabBreadcrumbs>
    );
  }

  return (
    <WithLabBreadcrumbs sectionName={labOrder.testItem}>
      <DetailsWithResults
        labOrder={labOrder}
        markTaskAsReviewed={markTaskAsReviewed}
        saveSpecimenDate={saveSpecimenDate}
        loading={loading}
      />
    </WithLabBreadcrumbs>
  );
};
