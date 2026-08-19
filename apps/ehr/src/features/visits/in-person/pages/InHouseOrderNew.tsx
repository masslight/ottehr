import { Stack } from '@mui/material';
import React, { useLayoutEffect, useRef } from 'react';
import { InHouseOrderNewBreadcrumbs } from '../components/breadcrumbs/InHouseOrderNewBreadcrumbs';
import { InfoAlert } from '../components/InfoAlert';
import { MedicationWarnings } from '../components/medication-administration/medication-details/MedicationWarnings';
import { EditableMedicationCard } from '../components/medication-administration/medication-editable-card/EditableMedicationCard';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { PageHeader } from '../components/medication-administration/PageHeader';

interface InHouseOrderNewProps {
  /**
   * 'inline' drops the breadcrumbs and finishes via onFinished instead of navigating —
   * used by the Review & Sign inline edit flow
   */
  variant?: 'page' | 'inline';
  onFinished?: () => void;
}

export const InHouseOrderNew: React.FC<InHouseOrderNewProps> = ({ variant = 'page', onFinished }) => {
  const scrollToRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    if (variant === 'page') {
      scrollToRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, [variant]);
  return (
    <Stack spacing={2}>
      <span ref={scrollToRef} />
      {variant === 'page' && <InHouseOrderNewBreadcrumbs />}
      <PageHeader title="Order Medication" variant="h3" component="h1" />
      <InfoAlert text="Make sure an AssociatedDx is selected first in the Assessment menu item." />
      <MedicationWarnings />
      <EditableMedicationCard type="order-new" onNavigateToMar={variant === 'inline' ? onFinished : undefined} />
      <MedicationHistoryList />
    </Stack>
  );
};
