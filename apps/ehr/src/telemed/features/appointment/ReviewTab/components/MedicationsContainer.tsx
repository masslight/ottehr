import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { NoteDTO } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useChartData } from '../../../../state';
import { AssessmentTitle } from '../../AssessmentTab/components/AssessmentTitle';

export const MedicationsContainer: FC<{ notes?: NoteDTO[] }> = ({ notes }) => {
  const { chartData } = useChartData();
  const theme = useTheme();

  const medications = chartData?.medications;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer}
    >
      <Typography variant="h5" color="primary.dark">
        Medications
      </Typography>
      {medications?.length ? (
        medications.map((medication) => <Typography key={medication.resourceId}>{medication.name}</Typography>)
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
