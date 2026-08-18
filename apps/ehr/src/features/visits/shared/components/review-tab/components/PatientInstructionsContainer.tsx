import { Box, Link, Stack, Typography } from '@mui/material';
import { FC, Fragment } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { useExcusePresignedFiles } from 'src/shared/hooks/useExcusePresignedFiles';
import { useChartFields } from '../../../hooks/useChartFields';
import { usePatientInstructionsVisibility } from '../../../hooks/usePatientInstructionsVisibility';
import { useChartData } from '../../../stores/appointment/appointment.store';
import { DispositionSummary, dispositionTypeLabel, SubspecialtyFollowUpList } from '../../DispositionSummary';

export const PatientInstructionsContainer: FC = () => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const { data: chartFields } = useChartFields({
    requestedFields: { disposition: {} },
  });

  const { chartData } = useChartData();

  const instructions = chartData?.instructions;
  const disposition = chartFields?.disposition;
  const schoolWorkExcuses = useExcusePresignedFiles(chartData?.schoolWorkNotes);

  const { showInstructions, showDischargeInstructions, showFollowUp, showSchoolWorkExcuse } =
    usePatientInstructionsVisibility();

  const sections = [
    showInstructions && (
      <>
        <AssessmentTitle>Patient instructions</AssessmentTitle>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {instructions?.map((instruction) => (
            <>
              <Typography color="primary.dark">{instruction.title}</Typography>
              <Typography key={instruction.resourceId} style={{ whiteSpace: 'pre-line' }}>
                {instruction.text}
              </Typography>
            </>
          ))}
        </Box>
      </>
    ),
    showDischargeInstructions && (
      <>
        <AssessmentTitle>Disposition - {dispositionTypeLabel(disposition?.type) ?? 'Not provided'}</AssessmentTitle>
        {/* Shared with the Easy Chart note pane. A disposition carries eight fields beyond its type, and
            two surfaces rendering them by hand agree only until one of them gains a ninth. */}
        <DispositionSummary disposition={disposition} />
      </>
    ),
    showFollowUp && (
      <>
        <AssessmentTitle>Subspecialty follow-up</AssessmentTitle>
        <SubspecialtyFollowUpList disposition={disposition} />
      </>
    ),
    showSchoolWorkExcuse && (
      <>
        <AssessmentTitle>School / Work Excuse</AssessmentTitle>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {schoolWorkExcuses.map((excuse) => (
            <Link component={RouterLink} to={excuse.presignedUrl!} target="_blank" key={excuse.id}>
              {excuse.name}
            </Link>
          ))}
        </Box>
      </>
    ),
  ].filter(Boolean);

  return (
    <Box data-testid={dataTestIds.telemedEhrFlow.reviewTabPatientInstructionsContainer}>
      {!titleInCardHeader && <SectionHeading>Plan</SectionHeading>}

      <Stack spacing={1} sx={{ width: '100%' }}>
        {sections.map((section, index) => (
          <Fragment key={index}>{section}</Fragment>
        ))}
      </Stack>
    </Box>
  );
};
