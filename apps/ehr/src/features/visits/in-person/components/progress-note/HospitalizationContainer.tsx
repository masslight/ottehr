import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { AssessmentTitle } from 'src/components/AssessmentTitle';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { useChartFields } from 'src/features/visits/shared/hooks/useChartFields';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

export const HospitalizationContainer: FC<{ notes?: NoteDTO[] }> = ({ notes }) => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const { data: chartData } = useChartFields({ requestedFields: { episodeOfCare: {} } });
  const theme = useTheme();

  const episodeOfCare = chartData?.episodeOfCare;

  return (
    <Box
      data-testid={dataTestIds.progressNotePage.hospitalizationContainer}
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
    >
      {!titleInCardHeader && <SectionHeading>Hospitalization</SectionHeading>}
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
