import React, { FC } from 'react';
import { Box } from '@mui/material';
import { ProceduresForm } from './ProceduresForm';
import { ProceduresNoteField, ProceduresNoteFieldSkeleton } from './ProceduresNoteField';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';

export const SurgicalHistoryProviderColumn: FC = () => {
  const { isChartDataLoading } = getSelectors(useAppointmentStore, ['isChartDataLoading']);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <ProceduresForm />
      {isChartDataLoading ? <ProceduresNoteFieldSkeleton /> : <ProceduresNoteField />}
    </Box>
  );
};
