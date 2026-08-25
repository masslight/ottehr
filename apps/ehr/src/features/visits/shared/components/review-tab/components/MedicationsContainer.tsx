import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { SectionHeading } from 'src/features/visits/shared/components/NoteSectionHeading';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { AssessmentTitle } from '../../../../../../components/AssessmentTitle';
import { useChartData } from '../../../stores/appointment/appointment.store';

export const MedicationsContainer: FC<{ notes?: NoteDTO[] }> = ({ notes }) => {
  const { chartData } = useChartData();
  const theme = useTheme();

  const medications = chartData?.medications;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer}
    >
      <SectionHeading>Medications</SectionHeading>
      {medications?.length ? (
        medications.map((medication) => {
          const additionalInfo = [
            medication.intakeInfo.dose,
            medication.intakeInfo.patientCouldNotConfirmDosage ? 'Patient could not confirm dosage' : null,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <Typography key={medication.resourceId}>
              {medication.name} {additionalInfo ? `(${additionalInfo})` : ''}
            </Typography>
          );
        })
      ) : (
        <Typography color={theme.palette.text.secondary}>No current medications</Typography>
      )}

      {notes && notes.length > 0 && (
        <>
          <AssessmentTitle>Medications notes</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes?.map((note) => <Typography key={note.resourceId}>{note.text}</Typography>)}
          </Box>
        </>
      )}
    </Box>
  );
};
