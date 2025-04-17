import { Box } from '@mui/system';
import React from 'react';
import { useParams } from 'react-router-dom';
import { LabOrderLoading } from '../components/labs-orders/LabOrderLoading';
import { usePatientRadiologyOrders } from '../components/labs-orders/usePatientRadiologyOrders';

export const RadiologyOrderDetailsPage: React.FC = () => {
  const urlParams = useParams();
  const serviceRequestId = urlParams.serviceRequestID as string;

  const { orders, loading } = usePatientRadiologyOrders({
    serviceRequestId,
  });

  // todo: validate response on the get-lab-orders zambda and use labOrder[0]
  const _labOrder = orders.find((order) => order.serviceRequestId === serviceRequestId);

  // const status = labOrder?.status;
  // const status = 'sent';

  if (loading) {
    return <LabOrderLoading />;
  }

  return <Box>TODO</Box>;

  // if (status === 'pending' || status === 'sent') {
  //   return (
  //     <WithLabBreadcrumbs sectionName={labOrder?.testItem || 'order details'}>
  //       <DetailsWithoutResults labOrder={labOrder} />
  //     </WithLabBreadcrumbs>
  //   );
  // }

  // return (
  //   <WithLabBreadcrumbs sectionName={labOrder?.testItem || 'order details'}>
  //     <DetailsWithResults labOrder={labOrder} updateTask={updateTask} />
  //   </WithLabBreadcrumbs>
  // );
};
