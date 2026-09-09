import { Paper, Stack } from '@mui/material';
import { FC } from 'react';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { AiObservationField } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { ObservationTextFieldDTO } from 'utils/lib/types/data/screening-questions/types';
import { ERxContainer } from '../../../shared/components/plan-tab/ERxContainer';
import { useChartData } from '../../../shared/stores/appointment/appointment.store';

export const ERXBody: FC = () => {
  const { chartData } = useChartData();

  const aiERX = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.eRX
  ) as ObservationTextFieldDTO[];

  return (
    <Stack spacing={1} sx={{ flex: '1 0 auto' }}>
      <ERxContainer />
      {aiERX?.length > 0 && (
        <Paper sx={{ padding: 2, marginBottom: 2 }}>
          <AiSuggestion title={'eRX'} chartData={chartData} content={aiERX} />
        </Paper>
      )}
    </Stack>
  );
};
