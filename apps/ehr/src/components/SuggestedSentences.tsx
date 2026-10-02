import { otherColors } from '@ehrTheme/colors';
import { AddCircleOutline, CheckCircle } from '@mui/icons-material';
import { alpha, Box, IconButton, ListSubheader, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import React, { ReactElement, ReactNode, useEffect, useState } from 'react';
import {
  findUnpickedBlank,
  isSentenceBlank,
  NONE_OPTION_LABEL,
  SentenceBlank,
  SentenceSegment,
} from 'utils/lib/helpers/suggested-sentences';

export interface SuggestedSentence {
  /** Stable identity within the list; a changed `rows` array resets every pick. */
  id: string;
  segments: SentenceSegment[];
  /** Why this sentence is offered, shown under it as "Because …". */
  reason?: string;
}

/** The current value of each segment: a pick for a blank, `undefined` for text and for a blank left on its default. */
export type SentencePicks = (string | undefined)[];

interface SuggestedSentencesProps<T extends SuggestedSentence> {
  title: string;
  /** Lighter text after the title, e.g. how the rows were chosen. */
  caption?: string;
  rows: T[];
  /** Whether the row, as currently filled in, is already in the target; derived by the caller, never stored here. */
  isAdded: (row: T, picks: SentencePicks) => boolean;
  onAdd: (row: T, picks: SentencePicks) => void;
  addLabel: string;
  addedLabel: string;
  dataTestId?: string;
  /** Rendered between the title and the rows (a note about the patient, say). */
  children?: ReactNode;
}

/** Position of a blank: template row and segment index within it */
interface BlankRef {
  row: number;
  segment: number;
}

const blankKey = ({ row, segment }: BlankRef): string => `${row}:${segment}`;

/**
 * Template sentences with the variable words highlighted; picking a word swaps it and "+" hands the finished
 * row to the caller. Plain templates, nothing is read from the image or the chart.
 */
export const SuggestedSentences = <T extends SuggestedSentence>({
  title,
  caption,
  rows,
  isAdded,
  onAdd,
  addLabel,
  addedLabel,
  dataTestId,
  children,
}: SuggestedSentencesProps<T>): ReactElement => {
  // Picks are kept apart from the templates so a value the provider chose survives re-renders but not a
  // change of the rows themselves (another study, other numbers), which rebuilds the templates.
  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState<{ blank: BlankRef; anchor: HTMLElement } | null>(null);

  useEffect(() => {
    setValues({});
    setActive(null);
  }, [rows]);

  const activeBlank = active && (rows[active.blank.row].segments[active.blank.segment] as SentenceBlank);
  // `undefined` is a blank that still has to be picked (a side the order didn't fix).
  const valueOf = (ref: BlankRef, blank: SentenceBlank): string | undefined => values[blankKey(ref)] ?? blank.initial;
  const rowPicks = (row: number): SentencePicks =>
    rows[row].segments.map((segment, i) =>
      isSentenceBlank(segment) ? values[blankKey({ row, segment: i })] : undefined
    );

  const pick = (option: string): void => {
    if (!active) return;
    setValues((prev) => ({ ...prev, [blankKey(active.blank)]: option }));
    setActive(null);
  };

  return (
    <Box sx={{ p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }} data-testid={dataTestId}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title}
        {caption && (
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1.5, fontWeight: 400 }}>
            {caption}
          </Typography>
        )}
      </Typography>
      {children}
      {rows.map((suggestion, row) => {
        const picks = rowPicks(row);
        const mustPick = findUnpickedBlank(suggestion.segments, picks);
        const added = !mustPick && isAdded(suggestion, picks);
        return (
          <Box key={suggestion.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, py: 0.5 }}>
            <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.8 }}>
              {suggestion.segments.map((segment, i) => {
                if (typeof segment === 'string') return segment;
                if (!isSentenceBlank(segment))
                  return (
                    <Box component="span" key={i} sx={{ fontWeight: 500 }}>
                      {segment.number}
                    </Box>
                  );
                const ref = { row, segment: i };
                const picked = blankKey(ref) in values;
                const blankValue = valueOf(ref, segment);
                const unpicked = blankValue === undefined;
                return (
                  <Box
                    component="button"
                    type="button"
                    key={i}
                    aria-label={`${segment.title}: ${unpicked ? 'not picked' : blankValue || NONE_OPTION_LABEL}`}
                    aria-haspopup="listbox"
                    onClick={(e: React.MouseEvent<HTMLElement>) => setActive({ blank: ref, anchor: e.currentTarget })}
                    sx={(theme) => {
                      const tint = picked ? theme.palette.success.main : theme.palette.primary.main;
                      return {
                        // A button, but laid out as a run of text so a long value wraps within the sentence.
                        display: 'inline',
                        textAlign: 'left',
                        font: 'inherit',
                        color: 'inherit',
                        border: 'none',
                        margin: 0,
                        boxDecorationBreak: 'clone',
                        cursor: 'pointer',
                        backgroundColor: alpha(tint, 0.15),
                        borderRadius: '3px',
                        padding: '1px 2px',
                        '&:hover': { backgroundColor: alpha(tint, 0.3) },
                        // Still to be picked: an outlined placeholder rather than a value that could pass for one.
                        ...(unpicked && {
                          border: '1px dashed',
                          borderColor: theme.palette.warning.dark,
                          color: otherColors.warningText,
                          backgroundColor: 'transparent',
                          '&:hover': { backgroundColor: alpha(theme.palette.warning.main, 0.1) },
                        }),
                      };
                    }}
                  >
                    {unpicked ? segment.title.toLowerCase() : blankValue || NONE_OPTION_LABEL}
                    {picked && (
                      <CheckCircle sx={{ fontSize: 12, color: 'success.main', ml: 0.25, verticalAlign: 'middle' }} />
                    )}
                  </Box>
                );
              })}
              {suggestion.reason && (
                <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Because {suggestion.reason}
                </Typography>
              )}
            </Typography>
            {added ? (
              <CheckCircle sx={{ fontSize: 16, color: 'success.main', m: '2px' }} titleAccess={addedLabel} />
            ) : (
              <Tooltip title={mustPick ? `Pick the ${mustPick.title.toLowerCase()} first` : addLabel}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={addLabel}
                    disabled={Boolean(mustPick)}
                    onClick={() => onAdd(suggestion, picks)}
                    sx={{ padding: '2px' }}
                    color="primary"
                  >
                    <AddCircleOutline sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        );
      })}
      {/* A Menu for the keyboard handling (arrows, Enter, Escape back to the blank); listbox roles because
          the items are the blank's possible values, one of which is current, rather than commands. */}
      <Menu
        open={Boolean(active)}
        anchorEl={active?.anchor}
        onClose={() => setActive(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        MenuListProps={{ role: 'listbox', 'aria-label': activeBlank?.title, dense: true }}
        slotProps={{ paper: { sx: { maxHeight: 300, minWidth: 280, maxWidth: 400 } } }}
      >
        {active && activeBlank && (
          <ListSubheader disableSticky sx={{ lineHeight: '32px', fontWeight: 700, color: 'text.primary' }}>
            {activeBlank.title}
          </ListSubheader>
        )}
        {active &&
          activeBlank &&
          activeBlank.options.map((option) => {
            const current = option === valueOf(active.blank, activeBlank);
            return (
              <MenuItem
                key={option}
                role="option"
                selected={current}
                aria-selected={current}
                sx={{ borderRadius: 1, mx: 1 }}
                onClick={() => pick(option)}
              >
                {option || NONE_OPTION_LABEL}
              </MenuItem>
            );
          })}
      </Menu>
    </Box>
  );
};
