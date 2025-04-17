import React, { FC } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import {
  AssessmentTitle,
  BillingCodesContainer,
  EMCodeField,
  DiagnosesContainer,
  MedicalDecisionContainer,
} from './components';
import { AccordionCard, DoubleColumnContainer } from '../../../components';
import { PageTitle } from '../../../components/PageTitle';
import { useGetAppointmentAccessibility } from '../../../hooks';
import { useAppointmentStore } from '../../../state';
import { useFeatureFlags } from '../../../../features/css-module/context/featureFlags';
import { AiPotentialDiagnosesCard } from './AiPotentialDiagnosesCard';
import { getSelectors } from '../../../../shared/store/getSelectors';

export const AssessmentCard: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const emCode = chartData?.emCode;

  const { css } = useFeatureFlags();

  return (
    <Stack spacing={1}>
      <PageTitle label="Assessment" showIntakeNotesButton={false} />
      <AiPotentialDiagnosesCard />
      <AccordionCard label={css ? undefined : 'Assessment'}>
        <DoubleColumnContainer
          divider
          leftColumn={
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <DiagnosesContainer />
              {css && <MedicalDecisionContainer />}
            </Box>
          }
          rightColumn={
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!css && <MedicalDecisionContainer />}
              {css ? (
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
