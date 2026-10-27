import { Alert } from '@mui/material';
import { ReactElement, ReactNode, useMemo } from 'react';
import { SentencePicks, SuggestedSentence, SuggestedSentences } from 'src/components/SuggestedSentences';
import { SentenceBlank } from 'utils/lib/helpers/suggested-sentences';

/**
 * The suggestions box above a prescription line, as looks only. A row is the shared `SuggestedSentence`: its
 * segments make the sentence (a dose or none, "— for" and a diagnosis blank), `reason` the grey "Because …" line,
 * `caution` and `note` the lines under it. "Other" (Write my own) is always the last row.
 */

export const OTHER_ROW: SuggestedSentence = { id: 'other', segments: ['Other'], addLabel: 'Write my own' };

export type ErxSuggestionsBoxProps<T extends SuggestedSentence> =
  | {
      look: 'rows';
      rows: T[];
      /** "using weight 18 kg (previous visit, 10/8/2026)". */
      weightNote?: string;
      isAdded?: (row: T, picks: SentencePicks) => boolean;
      onPick: (row: T, picks: SentencePicks) => void;
      onOther: () => void;
      /** The popover body for a blank picked by search (a diagnosis); `undefined` keeps its options list. */
      renderPicker?: (row: T, blank: SentenceBlank, pick: (value: string) => void) => ReactNode;
    }
  /** The drug has no suggestions: no box, the line opens straight away. */
  | { look: 'none' }
  /** The label says the drug is contraindicated for this patient: a red box and no rows. */
  | { look: 'contraindicated'; message: string };

export const ErxSuggestionsBox = <T extends SuggestedSentence>(
  props: ErxSuggestionsBoxProps<T>
): ReactElement | null => {
  const rows = props.look === 'rows' ? props.rows : undefined;
  // A new rows array resets the picks inside SuggestedSentences, so it changes only with the rows given.
  const withOther = useMemo<SuggestedSentence[]>(() => [...(rows ?? []), OTHER_ROW], [rows]);
  if (props.look === 'none') return null;
  if (props.look === 'contraindicated') return <Alert severity="error">{props.message}</Alert>;
  const { weightNote, isAdded, onPick, onOther, renderPicker } = props;
  const isRow = (row: SuggestedSentence): row is T => row !== OTHER_ROW;
  return (
    <SuggestedSentences<SuggestedSentence>
      title="Suggested prescriptions"
      caption={weightNote}
      rows={withOther}
      isAdded={(row, picks) => isRow(row) && (isAdded?.(row, picks) ?? false)}
      onAdd={(row, picks) => (isRow(row) ? onPick(row, picks) : onOther())}
      renderPicker={renderPicker && ((row, blank, pick) => (isRow(row) ? renderPicker(row, blank, pick) : undefined))}
      addLabel="Use this prescription"
      addedLabel="In use"
    />
  );
};
