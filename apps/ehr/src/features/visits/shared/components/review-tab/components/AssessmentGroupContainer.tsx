import { Box, Stack, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { makeCptCodeDisplay } from 'utils/lib/fhir/helpers';
import { useChartFields } from '../../../hooks/useChartFields';
import { useChartData } from '../../../stores/appointment/appointment.store';

export const AssessmentGroupContainer: FC = () => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const { chartData } = useChartData();
  const theme = useTheme();

  const { data: chartFields } = useChartFields({
    requestedFields: {
      medicalDecision: {
        _tag: 'medical-decision',
      },
    },
  });

  const diagnoses = chartData?.diagnosis;
  const primaryDiagnosis = diagnoses?.find((item) => item.isPrimary);
  const otherDiagnoses = diagnoses?.filter((item) => !item.isPrimary);
  const medicalDecision = chartFields?.medicalDecision?.text;
  const emCode = chartData?.emCode;
  const cptCodes = chartData?.cptCodes;

  // Same split as the Assessment editor: diagnoses and decision making on the left,
  // billing codes on the right.
  const diagnosesSection = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <AssessmentTitle>Dx</AssessmentTitle>
      {!diagnoses?.length && <Typography color={theme.palette.text.secondary}>No diagnoses</Typography>}
      {primaryDiagnosis && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <AssessmentTitle>Primary:</AssessmentTitle>
          <Typography>
            {primaryDiagnosis.display} {primaryDiagnosis.code}
          </Typography>
        </Box>
      )}
      {otherDiagnoses && otherDiagnoses.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <AssessmentTitle>Secondary:</AssessmentTitle>
          {otherDiagnoses.map((diagnosis) => (
            <Typography key={diagnosis.resourceId}>
              {diagnosis.display} {diagnosis.code}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );

  const medicalDecisionSection = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <AssessmentTitle>Medical Decision Making</AssessmentTitle>
      {medicalDecision ? (
        <Typography sx={{ whiteSpace: 'pre-line' }}>{medicalDecision}</Typography>
      ) : (
        <Typography color={theme.palette.text.secondary}>No medical decision making</Typography>
      )}
    </Box>
  );

  const billingSection = (
    <Stack spacing={1}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <AssessmentTitle>E&M code</AssessmentTitle>
        {emCode ? (
          <Typography>{emCode.display}</Typography>
        ) : (
          <Typography color={theme.palette.text.secondary}>No E&M code</Typography>
        )}
      </Box>
      <Box
        sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
        data-testid={dataTestIds.progressNotePage.cptCodes}
      >
        <AssessmentTitle>CPT codes</AssessmentTitle>
        {cptCodes?.length ? (
          cptCodes.map((code) => <Typography key={code.resourceId}>{makeCptCodeDisplay(code)}</Typography>)
        ) : (
          <Typography color={theme.palette.text.secondary}>No CPT codes</Typography>
        )}
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      {!titleInCardHeader && <SectionHeading>Assessment</SectionHeading>}
      <DoubleColumnContainer
        divider
        padding
        leftColumn={
          <Stack spacing={1}>
            {diagnosesSection}
            {medicalDecisionSection}
          </Stack>
        }
        rightColumn={billingSection}
      />
    </Box>
  );
};
