import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { NoteDTO } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { useChartData } from '../../../../state';
import { AssessmentTitle } from '../../AssessmentTab/components/AssessmentTitle';

export const MedicalConditionsContainer: FC<{ notes?: NoteDTO[] }> = ({ notes }) => {
  const { chartData } = useChartData();
  const theme = useTheme();
  const conditions = chartData?.conditions?.filter((condition) => condition.current === true);

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer}
    >
      <Typography variant="h5" color="primary.dark">
        Medical conditions
      </Typography>
      {conditions?.length ? (
        conditions?.map((condition) => (
          <Typography key={condition.resourceId}>
            {condition.display} {condition.code}
          </Typography>
        ))
      ) : (
        <Typography color={theme.palette.text.secondary}>No known medical conditions</Typography>
      )}

      {notes && notes.length > 0 && (
        <>
          <AssessmentTitle>Medical conditions notes</AssessmentTitle>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {notes?.map((note) => <Typography key={note.resourceId}>{note.text}</Typography>)}
          </Box>
        </>
      )}
    </Box>
  );
};
