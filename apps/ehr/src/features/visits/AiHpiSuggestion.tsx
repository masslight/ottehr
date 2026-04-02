import InputIcon from '@mui/icons-material/Input';
import { CircularProgress } from '@mui/material';
import { FC, useCallback, useState } from 'react';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { AiObservationField, ObservationTextFieldDTO } from 'utils';
import { useChartFields } from './shared/hooks/useChartFields';
import { useChartData, useSaveChartData } from './shared/stores/appointment/appointment.store';

interface AiHpiSuggestionProps {
  isReadOnly?: boolean;
}

export const AiHpiSuggestion: FC<AiHpiSuggestionProps> = ({ isReadOnly }) => {
  const { chartData, refetch: refetchChartData } = useChartData();

  const { data: chartFields, setQueryCache } = useChartFields({
    requestedFields: {
      chiefComplaint: { _tag: 'chief-complaint' },
      mechanismOfInjury: { _tag: 'mechanism-of-injury' },
    },
  });

  const { mutate: saveChartData } = useSaveChartData();
  const [appendingField, setAppendingField] = useState<'hpi' | 'moi' | null>(null);

  const aiHistoryOfPresentIllness = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.HistoryOfPresentIllness
  ) as ObservationTextFieldDTO[];

  const aiMechanismOfInjury = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.MechanismOfInjury
  ) as ObservationTextFieldDTO[];

  const handleAppend = useCallback(
    (field: 'hpi' | 'moi', suggestions: ObservationTextFieldDTO[]) => {
      const suggestionText = suggestions.map((s) => s.value).join('\n');
      if (!suggestionText) return;

      setAppendingField(field);

      const isHpi = field === 'hpi';
      const fieldName = isHpi ? 'chiefComplaint' : 'mechanismOfInjury';
      const currentText = (isHpi ? chartFields?.chiefComplaint?.text : chartFields?.mechanismOfInjury?.text) || '';
      const newText = currentText ? `${currentText}\n${suggestionText}` : suggestionText;

      saveChartData(
        {
          [fieldName]: {
            resourceId: chartFields?.[fieldName]?.resourceId,
            text: newText,
          },
        },
        {
          onSuccess: (data) => {
            setQueryCache({ [fieldName]: data.chartData[fieldName] });
            void refetchChartData();
            setAppendingField(null);
          },
          onError: () => {
            setAppendingField(null);
          },
        }
      );
    },
    [chartFields, saveChartData, setQueryCache, refetchChartData]
  );

  if (
    (!aiHistoryOfPresentIllness || aiHistoryOfPresentIllness.length === 0) &&
    (!aiMechanismOfInjury || aiMechanismOfInjury.length === 0)
  ) {
    return null;
  }

  return (
    <>
      <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
      {aiHistoryOfPresentIllness && aiHistoryOfPresentIllness.length > 0 && (
        <AiSuggestion
          title="History of Present Illness (HPI)"
          chartData={chartData}
          content={aiHistoryOfPresentIllness}
          action={
            !isReadOnly
              ? {
                  label: 'Append to History of Present Illness',
                  icon: appendingField === 'hpi' ? <CircularProgress size={16} /> : <InputIcon fontSize="small" />,
                  disabled: appendingField !== null,
                  onClick: () => handleAppend('hpi', aiHistoryOfPresentIllness),
                }
              : undefined
          }
        />
      )}
      {aiMechanismOfInjury && aiMechanismOfInjury.length > 0 && (
        <AiSuggestion
          title="Mechanism of Injury (MOI)"
          chartData={chartData}
          content={aiMechanismOfInjury}
          action={
            !isReadOnly
              ? {
                  label: 'Append to MOI (Mechanism of Injury)',
                  icon: appendingField === 'moi' ? <CircularProgress size={16} /> : <InputIcon fontSize="small" />,
                  disabled: appendingField !== null,
                  onClick: () => handleAppend('moi', aiMechanismOfInjury),
                }
              : undefined
          }
        />
      )}
    </>
  );
};
