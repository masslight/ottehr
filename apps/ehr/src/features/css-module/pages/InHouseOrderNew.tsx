import React, { useRef, useLayoutEffect } from 'react';
import { InHouseOrderNewBreadcrumbs } from '../components/breadcrumbs/InHouseOrderNewBreadcrumbs';
import { MedicationWarnings } from '../components/medication-administration/medication-details/MedicationWarnings';
import { Box } from '@mui/material';
import { PageHeader } from '../components/medication-administration/PageHeader';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { EditableMedicationCard } from '../components/medication-administration/medication-editable-card/EditableMedicationCard';

export const InHouseOrderNew: React.FC = () => {
  const scrollToRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    scrollToRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, []);
  return (
    <>
      <span ref={scrollToRef} />
      <InHouseOrderNewBreadcrumbs />
      <Box display="flex" justifyContent="space-between" alignItems="center" pl={0.5} mb={2} mt={2}>
        <PageHeader title="Order Medication" variant="h3" component="h1" />
      </Box>
      <MedicationWarnings />
      <EditableMedicationCard type="order-new" />
      <MedicationHistoryList />
    </>
  );
};
