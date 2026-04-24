import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useState } from 'react';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { AiObservationField, ObservationTextFieldDTO } from 'utils';
import { useChartFields } from './shared/hooks/useChartFields';
import { useChartData, useSaveChartData } from './shared/stores/appointment/appointment.store';

export const AiHpiSuggestion: FC = () => {
  const { chartData } = useChartData();
  const { mutate: saveChartData } = useSaveChartData();
  const [appendedIds, setAppendedIds] = useState<Set<string>>(new Set());
  const { data: hpiFields } = useChartFields({
    requestedFields: { chiefComplaint: { _tag: 'chief-complaint' } },
  });
  const { data: moiFields } = useChartFields({
    requestedFields: { mechanismOfInjury: { _tag: 'mechanism-of-injury' } },
  });

  const aiHistoryOfPresentIllness = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.HistoryOfPresentIllness
  ) as ObservationTextFieldDTO[];

  const aiMechanismOfInjury = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.MechanismOfInjury
  ) as ObservationTextFieldDTO[];

  const { setQueryCache: setHpiCache } = useChartFields({
    requestedFields: { chiefComplaint: { _tag: 'chief-complaint' } },
  });
  const { setQueryCache: setMoiCache } = useChartFields({
    requestedFields: { mechanismOfInjury: { _tag: 'mechanism-of-injury' } },
  });

  const appendToHpi = useCallback(
    (text: string, resourceId?: string) => {
      const current = hpiFields?.chiefComplaint?.text || '';
      const newText = current ? `${current}\n\n${text}` : text;
      // Optimistic update — appears instantly in the text field
      setHpiCache({ chiefComplaint: { ...hpiFields?.chiefComplaint, text: newText } });
      if (resourceId) {
        setAppendedIds((prev) => new Set(prev).add(resourceId));
      }
      saveChartData(
        {
          chiefComplaint: {
            resourceId: hpiFields?.chiefComplaint?.resourceId,
            text: newText,
          },
        },
        {
          onSuccess: (data) => {
            if (data?.chartData?.chiefComplaint) {
              setHpiCache({ chiefComplaint: data.chartData.chiefComplaint });
            }
          },
          onError: () => {
            // Rollback
            setHpiCache({ chiefComplaint: hpiFields?.chiefComplaint });
            if (resourceId) {
              setAppendedIds((prev) => {
                const next = new Set(prev);
                next.delete(resourceId);
                return next;
              });
            }
            enqueueSnackbar('Failed to add to HPI', { variant: 'error' });
          },
        }
      );
    },
    [hpiFields, saveChartData, setHpiCache]
  );

  const appendToMoi = useCallback(
    (text: string, resourceId?: string) => {
      const current = moiFields?.mechanismOfInjury?.text || '';
      const newText = current ? `${current}\n\n${text}` : text;
      // Optimistic update — appears instantly in the text field
      setMoiCache({ mechanismOfInjury: { ...moiFields?.mechanismOfInjury, text: newText } });
      if (resourceId) {
        setAppendedIds((prev) => new Set(prev).add(resourceId));
      }
      saveChartData(
        {
          mechanismOfInjury: {
            resourceId: moiFields?.mechanismOfInjury?.resourceId,
            text: newText,
          },
        },
        {
          onSuccess: (data) => {
            if (data?.chartData?.mechanismOfInjury) {
              setMoiCache({ mechanismOfInjury: data.chartData.mechanismOfInjury });
            }
          },
          onError: () => {
            // Rollback
            setMoiCache({ mechanismOfInjury: moiFields?.mechanismOfInjury });
            if (resourceId) {
              setAppendedIds((prev) => {
                const next = new Set(prev);
                next.delete(resourceId);
                return next;
              });
            }
            enqueueSnackbar('Failed to add to MOI', { variant: 'error' });
          },
        }
      );
    },
    [moiFields, saveChartData, setMoiCache]
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
        <>
          <AiSuggestion
            title="History of Present Illness (HPI)"
            chartData={chartData}
            content={aiHistoryOfPresentIllness}
            onAppendToNote={appendToHpi}
            appendedNoteIds={appendedIds}
          />
        </>
      )}
      {aiMechanismOfInjury && aiMechanismOfInjury.length > 0 && (
        <>
          <AiSuggestion
            title="Mechanism of Injury (MOI)"
            chartData={chartData}
            content={aiMechanismOfInjury}
            onAppendToNote={appendToMoi}
            appendedNoteIds={appendedIds}
          />
        </>
      )}
    </>
  );
};
