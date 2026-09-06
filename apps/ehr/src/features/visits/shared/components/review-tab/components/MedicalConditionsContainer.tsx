import { Box, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  SectionHeading,
  useNoteSectionTitleInCardHeader,
} from 'src/features/visits/shared/components/NoteSectionHeading';
import { NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { AssessmentTitle } from '../../../../../../components/AssessmentTitle';
import { useChartData } from '../../../stores/appointment/appointment.store';

export const MedicalConditionsContainer: FC<{ notes?: NoteDTO[] }> = ({ notes }) => {
  const titleInCardHeader = useNoteSectionTitleInCardHeader();
  const { chartData } = useChartData();
  const theme = useTheme();
  const conditions = chartData?.conditions?.filter((condition) => condition.current === true);

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}
      data-testid={dataTestIds.progressNotePage.medicalConditionsContainer}
    >
      {!titleInCardHeader && <SectionHeading>Medical conditions</SectionHeading>}
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
