import { Box, Typography, useTheme } from '@mui/material';
import { FC, Fragment, useMemo } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { filterActiveMedications } from 'utils/lib/helpers/medications/current-medications.helper';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { AssessmentTitle } from '../../../../../../components/AssessmentTitle';
import { useVisitNote } from '../../../hooks/useVisitNote';
import { AiAddedMark } from '../../scribe-recommendations/AiAddedMark';
import { findAiAddedFor, useAiAddedRecommendations } from '../../scribe-recommendations/aiAddedMarks';

export const MedicationsContainer: FC<{ notes?: NoteDTO[] }> = ({ notes }) => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const { data: note } = useVisitNote();
  const theme = useTheme();
  const aiAdded = useAiAddedRecommendations();

  const medications = useMemo(
    () =>
      filterActiveMedications(
        note?.history.medications.filter((medication) => medication.type !== 'prescribed-medication')
      ),
    [note?.history.medications]
  );

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer}
    >
      {!titleInCardHeader && <SectionHeading>Medications</SectionHeading>}
      {medications.length ? (
        medications.map((medication) => {
          const additionalInfo = [
            medication.intakeInfo.dose,
            medication.intakeInfo.patientCouldNotConfirmDosage ? 'Patient could not confirm dosage' : null,
          ]
            .filter(Boolean)
            .join(' · ');
          const row = (
            <Typography>
              {medication.name} {additionalInfo ? `(${additionalInfo})` : ''}
            </Typography>
          );
          const fromAi = findAiAddedFor(aiAdded, { kind: 'medication', name: medication.name });
          return fromAi ? (
            <AiAddedMark key={medication.resourceId} recommendation={fromAi}>
              {row}
            </AiAddedMark>
          ) : (
            <Fragment key={medication.resourceId}>{row}</Fragment>
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
