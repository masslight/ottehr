import { Box, Link, Typography } from '@mui/material';
import { FC } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  dispositionCheckboxOptions,
  mapDispositionTypeToLabel,
  NOTHING_TO_EAT_OR_DRINK_FIELD,
  NOTHING_TO_EAT_OR_DRINK_LABEL,
} from 'utils';
import { followUpInOptions } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { SectionList } from '../../../../components';
import { useExcusePresignedFiles, usePatientInstructionsVisibility } from '../../../../hooks';
import { useAppointmentStore } from '../../../../state';
import { AssessmentTitle } from '../../AssessmentTab';

export const PatientInstructionsContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const instructions = chartData?.instructions;
  const disposition = chartData?.disposition;
  const schoolWorkExcuses = useExcusePresignedFiles(chartData?.schoolWorkNotes);

  const { showInstructions, showDischargeInstructions, showFollowUp, showSchoolWorkExcuse } =
    usePatientInstructionsVisibility();

  const sections = [
    showInstructions && (
      <>
        <AssessmentTitle>Patient instructions</AssessmentTitle>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {instructions?.map((instruction) => <Typography key={instruction.resourceId}>{instruction.text}</Typography>)}
        </Box>
      </>
    ),
    showDischargeInstructions && (
      <>
        <AssessmentTitle>
          Disposition - {disposition?.type ? mapDispositionTypeToLabel[disposition.type] : 'Not provided'}
        </AssessmentTitle>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {disposition?.note && <Typography>{disposition?.note}</Typography>}
          {disposition?.[NOTHING_TO_EAT_OR_DRINK_FIELD] && <Typography>{NOTHING_TO_EAT_OR_DRINK_LABEL}</Typography>}
          {disposition?.labService && disposition.labService.length > 0 && (
            <Typography>Lab Services: {disposition.labService.join(', ')}</Typography>
          )}

          {disposition?.virusTest && disposition.virusTest.length > 0 && (
            <Typography>Virus Tests: {disposition.virusTest.join(', ')}</Typography>
          )}

          {typeof disposition?.followUpIn === 'number' && (
            <Typography>
              Follow-up visit{' '}
              {disposition.followUpIn === 0
                ? followUpInOptions.find((option) => option.value === disposition.followUpIn)?.label
                : `in ${followUpInOptions.find((option) => option.value === disposition.followUpIn)?.label}`}
            </Typography>
          )}

          {disposition?.reason && disposition.reason.length > 0 && (
            <Typography>Reason for transfer: {disposition.reason}</Typography>
          )}
        </Box>
      </>
    ),
    showFollowUp && (
      <>
        <AssessmentTitle>Subspecialty follow-up</AssessmentTitle>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {disposition?.followUp?.map((followUp) => {
            const display = dispositionCheckboxOptions.find((option) => option.name === followUp.type)!.label;
            let note = '';

            if (followUp.type === 'other') {
              note = `: ${followUp.note}`;
            }

            return <Typography key={followUp.type}>{`${display}${note}`}</Typography>;
          })}
        </Box>
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
      <Typography variant="h5" color="primary.dark">
        Plan
      </Typography>

      <SectionList sections={sections} sx={{ width: '100%' }} />
    </Box>
  );
};
