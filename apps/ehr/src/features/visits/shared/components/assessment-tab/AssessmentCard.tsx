import { Box, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { PageTitle } from 'src/features/visits/shared/components/PageTitle';
import { useBillingSuggestions } from '../../hooks/useBillingSuggestions';
import { AiPotentialDiagnosesCard } from '../AiPotentialDiagnosesCard';
import { BillingCodesContainer } from './BillingCodesContainer';
import { DiagnosesContainer } from './DiagnosesContainer';
import { MedicalDecisionContainer } from './MedicalDecisionContainer';

export const AssessmentCard: FC = () => {
  const billingSuggestions = useBillingSuggestions();

  return (
    <Stack spacing={1}>
      <PageTitle label="Assessment" showIntakeNotesButton={false} />
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
