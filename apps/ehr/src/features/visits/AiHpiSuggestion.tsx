import { FC } from 'react';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { AiObservationField, ObservationTextFieldDTO } from 'utils';
import { useChartData } from './shared/stores/appointment/appointment.store';

export const AiHpiSuggestion: FC = () => {
  const { chartData } = useChartData();

  const aiHistoryOfPresentIllness = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.HistoryOfPresentIllness
  ) as ObservationTextFieldDTO[];

  if (!aiHistoryOfPresentIllness || aiHistoryOfPresentIllness.length === 0) {
    return null;
  }

  return (
    <>
      <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
      <AiSuggestion
        title="History of Present Illness (HPI)"
        chartData={chartData}
        content={aiHistoryOfPresentIllness}
      />
    </>
  );
};
