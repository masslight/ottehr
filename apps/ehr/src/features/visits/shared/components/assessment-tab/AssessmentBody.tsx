import { Box, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { useBillingSuggestions } from '../../hooks/useBillingSuggestions';
import { AiPotentialDiagnosesCard } from '../AiPotentialDiagnosesCard';
import { BillingCodesContainer } from './BillingCodesContainer';
import { DiagnosesContainer } from './DiagnosesContainer';
import { MedicalDecisionContainer } from './MedicalDecisionContainer';

// Everything on the Assessment screen below the page title. Rendered by the
// AssessmentCard page and inline on the Review & Sign page (InlineEditSection).
export const AssessmentBody: FC = () => {
  const billingSuggestions = useBillingSuggestions();

  return (
    <Stack spacing={1}>
      <AiPotentialDiagnosesCard suggestions={billingSuggestions} />
      <AccordionCard>
        <DoubleColumnContainer
          divider
          leftColumn={
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <DiagnosesContainer
                aiSuggestedDiagnoses={billingSuggestions.icdCodesSuggest}
                aiSuggestionsLoading={billingSuggestions.isLoading}
              />
              <MedicalDecisionContainer />
            </Box>
          }
          rightColumn={
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <BillingCodesContainer
                aiSuggestedCptCodes={billingSuggestions.cptCodesSuggest}
                aiSuggestedEmCodes={billingSuggestions.emCode}
                aiSuggestionsLoading={billingSuggestions.isLoading}
              />
            </Box>
          }
        />
      </AccordionCard>
    </Stack>
  );
};
