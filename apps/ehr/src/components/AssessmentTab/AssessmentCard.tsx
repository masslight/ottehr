import { Box, Stack, Typography } from '@mui/material';
import { FC } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { PageTitle } from 'src/components/PageTitle';
import { useAppFlags } from 'src/shared/contexts/useAppFlags';
import { useChartData } from 'src/shared/hooks/appointment/appointment.store';
import { useGetAppointmentAccessibility } from 'src/shared/hooks/appointment/useGetAppointmentAccessibility';
import { AssessmentTitle } from '../AssessmentTitle';
import { AiPotentialDiagnosesCard } from './AiPotentialDiagnosesCard';
import { BillingCodesContainer, DiagnosesContainer, EMCodeField, MedicalDecisionContainer } from './components';

export const AssessmentCard: FC = () => {
  const { chartData } = useChartData();

  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const emCode = chartData?.emCode;
  const { isInPerson } = useAppFlags();

  return (
    <Stack spacing={1}>
      <PageTitle label="Assessment" showIntakeNotesButton={false} />
      <AiPotentialDiagnosesCard />
      <AccordionCard label={isInPerson ? undefined : 'Assessment'}>
        <DoubleColumnContainer
          divider
          leftColumn={
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <DiagnosesContainer />
              {isInPerson && <MedicalDecisionContainer />}
            </Box>
          }
          rightColumn={
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!isInPerson && <MedicalDecisionContainer />}
              {isInPerson ? (
                <BillingCodesContainer />
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <AssessmentTitle>E&M code</AssessmentTitle>
                  {isReadOnly ? (
                    emCode ? (
                      <Typography>{emCode.display}</Typography>
                    ) : (
                      <Typography color="secondary.light">Not provided</Typography>
                    )
                  ) : (
                    <EMCodeField />
                  )}
                </Box>
              )}
            </Box>
          }
        />
      </AccordionCard>
    </Stack>
  );
};
