import { Alert } from '@mui/material';
import { ReactElement, ReactNode, useMemo } from 'react';
import { SentencePicks, SuggestedSentence, SuggestedSentences } from 'src/components/SuggestedSentences';
import { SentenceBlank } from 'utils/lib/helpers/suggested-sentences';
import { DoseInfoHover } from './DoseCalculatorCard';

/**
 * The suggestions box above a prescription line, as looks only. A row is the shared `SuggestedSentence`: its
 * segments make the sentence (a dose or none, "— for" and a diagnosis blank), `reason` the grey "Because …" line,
 * `caution` and `note` the lines under it. "Other" (Write my own) is always the last row.
 */

export const OTHER_ROW: SuggestedSentence = { id: 'other', segments: ['Other'], addLabel: 'Write my own' };

/** A row whose dose is a blank: the dose tool (a calculator icon) starts its sentence, and an ⓘ with how the dose
 * was worked out sits by its "+". */
export interface ErxSuggestionRow extends SuggestedSentence {
  doseAt?: number;
  /** Behind the ⓘ by the "+": the working, a maximum reached, how far the measured dose is off. */
  doseInfo?: string[];
}

export type ErxSuggestionsBoxProps<T extends ErxSuggestionRow> =
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
      /** At the start of a row with a dose blank, before "Take": the calculator icon. */
      renderDoseTool?: (row: T, picks: SentencePicks) => ReactNode;
    }
  /** The drug has no suggestions: no box, the line opens straight away. */
  | { look: 'none' }
  /** The label says the drug is contraindicated for this patient: a red box and no rows. */
  | { look: 'contraindicated'; message: string };

export const ErxSuggestionsBox = <T extends ErxSuggestionRow>(
  props: ErxSuggestionsBoxProps<T>
): ReactElement | null => {
  const rows = props.look === 'rows' ? props.rows : undefined;
  // A new rows array resets the picks inside SuggestedSentences, so it changes only with the rows given.
  const withOther = useMemo<SuggestedSentence[]>(() => [...(rows ?? []), OTHER_ROW], [rows]);
  if (props.look === 'none') return null;
  if (props.look === 'contraindicated') return <Alert severity="error">{props.message}</Alert>;
  const { weightNote, isAdded, onPick, onOther, renderPicker, renderDoseTool } = props;
  const isRow = (row: SuggestedSentence): row is T => row !== OTHER_ROW;
  return (
    <SuggestedSentences<SuggestedSentence>
      title="Suggested prescriptions"
      caption={weightNote}
      rows={withOther}
      isAdded={(row, picks) => isRow(row) && (isAdded?.(row, picks) ?? false)}
      onAdd={(row, picks) => (isRow(row) ? onPick(row, picks) : onOther())}
      renderPicker={renderPicker && ((row, blank, pick) => (isRow(row) ? renderPicker(row, blank, pick) : undefined))}
      // A row with a dose blank: its calculator icon starts the sentence, and the ⓘ sits by its "+".
      renderLead={(row, picks) => (isRow(row) && row.doseAt !== undefined ? renderDoseTool?.(row, picks) : null)}
      renderBesideAdd={(row) =>
        isRow(row) && row.doseAt !== undefined && row.doseInfo?.length ? (
          <DoseInfoHover label="How this dose was worked out" lines={row.doseInfo} testId="suggestion-dose-working" />
        ) : null
      }
      addLabel="Use this prescription"
      addedLabel="In use"
    />
  );
};
