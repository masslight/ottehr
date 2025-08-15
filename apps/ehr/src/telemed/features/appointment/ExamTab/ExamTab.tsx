import { Box, CircularProgress } from '@mui/material';
import { FC } from 'react';
import { ExamTable } from 'src/features/css-module/components/examination/ExamTable';
import { useFeatureFlags } from 'src/features/css-module/context/featureFlags';
import { useExamObservations } from 'src/telemed/hooks/useExamObservations';
import { ExamDef } from 'utils';
import { useGetAppointmentAccessibility } from '../../../hooks';
import { ReadOnlyCard } from './ReadOnlyCard';

export const ExamTab: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { css } = useFeatureFlags();
  const { value: examObservations } = useExamObservations();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {examObservations.length === 0 ? (
        <CircularProgress />
      ) : isReadOnly ? (
        <ReadOnlyCard />
      ) : (
        <ExamTable examConfig={ExamDef()[css ? 'inPerson' : 'telemed'].default.components} />
      )}
    </Box>
  );
};
