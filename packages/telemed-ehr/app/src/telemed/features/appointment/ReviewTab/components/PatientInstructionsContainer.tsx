import React, { FC } from 'react';
import { Box, Divider, Link, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { AssessmentTitle } from '../../AssessmentTab';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { dispositionCheckboxOptions, mapDispositionTypeToLabel } from '../../../../utils';
import { useExcusePresignedFiles } from '../../../../hooks';

export const PatientInstructionsContainer: FC = () => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const instructions = chartData?.instructions;
  const disposition = chartData?.disposition;
  const workSchoolExcuses = useExcusePresignedFiles(chartData?.workSchoolNotes);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Patient instructions
      </Typography>

      <AssessmentTitle>Patient instructions</AssessmentTitle>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {instructions && instructions.length > 0 ? (
          instructions.map((instruction) => <Typography key={instruction.resourceId}>{instruction.text}</Typography>)
        ) : (
          <Typography color="secondary.light">No patient instructions provided</Typography>
        )}
      </Box>

      <Divider orientation="horizontal" flexItem />

      <AssessmentTitle>General patient education documents </AssessmentTitle>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography>To be implemented</Typography>
      </Box>

      <Divider orientation="horizontal" flexItem />

      <AssessmentTitle>Ottehr patient education materials </AssessmentTitle>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography>To be implemented</Typography>
      </Box>

      <Divider orientation="horizontal" flexItem />

      <AssessmentTitle>
        Discharge instructions - {disposition?.type ? mapDispositionTypeToLabel[disposition.type] : 'Not provided'}
      </AssessmentTitle>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {disposition?.note ? (
          <Typography>{disposition.note}</Typography>
        ) : (
          <Typography color="secondary.light">No discharge instructions provided</Typography>
        )}
      </Box>

      <Divider orientation="horizontal" flexItem />

      <AssessmentTitle>Subspecialty follow-up</AssessmentTitle>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {disposition?.followUp && disposition.followUp.length > 0 ? (
          disposition.followUp.map((followUp) => {
            const display = dispositionCheckboxOptions.find((option) => option.name === followUp.type)!.label;
            let note = '';

            if (followUp.type === 'other') {
              note = `: ${followUp.note}`;
            }

            return <Typography key={followUp.type}>{`${display}${note}`}</Typography>;
          })
        ) : (
          <Typography color="secondary.light">No subspecialty follow-up provided</Typography>
        )}
      </Box>

      <Divider orientation="horizontal" flexItem />

      <AssessmentTitle>Work / School Excuse</AssessmentTitle>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {workSchoolExcuses.length > 0 ? (
          workSchoolExcuses.map((excuse) => (
            <Link component={RouterLink} to={excuse.presignedUrl!} target="_blank" key={excuse.id}>
              {excuse.name}
            </Link>
          ))
        ) : (
          <Typography color="secondary.light">No work/school excuses provided</Typography>
        )}
      </Box>
    </Box>
  );
};
