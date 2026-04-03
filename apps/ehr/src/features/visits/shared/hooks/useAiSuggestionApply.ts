import { useCallback, useMemo, useState } from 'react';
import { ObservationTextFieldDTO } from 'utils';
import {
  AiSuggestionSection,
  MappedItemData,
  MappedSuggestion,
  parseAiValue,
  useAiSuggestionMapping,
} from './useAiSuggestionMapping';

interface UseAiSuggestionApplyParams {
  aiObservations: ObservationTextFieldDTO[] | undefined;
  section: AiSuggestionSection;
  isAlreadyApplied: (mappedData: MappedItemData) => boolean;
  onApply: (mappedData: MappedItemData, originalValue: string) => Promise<void> | void;
}

interface UseAiSuggestionApplyResult {
  expandedContent: ObservationTextFieldDTO[];
  mappedSuggestions: MappedSuggestion[];
  effectiveAppliedIndices: Set<number>;
  handleSuggestionClick: (index: number) => void;
}

export const useAiSuggestionApply = ({
  aiObservations,
  section,
  isAlreadyApplied,
  onApply,
}: UseAiSuggestionApplyParams): UseAiSuggestionApplyResult => {
  const expandedContent = useMemo(() => {
    if (!aiObservations) return [];
    return aiObservations.flatMap((item) =>
      parseAiValue(item.value, section).map((v) => ({
        ...item,
        value: v,
      }))
    );
  }, [aiObservations, section]);

  const mappedSuggestions = useAiSuggestionMapping(aiObservations, section);
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());

  const effectiveAppliedIndices = useMemo(() => {
    const indices = new Set(appliedIndices);
    if (mappedSuggestions.length > 0) {
      mappedSuggestions.forEach((mapped, idx) => {
        if (mapped.mappedData && mapped.mappedData.section === section) {
          if (isAlreadyApplied(mapped.mappedData)) {
            indices.add(idx);
          }
        }
      });
    }
    return indices;
  }, [appliedIndices, mappedSuggestions, section, isAlreadyApplied]);

  const handleSuggestionClick = useCallback(
    async (index: number) => {
      const mapped = mappedSuggestions[index];
      if (!mapped?.mappedData || mapped.mappedData.section !== section) return;

      setAppliedIndices((prev) => new Set(prev).add(index));
      try {
        await onApply(mapped.mappedData, mapped.originalValue);
      } catch {
        setAppliedIndices((prev) => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    },
    [mappedSuggestions, section, onApply]
  );

  return {
    expandedContent,
    mappedSuggestions,
    effectiveAppliedIndices,
    handleSuggestionClick,
  };
};
