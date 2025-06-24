import { Box } from '@mui/material';
import React, { useLayoutEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { InHouseOrderEditBreadcrumbs } from '../components/breadcrumbs/InHouseOrderEditBreadcrumbs';
import { MedicationWarnings } from '../components/medication-administration/medication-details/MedicationWarnings';
import { EditableMedicationCard } from '../components/medication-administration/medication-editable-card/EditableMedicationCard';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { OrderButton } from '../components/medication-administration/OrderButton';
import { PageHeader } from '../components/medication-administration/PageHeader';
import { useMedicationManagement } from '../hooks/useMedicationManagement';

export const InHouseOrderEdit: React.FC = () => {
  const { orderId } = useParams();
  const { medications } = useMedicationManagement();
  const scrollToRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    scrollToRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, []);

  const order = medications.find((medication) => medication.id === orderId);

  return (
    <>
      <span ref={scrollToRef} />
      <InHouseOrderEditBreadcrumbs />
      <Box display="flex" justifyContent="space-between" alignItems="center" pl={0.5} mb={2}>
        <PageHeader title="Edit Order" variant="h3" component="h1" />
        <OrderButton />
      </Box>
      <MedicationWarnings />
      <EditableMedicationCard medication={order} type="order-edit" />
      <MedicationHistoryList />
    </>
  );
};
