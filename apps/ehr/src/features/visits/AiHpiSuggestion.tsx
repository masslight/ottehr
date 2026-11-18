import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useState } from 'react';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { AiObservationField } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { ObservationTextFieldDTO } from 'utils/lib/types/data/screening-questions/types';
import { useChartData } from './shared/hooks/useChartData';
import { useChartSection } from './shared/hooks/useChartSection';
import { useSaveChartData } from './shared/stores/appointment/appointment.store';

const normalizeWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** True when the suggestion's text is already in the field, so "+" would only add a second copy. */
export const isSuggestionInText = (fieldText: string | undefined, suggestion: string): boolean => {
  const needle = normalizeWhitespace(suggestion);
  return needle.length > 0 && normalizeWhitespace(fieldText ?? '').includes(needle);
};

export const AiHpiSuggestion: FC = () => {
  const { chartData } = useChartData();
  const { mutate: saveChartData } = useSaveChartData();
  const [appendedIds, setAppendedIds] = useState<Set<string>>(new Set());
  const { data: encounterNotes, setSectionData } = useChartSection('encounterNotes');

  const aiHistoryOfPresentIllness = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.HistoryOfPresentIllness
  ) as ObservationTextFieldDTO[];

  const aiMechanismOfInjury = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.MechanismOfInjury
  ) as ObservationTextFieldDTO[];

  const appendToHpi = useCallback(
    (text: string, resourceId?: string) => {
      const current = encounterNotes?.chiefComplaint?.text || '';
      if (isSuggestionInText(current, text)) {
        if (resourceId) setAppendedIds((prev) => new Set(prev).add(resourceId));
        return;
      }
      const newText = current ? `${current}\n\n${text}` : text;
      // Optimistic update — appears instantly in the text field
      setSectionData({ chiefComplaint: { ...encounterNotes?.chiefComplaint, text: newText } });
      if (resourceId) {
        setAppendedIds((prev) => new Set(prev).add(resourceId));
      }
      saveChartData(
        {
          chiefComplaint: {
            resourceId: encounterNotes?.chiefComplaint?.resourceId,
            text: newText,
          },
        },
        {
          onSuccess: (data) => {
            if (data?.chartData?.chiefComplaint) {
              setSectionData({ chiefComplaint: data.chartData.chiefComplaint });
            }
          },
          onError: () => {
            // Rollback
            setSectionData({ chiefComplaint: encounterNotes?.chiefComplaint });
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
    [encounterNotes, saveChartData, setSectionData]
  );

  const appendToMoi = useCallback(
    (text: string, resourceId?: string) => {
      const current = encounterNotes?.mechanismOfInjury?.text || '';
      if (isSuggestionInText(current, text)) {
        if (resourceId) setAppendedIds((prev) => new Set(prev).add(resourceId));
        return;
      }
      const newText = current ? `${current}\n\n${text}` : text;
      // Optimistic update — appears instantly in the text field
      setSectionData({ mechanismOfInjury: { ...encounterNotes?.mechanismOfInjury, text: newText } });
      if (resourceId) {
        setAppendedIds((prev) => new Set(prev).add(resourceId));
      }
      saveChartData(
        {
          mechanismOfInjury: {
            resourceId: encounterNotes?.mechanismOfInjury?.resourceId,
            text: newText,
          },
        },
        {
          onSuccess: (data) => {
            if (data?.chartData?.mechanismOfInjury) {
              setSectionData({ mechanismOfInjury: data.chartData.mechanismOfInjury });
            }
          },
          onError: () => {
            // Rollback
            setSectionData({ mechanismOfInjury: encounterNotes?.mechanismOfInjury });
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
    [encounterNotes, saveChartData, setSectionData]
  );

  // The on-page "added" ticks reset on reload, and the Chief Complaint and HPI screens both write the HPI field,
  // so a suggestion also counts as added when its text is already in the field.
  const addedIds = new Set(appendedIds);
  for (const [suggestions, fieldText] of [
    [aiHistoryOfPresentIllness, encounterNotes?.chiefComplaint?.text],
    [aiMechanismOfInjury, encounterNotes?.mechanismOfInjury?.text],
  ] as const) {
    for (const suggestion of suggestions ?? []) {
      if (suggestion.resourceId && isSuggestionInText(fieldText, suggestion.value)) addedIds.add(suggestion.resourceId);
    }
  }

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
            appendedNoteIds={addedIds}
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
            appendedNoteIds={addedIds}
          />
        </>
      )}
    </>
  );
};
