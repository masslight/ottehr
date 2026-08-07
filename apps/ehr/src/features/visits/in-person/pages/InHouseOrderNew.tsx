import { Stack } from '@mui/material';
import React, { useLayoutEffect, useRef } from 'react';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { InHouseOrderNewBreadcrumbs } from '../components/breadcrumbs/InHouseOrderNewBreadcrumbs';
import { InfoAlert } from '../components/InfoAlert';
import { MedicationWarnings } from '../components/medication-administration/medication-details/MedicationWarnings';
import { EditableMedicationCard } from '../components/medication-administration/medication-editable-card/EditableMedicationCard';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { PageHeader } from '../components/medication-administration/PageHeader';

export const InHouseOrderNew: React.FC = () => {
  const scrollToRef = useRef<HTMLHeadingElement>(null);
  // Ordering in-house medications is NPI-gated. Guard the page itself so a user without an NPI
  // (e.g. the Clinician role) reaching it directly by URL sees a permission message rather than the
  // order form; administering existing orders remains available elsewhere.
  const hasNPI = useEvolveUser()?.hasNPI ?? false;

  useLayoutEffect(() => {
    scrollToRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, []);
  return (
    <Stack spacing={2}>
      <span ref={scrollToRef} />
      <InHouseOrderNewBreadcrumbs />
      <PageHeader title="Order Medication" variant="h3" component="h1" />
      {hasNPI ? (
        <>
          <InfoAlert text="Make sure an AssociatedDx is selected first in the Assessment menu item." />
          <MedicationWarnings />
          <EditableMedicationCard type="order-new" />
          <MedicationHistoryList />
        </>
      ) : (
        <InfoAlert text="You need an NPI on file to order in-house medications." />
      )}
    </Stack>
  );
};
