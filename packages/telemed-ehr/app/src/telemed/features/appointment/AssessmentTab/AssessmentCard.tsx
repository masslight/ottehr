import React, { FC } from 'react';
import { Box, Typography } from '@mui/material';
import { AccordionCard, DoubleColumnContainer } from '../../../components';
import { AssessmentTitle, CPTCodeField, MedicalDecisionField, DiagnosesContainer } from './components';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';

export const AssessmentCard: FC = () => {
  const { chartData, isReadOnly } = getSelectors(useAppointmentStore, ['isReadOnly', 'chartData']);

  const mdm = chartData?.medicalDecision?.text;
  const cptCode = (chartData?.cptCodes || [])[0];

  return (
    <AccordionCard label="Assessment">
      <DoubleColumnContainer
        divider
        leftColumn={<DiagnosesContainer />}
        rightColumn={
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <AssessmentTitle>Medical Decision Making</AssessmentTitle>
              {isReadOnly ? (
                mdm ? (
                  <Typography>{mdm}</Typography>
                ) : (
                  <Typography color="secondary.light">Not provided</Typography>
                )
              ) : (
                <MedicalDecisionField />
              )}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <AssessmentTitle>CPT code</AssessmentTitle>
              {isReadOnly ? (
                cptCode ? (
                  <Typography>{cptCode.display}</Typography>
                ) : (
                  <Typography color="secondary.light">Not provided</Typography>
                )
              ) : (
                <CPTCodeField />
              )}
            </Box>
          </Box>
        }
      />
    </AccordionCard>
  );
};
