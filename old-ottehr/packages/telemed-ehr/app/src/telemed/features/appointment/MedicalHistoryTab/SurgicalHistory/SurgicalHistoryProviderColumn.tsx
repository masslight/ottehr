import { Box, Typography } from '@mui/material';
import { FC } from 'react';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';
import { ProceduresForm } from './ProceduresForm';
import { ProceduresNoteField, ProceduresNoteFieldSkeleton } from './ProceduresNoteField';
import { ActionsList } from '../../../../components';

export const SurgicalHistoryProviderColumn: FC = () => {
  const { isChartDataLoading, isReadOnly, chartData } = getSelectors(useAppointmentStore, [
    'isChartDataLoading',
    'isReadOnly',
    'chartData',
  ]);

  const procedures = chartData?.procedures || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {isReadOnly ? (
        <ActionsList
          data={procedures}
          getKey={(value) => value.resourceId!}
          renderItem={(value) => <Typography>{value.name}</Typography>}
          divider
        />
      ) : (
        <>
          <ProceduresForm />
          {isChartDataLoading ? <ProceduresNoteFieldSkeleton /> : <ProceduresNoteField />}
        </>
      )}
    </Box>
  );
};
