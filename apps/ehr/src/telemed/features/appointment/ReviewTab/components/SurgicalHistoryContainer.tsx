import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { NoteDTO } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { AssessmentTitle } from '../../AssessmentTab/components/AssessmentTitle';

export const SurgicalHistoryContainer: FC<{ notes?: NoteDTO[] }> = ({ notes }) => {
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);
  const theme = useTheme();

  const procedures = chartData?.surgicalHistory;
  const surgicalHistoryNote = chartData?.surgicalHistoryNote?.text;

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabSurgicalHistoryContainer}
    >
      <Typography variant="h5" color="primary.dark">
        Surgical history
      </Typography>
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
