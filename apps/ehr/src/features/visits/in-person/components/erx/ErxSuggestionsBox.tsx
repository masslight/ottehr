import { Box, Chip } from '@mui/material';
import { ReactElement, ReactNode, useMemo } from 'react';
import { SentencePicks, SuggestedSentence, SuggestedSentences } from 'src/components/SuggestedSentences';
import { SentenceBlank } from 'utils/lib/helpers/suggested-sentences';
import { DoseInfoHover, SourceText } from './DoseCalculatorCard';

/**
 * The suggestions box above a prescription line, as looks only. A row is the shared `SuggestedSentence`: its
 * segments make the sentence (a quick pick's directions as written, or its dose re-worked as blanks), `details` the
 * lines under a set's row. "Other" (Write my own) is always the last row.
 */

const OTHER_ROW: SuggestedSentence = { id: 'other', segments: ['Other'], addLabel: 'Write my own' };

/** A row from a quick pick, or whose dose is a blank: the dose tool (a calculator icon) starts its sentence. The ⓘ by
 * its "+" holds the quick pick it came from, then how the dose was worked out. */
export interface ErxSuggestionRow extends SuggestedSentence {
  doseAt?: number;
  /** Behind the ⓘ by the "+", after the quick pick, as the row's picks so far make it (a dose worked out again for the
   * frequency picked): the working and how far the measured dose is off, or why there is no dose. */
  doseInfoFor?: (picks: SentencePicks) => string[] | undefined;
  /** The quick pick the row came from: the first line behind the ⓘ ("Quick pick: Amox strep"), never on the row. */
  quickPickName?: string;
  /** The quick pick's source, after its name: "Info: AAP Red Book", a link with a URL. */
  quickPickSource?: { label: string; url?: string };
  /** A set's row: its name and a "Set · N" chip lead the sentence, after the dose tool. */
  setName?: string;
  setSize?: number;
}

/** What the ⓘ by a row's "+" says: its quick pick and source, then its dose's working. */
const rowInfo = (row: ErxSuggestionRow, picks: SentencePicks): ReactNode[] => [
  ...(row.quickPickName ? [`Quick pick: ${row.quickPickName}`] : []),
  ...(row.quickPickSource ? [<SourceText key="source" source={row.quickPickSource} />] : []),
  ...(row.doseAt !== undefined ? row.doseInfoFor?.(picks) ?? [] : []),
];

export interface ErxSuggestionsBoxProps<T extends ErxSuggestionRow> {
  rows: T[];
  /** "using weight 18 kg (previous visit, 10/8/2026)". */
  weightNote?: string;
  isAdded?: (row: T, picks: SentencePicks) => boolean;
  onPick: (row: T, picks: SentencePicks) => void;
  onOther: () => void;
  /** The popover body for a blank typed in (a dose); `undefined` keeps its options list. */
  renderPicker?: (row: T, blank: SentenceBlank, pick: (value: string) => void) => ReactNode;
  /** At the start of a quick pick's row or one with a dose blank, before "Take": the calculator icon. */
  renderDoseTool?: (row: T, picks: SentencePicks) => ReactNode;
  /** Collapsed to its title line; the title's chevron toggles it. */
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export const ErxSuggestionsBox = <T extends ErxSuggestionRow>({
  rows,
  weightNote,
  isAdded,
  onPick,
  onOther,
  renderPicker,
  renderDoseTool,
  collapsed,
  onCollapsedChange,
}: ErxSuggestionsBoxProps<T>): ReactElement => {
  // A new rows array resets the picks inside SuggestedSentences, so it changes only with the rows given.
  const withOther = useMemo<SuggestedSentence[]>(() => [...rows, OTHER_ROW], [rows]);
  const isRow = (row: SuggestedSentence): row is T => row !== OTHER_ROW;
  return (
    <SuggestedSentences<SuggestedSentence>
      title="Suggested prescriptions"
      tinted
      collapsed={collapsed}
      onCollapsedChange={onCollapsedChange}
      caption={weightNote}
      rows={withOther}
      isAdded={(row, picks) => isRow(row) && (isAdded?.(row, picks) ?? false)}
      onAdd={(row, picks) => (isRow(row) ? onPick(row, picks) : onOther())}
      renderPicker={renderPicker && ((row, blank, pick) => (isRow(row) ? renderPicker(row, blank, pick) : undefined))}
      // A quick pick's row, or one with a dose blank: its dose tool starts the sentence (the calculator icon when it has
      // saved dosing, else the icon disabled, its hover saying it's as written). The ⓘ by its "+" has its quick pick
      // and working.
      renderLead={(row, picks) =>
        isRow(row) && (row.doseAt !== undefined || row.quickPickName !== undefined) ? (
          <>
            {renderDoseTool?.(row, picks)}
            {row.setName && (
              <>
                <Box component="span" sx={{ fontWeight: 600 }}>
                  {row.setName}
                </Box>
                <Chip size="small" label={`Set · ${row.setSize}`} sx={{ height: 20, mx: 0.5 }} />
              </>
            )}
          </>
        ) : null
      }
      renderBesideAdd={(row, picks) => {
        const lines = isRow(row) ? rowInfo(row, picks) : [];
        return lines.length ? (
          <DoseInfoHover
            label={
              isRow(row) && row.doseAt !== undefined && row.doseInfoFor?.(picks)?.length
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
