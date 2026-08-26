import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { AssessmentTitle } from '../../../../../../components/AssessmentTitle';
import { useChartFields } from '../../../hooks/useChartFields';
import { useChartData } from '../../../stores/appointment/appointment.store';

export const SurgicalHistoryContainer: FC<{ notes?: NoteDTO[] }> = ({ notes }) => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const { data: chartFields } = useChartFields({
    requestedFields: {
      surgicalHistoryNote: {
        _tag: 'surgical-history-note',
      },
    },
  });

  const { chartData } = useChartData();

  const theme = useTheme();
  const procedures = chartData?.surgicalHistory;
  const surgicalHistoryNote = chartFields?.surgicalHistoryNote?.text;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.progressNotePage.surgicalHistoryContainer}
    >
      {!titleInCardHeader && <SectionHeading>Surgical history</SectionHeading>}
      {procedures?.length ? (
        procedures.map((procedure) => (
          <Typography key={procedure.resourceId}>
            {procedure.code} {procedure.display}
          </Typography>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>No surgical history</Typography>
      )}
      {surgicalHistoryNote && <Typography>{surgicalHistoryNote}</Typography>}

      {notes && notes.length > 0 && (
        <>
          <AssessmentTitle>Surgical history notes</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes?.map((note) => <Typography key={note.resourceId}>{note.text}</Typography>)}
          </Box>
        </>
      )}
    </Box>
  );
};
