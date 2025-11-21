import { Stack } from '@mui/material';
import React from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { HPISection } from '../../shared/components/HpiSection';
import { PageTitle } from '../../shared/components/PageTitle';
import { ApplyTemplate } from '../../shared/components/templates/ApplyTemplate';

export const HistoryAndTemplates: React.FC = () => {
  return (
    <Stack spacing={1}>
      <PageTitle label="History of Present Illness" showIntakeNotesButton={false} />

      {FEATURE_FLAGS.GLOBAL_TEMPLATES_ENABLED && (
        <AccordionCard label="Template">
          <ApplyTemplate />
        </AccordionCard>
      )}

      <HPISection />
    </Stack>
  );
};
