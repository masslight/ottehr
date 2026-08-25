import { Box } from '@mui/material';
import React, { useLayoutEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { Loader } from '../../shared/components/Loader';
import { useGetAppointmentAccessibility } from '../../shared/hooks/useGetAppointmentAccessibility';
import { InHouseOrderEditBreadcrumbs } from '../components/breadcrumbs/InHouseOrderEditBreadcrumbs';
import { MedicationWarnings } from '../components/medication-administration/medication-details/MedicationWarnings';
import { EditableMedicationCard } from '../components/medication-administration/medication-editable-card/EditableMedicationCard';
import { MedicationOrderType } from '../components/medication-administration/medication-editable-card/fieldsConfig';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { OrderButton } from '../components/medication-administration/OrderButton';
import { PageHeader } from '../components/medication-administration/PageHeader';
import { useMedicationManagement } from '../hooks/useMedicationManagement';

interface InHouseOrderEditProps {
  // set by the Review & Sign inline edit flow, which has no URL params of its own and
  // switches views in place instead of navigating away
  orderId?: string;
  onBack?: () => void;
  onOrderNew?: () => void;
}

export const InHouseOrderEdit: React.FC<InHouseOrderEditProps> = ({ orderId: orderIdProp, onBack, onOrderNew }) => {
  const { orderId: orderIdFromUrl } = useParams();
  const orderId = orderIdProp ?? orderIdFromUrl;
  const { medications, isLoading } = useMedicationManagement();
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const isInlineFlow = useIsInlineFlow();
  const scrollToRef = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    // inline the section is already scrolled into view; jumping again would fight the user
    if (!isInlineFlow) scrollToRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [isInlineFlow]);

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
        {(!isInlineFlow || !isReadOnly) && <OrderButton onClick={onOrderNew} />}
      </Box>
      <MedicationWarnings />
      <EditableMedicationCard medication={order} type={editType} onNavigateToMar={onBack} />
      <MedicationHistoryList />
    </>
  );
};
