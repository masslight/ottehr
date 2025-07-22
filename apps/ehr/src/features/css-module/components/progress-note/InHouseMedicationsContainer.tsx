import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { AssessmentTitle } from 'src/telemed/features/appointment/AssessmentTab/components/AssessmentTitle';
import { createMedicationString, ExtendedMedicationDataForResponse, NoteDTO } from 'utils';

export const InHouseMedicationsContainer: FC<{
  medications: ExtendedMedicationDataForResponse[];
  notes?: NoteDTO[];
}> = ({ medications, notes }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        In-House Medications
      </Typography>
      {medications.map((item) => (
        <Typography key={item.id}>{createMedicationString(item)}</Typography>
      ))}

      {notes && notes.length > 0 && (
        <>
          <AssessmentTitle>In-House Medications notes</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes?.map((note) => <Typography key={note.resourceId}>{note.text}</Typography>)}
          </Box>
        </>
      )}
    </Box>
  );
};
