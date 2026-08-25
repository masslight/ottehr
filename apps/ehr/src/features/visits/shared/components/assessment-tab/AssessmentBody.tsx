import { Alert, Box, Stack } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { usePatientLabOrders } from 'src/features/external-labs/components/labs-orders/usePatientLabOrders';
import { LabPaymentMethod } from 'utils';
import { useBillingSuggestions } from '../../hooks/useBillingSuggestions';
import { useAppointmentData } from '../../stores/appointment/appointment.store';
import { AiPotentialDiagnosesCard } from '../AiPotentialDiagnosesCard';
import { BillingCodesContainer } from './BillingCodesContainer';
import { DiagnosesContainer } from './DiagnosesContainer';
import { MedicalDecisionContainer } from './MedicalDecisionContainer';

// Everything on the Assessment screen below the page title. Rendered by the
// AssessmentCard page and inline on the Review & Sign page (InlineEditSection).
export const AssessmentBody: FC = () => {
  const billingSuggestions = useBillingSuggestions();
  const { encounter } = useAppointmentData();
  const { labOrders } = usePatientLabOrders({ searchBy: { field: 'encounterId', value: encounter.id ?? '' } });
  const hasClientBillOrdersWithoutCptCodes = labOrders.some(
    (o) => !o.hasCptCodes && o.billingType === LabPaymentMethod.ClientBill
  );

  return (
    <Stack spacing={1}>
      {hasClientBillOrdersWithoutCptCodes && (
        <Alert severity="warning">
          One or more client billed external lab orders on this visit do not have known CPT codes. Staff may need to
          manually add the appropriate CPT code(s) to bill correctly.
        </Alert>
      )}
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
