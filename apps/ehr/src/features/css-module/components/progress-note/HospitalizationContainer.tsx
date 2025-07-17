import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { AssessmentTitle } from 'src/telemed/features/appointment/AssessmentTab/components/AssessmentTitle';
import { getSelectors, NoteDTO } from 'utils';
import { useAppointmentStore } from '../../../../telemed';

export const HospitalizationContainer: FC<{ notes?: NoteDTO[] }> = ({ notes }) => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const theme = useTheme();

  const episodeOfCare = chartData?.episodeOfCare;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Hospitalization
      </Typography>
      {episodeOfCare?.length ? (
        episodeOfCare.map((item) => <Typography key={item.resourceId}>{item.display}</Typography>)
      ) : (
        <Typography color={theme.palette.text.secondary}>No hospitalizations</Typography>
      )}

      {notes && notes.length > 0 && (
        <>
          <AssessmentTitle>Hospitalization notes</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes?.map((note) => <Typography key={note.resourceId}>{note.text}</Typography>)}
          </Box>
        </>
      )}
    </Box>
  );
};
