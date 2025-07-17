import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { NoteDTO } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { AssessmentTitle } from '../../AssessmentTab/components/AssessmentTitle';

export const AllergiesContainer: FC<{ notes?: NoteDTO[] }> = ({ notes }) => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const theme = useTheme();

  const allergies = chartData?.allergies?.filter((allergy) => allergy.current === true);

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabKnownAllergiesContainer}
    >
      <Typography variant="h5" color="primary.dark">
        Allergies
      </Typography>
      {allergies?.length ? (
        allergies.map((allergy) => <Typography key={allergy.resourceId}>{allergy.name}</Typography>)
      ) : (
        <Typography color={theme.palette.text.secondary}>No known allergies</Typography>
      )}

      {notes && notes.length > 0 && (
        <>
          <AssessmentTitle>Allergies notes</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes?.map((note) => <Typography key={note.resourceId}>{note.text}</Typography>)}
          </Box>
        </>
      )}
    </Box>
  );
};
