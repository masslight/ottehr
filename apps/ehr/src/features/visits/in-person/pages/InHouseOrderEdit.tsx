import { Box } from '@mui/material';
import React, { useLayoutEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Loader } from '../../shared/components/Loader';
import { InHouseOrderEditBreadcrumbs } from '../components/breadcrumbs/InHouseOrderEditBreadcrumbs';
import { MedicationWarnings } from '../components/medication-administration/medication-details/MedicationWarnings';
import { EditableMedicationCard } from '../components/medication-administration/medication-editable-card/EditableMedicationCard';
import { MedicationOrderType } from '../components/medication-administration/medication-editable-card/fieldsConfig';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { OrderButton } from '../components/medication-administration/OrderButton';
import { PageHeader } from '../components/medication-administration/PageHeader';
import { useMedicationManagement } from '../hooks/useMedicationManagement';

export const InHouseOrderEdit: React.FC = () => {
  const { orderId } = useParams();
  const { medications, isLoading } = useMedicationManagement();
  const scrollToRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    scrollToRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, []);

  // Wait for medications to load before rendering the form — otherwise EditableMedicationCard
  // mounts with `medication=undefined` and `type='order-edit'`, which gets latched into useRef /
  // useState and never refreshes when the data arrives, leaving the form in a broken state.
  if (isLoading) return <Loader />;

  const order = medications.find((medication) => medication.id === orderId);
  const isCompleted =
    order?.status === 'administered' || order?.status === 'administered-partly' || order?.status === 'administered-not';

  const editType: MedicationOrderType = isCompleted ? 'completed-edit' : 'order-edit';
  const pageTitle = isCompleted ? 'Medication Details' : 'Edit Order';

  return (
    <>
      <span ref={scrollToRef} />
      <InHouseOrderEditBreadcrumbs />
      <Box display="flex" justifyContent="space-between" alignItems="center" pl={0.5} mb={2}>
        <PageHeader title={pageTitle} variant="h3" component="h1" />
        <OrderButton />
      </Box>
      <MedicationWarnings />
      <EditableMedicationCard medication={order} type={editType} />
      <MedicationHistoryList />
    </>
  );
};
