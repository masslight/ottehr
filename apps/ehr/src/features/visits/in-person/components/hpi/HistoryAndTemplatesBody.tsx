import { Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { FEATURE_FLAGS } from 'src/constants/feature-flags';
import { HPISection } from '../../../shared/components/HpiSection';
import { ApplyTemplate } from '../../../shared/components/templates/ApplyTemplate';

export const HistoryAndTemplatesBody: FC = () => (
  <Stack spacing={1}>
    {FEATURE_FLAGS.GLOBAL_TEMPLATES_ENABLED && (
      <AccordionCard label="Template">
        <ApplyTemplate />
      </AccordionCard>
    )}
    <HPISection />
  </Stack>
);
