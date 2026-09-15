import { Box, Typography, useTheme } from '@mui/material';
import { FC, Fragment } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { AssessmentTitle } from '../../../../../../components/AssessmentTitle';
import { useChartData } from '../../../stores/appointment/appointment.store';
import { AiAddedMark } from '../../scribe-recommendations/AiAddedMark';
import { findAiAddedFor, useAiAddedRecommendations } from '../../scribe-recommendations/aiAddedMarks';

export const AllergiesContainer: FC<{ notes?: NoteDTO[] }> = ({ notes }) => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const { chartData } = useChartData();
  const theme = useTheme();
  const aiAdded = useAiAddedRecommendations();

  const allergies = chartData?.allergies?.filter((allergy) => allergy.current === true);

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.progressNotePage.knownAllergiesContainer}
    >
      {!titleInCardHeader && <SectionHeading>Allergies</SectionHeading>}
      {allergies?.length ? (
        allergies.map((allergy) => {
          const row = <Typography>{allergy.name}</Typography>;
          const fromAi = findAiAddedFor(aiAdded, { kind: 'allergy', name: allergy.name });
          return fromAi ? (
            <AiAddedMark key={allergy.resourceId} recommendation={fromAi}>
              {row}
            </AiAddedMark>
          ) : (
            <Fragment key={allergy.resourceId}>{row}</Fragment>
          );
        })
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
