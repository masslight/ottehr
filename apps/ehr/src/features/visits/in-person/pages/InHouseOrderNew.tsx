import { Stack } from '@mui/material';
import React, { useLayoutEffect, useRef } from 'react';
import { useIsInlineFlow } from 'src/components/InlineFlow';
import { InHouseOrderNewBreadcrumbs } from '../components/breadcrumbs/InHouseOrderNewBreadcrumbs';
import { InfoAlert } from '../components/InfoAlert';
import { MedicationWarnings } from '../components/medication-administration/medication-details/MedicationWarnings';
import { EditableMedicationCard } from '../components/medication-administration/medication-editable-card/EditableMedicationCard';
import { MedicationHistoryList } from '../components/medication-administration/medication-history/MedicationHistoryList';
import { PageHeader } from '../components/medication-administration/PageHeader';

interface InHouseOrderNewProps {
  onFinished?: () => void;
}

export const InHouseOrderNew: React.FC<InHouseOrderNewProps> = ({ onFinished }) => {
  const isInlineFlow = useIsInlineFlow();
  const scrollToRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    // inline the section is already scrolled into view; jumping again would fight the user
    if (!isInlineFlow) scrollToRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [isInlineFlow]);
  return (
    <Stack spacing={2}>
      <span ref={scrollToRef} />
      {!isInlineFlow && <InHouseOrderNewBreadcrumbs />}
      <PageHeader title="Order Medication" variant="h3" component="h1" />
      <InfoAlert text="Make sure an AssociatedDx is selected first in the Assessment menu item." />
      <MedicationWarnings />
      <EditableMedicationCard type="order-new" onNavigateToMar={onFinished} />
      <MedicationHistoryList />
    </Stack>
  );
};
