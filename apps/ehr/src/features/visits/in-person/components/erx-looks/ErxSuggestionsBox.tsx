import { Alert } from '@mui/material';
import { ReactElement, ReactNode, useMemo } from 'react';
import { SentencePicks, SuggestedSentence, SuggestedSentences } from 'src/components/SuggestedSentences';
import { SentenceBlank } from 'utils/lib/helpers/suggested-sentences';
import { DoseInfoHover, SourceText } from './DoseCalculatorCard';

/**
 * The suggestions box above a prescription line, as looks only. A row is the shared `SuggestedSentence`: its
 * segments make the sentence (a dose or none, "— for" and a diagnosis blank), `reason` the grey "Because …" line,
 * `caution` and `note` the lines under it. "Other" (Write my own) is always the last row.
 */

export const OTHER_ROW: SuggestedSentence = { id: 'other', segments: ['Other'], addLabel: 'Write my own' };

/** A row from a quick pick, or whose dose is a blank: the dose tool (a calculator icon) starts its sentence. The ⓘ by
 * its "+" holds the quick pick it came from, then how the dose was worked out. */
export interface ErxSuggestionRow extends SuggestedSentence {
  doseAt?: number;
  /** Behind the ⓘ by the "+", after the quick pick: the working, a maximum reached, how far the measured dose is off. */
  doseInfo?: string[];
  /** The quick pick the row came from: the first line behind the ⓘ ("Quick pick: Amox strep"), never on the row. */
  quickPickName?: string;
  /** The quick pick's source, after its name: "Source: AAP Red Book", a link with a URL. */
  quickPickSource?: { label: string; url?: string };
}

/** What the ⓘ by a row's "+" says: its quick pick and source, then its dose's working. */
const rowInfo = (row: ErxSuggestionRow): ReactNode[] => [
  ...(row.quickPickName ? [`Quick pick: ${row.quickPickName}`] : []),
  ...(row.quickPickSource ? [<SourceText key="source" source={row.quickPickSource} />] : []),
  ...(row.doseAt !== undefined ? row.doseInfo ?? [] : []),
];

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
      /** At the start of a quick pick's row or one with a dose blank, before "Take": the calculator icon. */
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
      // A quick pick's row, or one with a dose blank: its calculator icon starts the sentence. The ⓘ by its "+" has its
      // quick pick and working.
      renderLead={(row, picks) =>
        isRow(row) && (row.doseAt !== undefined || row.quickPickName !== undefined)
          ? renderDoseTool?.(row, picks)
          : null
      }
      renderBesideAdd={(row) => {
        const lines = isRow(row) ? rowInfo(row) : [];
        return lines.length ? (
          <DoseInfoHover
            label={
              isRow(row) && row.doseAt !== undefined && row.doseInfo?.length
                ? 'How this dose was worked out'
                : 'About this suggestion'
            }
            lines={lines}
            testId="suggestion-info"
            asButton
          />
        ) : null;
      }}
      addLabel="Use this prescription"
      addedLabel="In use"
    />
  );
};
