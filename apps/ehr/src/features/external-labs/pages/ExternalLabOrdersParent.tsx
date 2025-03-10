import React from 'react';
import { CreateExternalLabOrder } from './CreateExternalLabOrder';
import { mockLabOrders } from '../helpers/types';
import { ExternalLabOrdersListPage } from './ExternalLabOrdersListPage';

interface ExternalLabOrdersParentProps {
  appointmentID?: string;
}

export const ExternalLabOrdersParent: React.FC<ExternalLabOrdersParentProps> = ({ appointmentID }) => {
  if (mockLabOrders.length === 0) {
    // TODO: replace with labs query when data is implemented
    return <CreateExternalLabOrder appointmentID={appointmentID} />;
  } else {
    return <ExternalLabOrdersListPage appointmentID={appointmentID} />;
  }
};
