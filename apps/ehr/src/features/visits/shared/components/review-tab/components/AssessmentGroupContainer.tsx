import { Box, Stack, Typography, useTheme } from '@mui/material';
import { FC, Fragment, ReactNode } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { DoubleColumnContainer } from 'src/components/DoubleColumnContainer';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { makeCptCodeDisplay } from 'utils/lib/fhir/helpers';
import { DiagnosisDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { useVisitNote } from '../../../hooks/useVisitNote';
import { AiAddedMark } from '../../scribe-recommendations/AiAddedMark';
import { findAiAddedFor, useAiAddedRecommendations } from '../../scribe-recommendations/aiAddedMarks';

export const AssessmentGroupContainer: FC = () => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const { data: note } = useVisitNote();
  const theme = useTheme();
  const aiAdded = useAiAddedRecommendations();

  const diagnoses = note?.assessment.diagnosis;
  const primaryDiagnosis = diagnoses?.find((item) => item.isPrimary);
  const otherDiagnoses = diagnoses?.filter((item) => !item.isPrimary);
  const medicalDecision = note?.encounterNotes.medicalDecision?.text;
  const emCode = note?.assessment.emCode;
  const cptCodes = note?.assessment.cptCodes;

  const diagnosisLine = (diagnosis: DiagnosisDTO): ReactNode => {
    const line = (
      <Typography>
        {diagnosis.display} {diagnosis.code}
      </Typography>
    );
    const fromAi = findAiAddedFor(aiAdded, { kind: 'diagnosis', code: diagnosis.code });
    return fromAi ? <AiAddedMark recommendation={fromAi}>{line}</AiAddedMark> : line;
  };

  // Same split as the Assessment editor: diagnoses and decision making on the left,
  // billing codes on the right.
  const diagnosesSection = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <AssessmentTitle>Dx</AssessmentTitle>
      {!diagnoses?.length && <Typography color={theme.palette.text.secondary}>No diagnoses</Typography>}
      {primaryDiagnosis && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <AssessmentTitle>Primary:</AssessmentTitle>
          {diagnosisLine(primaryDiagnosis)}
        </Box>
      )}
      {otherDiagnoses && otherDiagnoses.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <AssessmentTitle>Secondary:</AssessmentTitle>
          {otherDiagnoses.map((diagnosis) => (
            <Fragment key={diagnosis.resourceId}>{diagnosisLine(diagnosis)}</Fragment>
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
