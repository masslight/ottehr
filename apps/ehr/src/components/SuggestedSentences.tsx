import { otherColors } from '@ehrTheme/colors';
import { AddCircleOutline, CheckCircle, ExpandMore } from '@mui/icons-material';
import {
  alpha,
  Box,
  Collapse,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  Popover,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { ReactElement, ReactNode, useState } from 'react';
import {
  findUnpickedBlank,
  isSentenceBlank,
  NONE_OPTION_LABEL,
  SentenceBlank,
  SentenceSegment,
} from 'utils/lib/helpers/suggested-sentences';

export interface SuggestedSentence {
  id: string;
  name?: string;
  segments: SentenceSegment[];
  reason?: string;
  /** More lines under it in gray, as written. */
  details?: string[];
  /** This row's own name for its "+" (a row that is not a suggestion, as "Other"), in place of `addLabel`. */
  addLabel?: string;
  /** The segments as the row's picks so far make them (a dose worked out again for the frequency picked), with the
   * same blanks at the same places; `segments` until then. */
  segmentsFor?: (picks: SentencePicks) => SentenceSegment[];
}

export type SentencePicks = (string | undefined)[];

interface SuggestedSentencesProps<T extends SuggestedSentence> {
  title: string;
  caption?: string;
  rows: T[];
  isAdded: (row: T, picks: SentencePicks) => boolean;
  onAdd: (row: T, picks: SentencePicks) => void;
  addLabel: string;
  addedLabel: string;
  resolveValues?: (row: T, picks: SentencePicks) => SentencePicks;
  findConflict?: (row: T, picks: SentencePicks, segment: number, option: string) => string | undefined;
  dataTestId?: string;
  children?: ReactNode;
  /** The popover body for a blank filled in some other way than from its options (a prescription's dose, typed),
   * given the pick to make; `undefined` keeps the options list. */
  renderPicker?: (row: T, blank: SentenceBlank, pick: (value: string) => void) => ReactNode;
  /** Shown at the start of the row's sentence (a calculator icon before "Take"), given the row's picks. */
  renderLead?: (row: T, picks: SentencePicks) => ReactNode;
  /** Shown just before the row's "+" (an ⓘ with how its dose was worked out), given the row's picks. */
  renderBesideAdd?: (row: T, picks: SentencePicks) => ReactNode;
  /** A light blue-gray background, so the box reads apart from the lines it suggests for. */
  tinted?: boolean;
  /** With `onCollapsedChange`, the title line toggles the rows with a chevron; collapsed, only it shows. */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

interface BlankRef {
  row: number;
  segment: number;
}

const blankKey = ({ row, segment }: BlankRef): string => `${row}:${segment}`;

const defaultValues = (row: SuggestedSentence, picks: SentencePicks): SentencePicks =>
  row.segments.map((segment, i) => (isSentenceBlank(segment) ? picks[i] ?? segment.initial : undefined));

const fieldName = (blank: SentenceBlank): string => blank.title.replace(/\s*\(.*\)$/, '').toLowerCase();

export const SuggestedSentences = <T extends SuggestedSentence>({
  title,
  caption,
  rows,
  isAdded,
  onAdd,
  addLabel,
  addedLabel,
  resolveValues = defaultValues,
  findConflict,
  dataTestId,
  children,
  renderPicker,
  renderLead,
  renderBesideAdd,
  tinted,
  collapsed = false,
  onCollapsedChange,
}: SuggestedSentencesProps<T>): ReactElement => {
  const [picked, setPicked] = useState<{ rows: T[]; values: Record<string, string> }>({ rows, values: {} });
  const [opened, setOpened] = useState<{ rows: T[]; blank: BlankRef; anchor: HTMLElement } | null>(null);
  const values = picked.rows === rows ? picked.values : {};
  const active = opened?.rows === rows ? opened : null;

  const activeBlank = active && (rows[active.blank.row].segments[active.blank.segment] as SentenceBlank);
  const rowPicks = (row: number): SentencePicks =>
    rows[row].segments.map((segment, i) =>
      isSentenceBlank(segment) ? values[blankKey({ row, segment: i })] : undefined
    );
  // A row's segments as its picks make them (`segmentsFor`), so a value worked out again shows.
  const shownValues = (row: number): SentencePicks => {
    const picks = rowPicks(row);
    const segments = rows[row].segmentsFor?.(picks);
    return resolveValues(segments ? { ...rows[row], segments } : rows[row], picks);
  };

  const pick = (option: string): void => {
    if (!active) return;
    setPicked({ rows, values: { ...values, [blankKey(active.blank)]: option } });
    setOpened(null);
  };
  const picker = active && activeBlank && renderPicker?.(rows[active.blank.row], activeBlank, pick);

  const heading = (
    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: collapsed ? 0 : 0.5 }}>
      {title}
      {caption && (
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1.5, fontWeight: 400 }}>
          {caption}
        </Typography>
      )}
    </Typography>
  );
  const body = (
    <>
      {children}
      {rows.map((suggestion, row) => {
        const picks = rowPicks(row);
        const segments = suggestion.segmentsFor?.(picks) ?? suggestion.segments;
        const shown = shownValues(row);
        const mustPick = findUnpickedBlank(segments, picks);
        const added = !mustPick && isAdded(suggestion, picks);
        const named = (label: string): string => (suggestion.name ? `${label}: ${suggestion.name}` : label);
        return (
          <Box key={suggestion.id} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, py: 0.5 }}>
            <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.8 }}>
              {renderLead?.(suggestion, picks)}
              {segments.map((segment, i) => {
                if (typeof segment === 'string') return segment;
                if (!isSentenceBlank(segment))
                  return (
                    <Box component="span" key={i} sx={{ fontWeight: 500 }}>
                      {segment.number}
                    </Box>
                  );
                const ref = { row, segment: i };
                const isPicked = picks[i] !== undefined;
                const blankValue = shown[i];
                const unpicked = blankValue === undefined;
                const empty = blankValue === '';
                const name = fieldName(segment);
                return (
                  <Box
                    component="button"
                    type="button"
                    key={i}
                    aria-label={`${segment.title}: ${unpicked ? 'not picked' : blankValue || NONE_OPTION_LABEL}`}
                    aria-haspopup="listbox"
                    aria-expanded={active?.blank.row === row && active.blank.segment === i}
                    onClick={(e: React.MouseEvent<HTMLElement>) =>
                      setOpened({ rows, blank: ref, anchor: e.currentTarget })
                    }
                    sx={(theme) => {
                      const tint = isPicked ? theme.palette.success.main : theme.palette.primary.main;
                      return {
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
                        ...(unpicked && {
                          border: '1px dashed',
                          borderColor: theme.palette.warning.dark,
                          color: otherColors.warningText,
                          backgroundColor: 'transparent',
                          '&:hover': { backgroundColor: alpha(theme.palette.warning.main, 0.1) },
                        }),
                        ...(empty && {
                          border: '1px dotted',
                          borderColor: theme.palette.divider,
                          color: theme.palette.text.secondary,
                          backgroundColor: 'transparent',
                          '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
                        }),
                      };
                    }}
                  >
                    {unpicked ? segment.placeholder ?? name : empty ? `+ ${name}` : blankValue}
                    {isPicked && !empty && (
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
              {suggestion.details?.map((detail) => (
                <Typography
                  key={detail}
                  component="span"
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block' }}
                >
                  {detail}
                </Typography>
              ))}
            </Typography>
            {/* The ⓘ and the "+" share one box size, centred on the sentence's first line (body2 at 1.8 is 25.2px). */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: '2.6px', flex: 'none' }}>
              {renderBesideAdd?.(suggestion, picks)}
              {added ? (
                <CheckCircle sx={{ fontSize: 16, color: 'success.main', m: '2px' }} titleAccess={named(addedLabel)} />
              ) : (
                <Tooltip
                  title={mustPick ? `Pick the ${mustPick.title.toLowerCase()} first` : suggestion.addLabel ?? addLabel}
                >
                  <span>
                    <IconButton
                      size="small"
                      aria-label={named(suggestion.addLabel ?? addLabel)}
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
          </Box>
        );
      })}
    </>
  );
  return (
    <Box
      sx={{
        p: 1.5,
        border: '1px solid',
        borderColor: tinted ? '#d6e0ec' : '#e0e0e0',
        borderRadius: 1,
        ...(tinted && { bgcolor: '#f3f6fa' }),
      }}
      data-testid={dataTestId}
    >
      {onCollapsedChange ? (
        // The whole title line toggles; its chevron is the button.
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {heading}
          <IconButton
            size="small"
            aria-label={collapsed ? 'Show suggestions' : 'Hide suggestions'}
            aria-expanded={!collapsed}
            sx={{ padding: '2px' }}
          >
            <ExpandMore
              sx={{
                fontSize: '17px',
                transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: 'transform 0.2s',
              }}
            />
          </IconButton>
        </Box>
      ) : (
        heading
      )}
      {onCollapsedChange ? (
        <Collapse in={!collapsed} unmountOnExit>
          {body}
        </Collapse>
      ) : (
        body
      )}
      {/* A Menu for the keyboard handling (arrows, Enter, Escape back to the blank); listbox roles because
          the items are the blank's possible values, one of which is current, rather than commands. */}
      <Menu
        open={Boolean(active) && !picker}
        anchorEl={active?.anchor}
        onClose={() => setOpened(null)}
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
            const { row, segment } = active.blank;
            const current = option === shownValues(row)[segment];
            const clash = findConflict?.(rows[row], rowPicks(row), segment, option);
            return (
              <MenuItem
                key={option}
                role="option"
                selected={current}
                aria-selected={current}
                disabled={Boolean(clash)}
                sx={{ borderRadius: 1, mx: 1, whiteSpace: 'normal' }}
                onClick={() => pick(option)}
              >
                {option || NONE_OPTION_LABEL}
                {clash && (
                  <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                    (not with “{clash}”)
                  </Typography>
                )}
              </MenuItem>
            );
          })}
      </Menu>
      {/* A blank with a picker of its own gets it in a popover instead. */}
      <Popover
        open={Boolean(picker)}
        anchorEl={active?.anchor}
        onClose={() => setOpened(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        // Named by the blank's title; the picker's own labelled field shows it, so no heading repeats it.
        slotProps={{ paper: { sx: { p: 1 }, role: 'dialog', 'aria-label': activeBlank?.title } }}
        // Into the picker's input once the popover is placed (a list it opens then sits under it, not at the corner).
        TransitionProps={{ onEntered: (paper) => paper.querySelector('input')?.focus() }}
      >
        {picker}
      </Popover>
    </Box>
  );
};
