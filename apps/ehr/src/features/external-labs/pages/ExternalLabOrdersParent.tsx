import React from 'react';
import { CreateExternalLabOrder } from './CreateExternalLabOrder';
import { mockLabOrders } from '../helpers/types';
import { ExternalLabOrdersListPage } from './ExternalLabOrdersListPage';
import { useLocation } from 'react-router-dom';

interface ExternalLabOrdersParentProps {
  appointmentID?: string;
}

export const ExternalLabOrdersParent: React.FC<ExternalLabOrdersParentProps> = ({ appointmentID }) => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const useMockData = queryParams.get('useMockData') === 'true';

  // todo: temporary solution to show mock data
  if (useMockData) {
    return <ExternalLabOrdersListPage appointmentID={appointmentID} />;
  }

  if (mockLabOrders.length === 0) {
    // TODO: replace with labs query when data is implemented
    return <CreateExternalLabOrder appointmentID={appointmentID} />;
  } else {
    return <ExternalLabOrdersListPage appointmentID={appointmentID} />;
  }
};
