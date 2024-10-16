import React, { FC } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { VitalsCard } from './VitalsCard';
import { GeneralCard } from './GeneralCard';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { ReadOnlyCard } from './ReadOnlyCard';

export const ExamTab: FC = () => {
  const { isExamObservationsLoading, isReadOnly } = getSelectors(useAppointmentStore, [
    'isExamObservationsLoading',
    'isReadOnly',
  ]);

  if (isExamObservationsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
      }}
    >
      {isReadOnly ? (
        <ReadOnlyCard />
      ) : (
        <>
          <VitalsCard />
          <GeneralCard />
        </>
      )}
    </Box>
  );
};
