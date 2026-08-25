import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import { SectionHeading } from 'src/features/visits/shared/components/NoteSectionHeading';
import { createMedicationString } from 'utils/lib/fhir/medication-administration';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ExtendedMedicationDataForResponse } from 'utils/lib/types/api/medication-administration.types';

export const InHouseMedicationsContainer: FC<{
  medications: ExtendedMedicationDataForResponse[];
  notes?: NoteDTO[];
}> = ({ medications, notes }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <SectionHeading>In-House Medications</SectionHeading>
      {medications.map((item) => (
        <Typography key={item.id} data-testid={dataTestIds.progressNotePage.inHouseMedicationItem}>
          {createMedicationString(item)}
        </Typography>
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
