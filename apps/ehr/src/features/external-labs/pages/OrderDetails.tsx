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

  const { labOrders, loading, updateTask } = usePatientLabOrders({
    serviceRequestId,
  });

  // todo: validate response on the get-lab-orders zambda and use labOrder[0]
  const labOrder = labOrders.find((order) => order.serviceRequestId === serviceRequestId);

  const status = labOrder?.orderStatus;
  // const status = 'sent';

  if (loading) {
    return <LabOrderLoading />;
  }

  if (status === 'pending' || status === 'sent') {
    return (
      <WithLabBreadcrumbs sectionName={labOrder?.testItem || 'order details'}>
        <DetailsWithoutResults labOrder={labOrder} />
      </WithLabBreadcrumbs>
    );
  }

  return (
    <WithLabBreadcrumbs sectionName={labOrder?.testItem || 'order details'}>
      <DetailsWithResults labOrder={labOrder} updateTask={updateTask} />
    </WithLabBreadcrumbs>
  );
};
