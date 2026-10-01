import { Box } from '@mui/material';
import React, { useMemo } from 'react';
import { SuggestedSentences } from 'src/components/SuggestedSentences';
import type { LateralityValue } from 'utils/lib/fhir/radiology';
import { buildPreliminaryReadSuggestions } from 'utils/lib/helpers/radiology/preliminaryReadSuggestions';
import { assembleSentence } from 'utils/lib/helpers/suggested-sentences';

interface RadiologyPreliminaryReadSuggestionsProps {
  cptCode?: string;
  laterality?: LateralityValue;
  isChild: boolean;
  disabled?: boolean;
  /** The Preliminary Read field's current text; a row shows as added while its sentence is still in it */
  value: string;
  onAdd: (sentence: string) => void;
}

/**
 * Template sentences for the ordered study; "+" appends the finished sentence to the Preliminary Read.
 * Renders nothing for a study without templates.
 */
export const RadiologyPreliminaryReadSuggestions: React.FC<RadiologyPreliminaryReadSuggestionsProps> = ({
  cptCode,
  laterality,
  isChild,
  disabled,
  value,
  onAdd,
}) => {
  const rows = useMemo(
    () =>
      buildPreliminaryReadSuggestions({ cptCode, laterality, isChild }).map((suggestion) => ({
        id: suggestion.name,
        segments: suggestion.segments,
      })),
    [cptCode, laterality, isChild]
  );

  if (disabled || rows.length === 0) return null;

  return (
    <Box sx={{ mt: 2 }}>
      <SuggestedSentences
        title="Suggested reads"
        rows={rows}
        // Derived from the field, so deleting the sentence there (or changing a blank) re-arms the "+".
        isAdded={(row, picks) => value.includes(assembleSentence(row.segments, picks))}
        onAdd={(row, picks) => onAdd(assembleSentence(row.segments, picks))}
        addLabel="Add to read"
        addedLabel="Added to read"
      />
    </Box>
  );
};
