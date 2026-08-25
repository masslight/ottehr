import { Box, Stack, Typography, useTheme } from '@mui/material';
import { FC, Fragment } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import { SectionHeading } from 'src/features/visits/shared/components/NoteSectionHeading';
import { makeCptCodeDisplay } from 'utils/lib/fhir/helpers';
import { useChartFields } from '../../../hooks/useChartFields';
import { useChartData } from '../../../stores/appointment/appointment.store';

// Everything documented on the Assessment screen — diagnoses, medical decision making and
// the billing codes — as one Review & Sign section with a subsection each.
export const AssessmentGroupContainer: FC = () => {
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

  const subSections = [
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <AssessmentTitle>Dx</AssessmentTitle>
      {!diagnoses?.length && <Typography color={theme.palette.text.secondary}>No diagnoses added</Typography>}
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
    </Box>,
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <AssessmentTitle>Medical Decision Making</AssessmentTitle>
      {medicalDecision ? (
        <Typography sx={{ whiteSpace: 'pre-line' }}>{medicalDecision}</Typography>
      ) : (
        <Typography color={theme.palette.text.secondary}>No medical decision making documented</Typography>
      )}
    </Box>,
    !!emCode && (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <AssessmentTitle>E&M code</AssessmentTitle>
        <Typography>{emCode.display}</Typography>
      </Box>
    ),
    !!cptCodes?.length && (
      <Box
        sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}
        data-testid={dataTestIds.progressNotePage.cptCodes}
      >
        <AssessmentTitle>CPT codes</AssessmentTitle>
        {cptCodes.map((code) => (
          <Typography key={code.resourceId}>{makeCptCodeDisplay(code)}</Typography>
        ))}
      </Box>
    ),
  ].filter(Boolean);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <SectionHeading>Assessment</SectionHeading>
      <Stack spacing={1} sx={{ width: '100%' }}>
        {subSections.map((subSection, index) => (
          <Fragment key={index}>{subSection}</Fragment>
        ))}
      </Stack>
    </Box>
  );
};
