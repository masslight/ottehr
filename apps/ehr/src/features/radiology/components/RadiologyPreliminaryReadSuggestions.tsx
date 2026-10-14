import { otherColors } from '@ehrTheme/colors';
import { AddCircleOutline, CheckCircle } from '@mui/icons-material';
import { alpha, Box, IconButton, ListSubheader, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import React, { useMemo, useState } from 'react';
import type { LateralityValue } from 'utils/lib/fhir/radiology';
import {
  assemblePreliminaryRead,
  buildPreliminaryReadSuggestions,
  findConflictingValue,
  findUnpickedBlank,
  PRELIMINARY_READ_NONE_LABEL,
  PreliminaryReadBlank,
  resolvePreliminaryReadValues,
} from 'utils/lib/helpers/radiology/preliminaryReadSuggestions';

interface RadiologyPreliminaryReadSuggestionsProps {
  cptCode?: string;
  laterality?: LateralityValue;
  isChild: boolean;
  disabled?: boolean;
  /** The Preliminary Read field's current text; a row shows as added while its sentence is still in it */
  value: string;
  onAdd: (sentence: string) => void;
}

/** Position of a blank: template row and segment index within it */
interface BlankRef {
  row: number;
  segment: number;
}

const blankKey = ({ row, segment }: BlankRef): string => `${row}:${segment}`;

export const RadiologyPreliminaryReadSuggestions: React.FC<RadiologyPreliminaryReadSuggestionsProps> = (props) => (
  <SuggestionsBox key={`${props.cptCode}|${props.laterality}|${props.isChild}`} {...props} />
);

const SuggestionsBox: React.FC<RadiologyPreliminaryReadSuggestionsProps> = ({
  cptCode,
  laterality,
  isChild,
  disabled,
  value,
  onAdd,
}) => {
  const suggestions = useMemo(
    () => buildPreliminaryReadSuggestions({ cptCode, laterality, isChild }),
    [cptCode, laterality, isChild]
  );
  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState<{ blank: BlankRef; anchor: HTMLElement } | null>(null);

  if (disabled || suggestions.length === 0) return null;

  const activeBlank = active && (suggestions[active.blank.row].segments[active.blank.segment] as PreliminaryReadBlank);

  const rowValues = (row: number): (string | undefined)[] =>
    suggestions[row].segments.map((segment, i) =>
      typeof segment === 'string' ? undefined : values[blankKey({ row, segment: i })]
    );

  const shownValues = (row: number): (string | undefined)[] =>
    resolvePreliminaryReadValues(suggestions[row].segments, rowValues(row));

  const pick = (option: string): void => {
    if (!active) return;
    setValues((prev) => ({ ...prev, [blankKey(active.blank)]: option }));
    setActive(null);
  };

  return (
    <Box sx={{ mt: 2, p: 1.5, border: '1px solid #e0e0e0', borderRadius: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Suggested reads
      </Typography>
      {suggestions.map((suggestion, row) => {
        const mustPick = findUnpickedBlank(suggestion.segments, rowValues(row));
        const sentence = assemblePreliminaryRead(suggestion.segments, rowValues(row));
        const shown = shownValues(row);
        const added = !mustPick && value.includes(sentence);

        return (
          <Box key={suggestion.name} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, py: 0.5 }}>
            <Typography variant="body2" sx={{ flex: 1, lineHeight: 1.8 }}>
              {suggestion.segments.map((segment, i) => {
                if (typeof segment === 'string') return segment;
                const ref = { row, segment: i };
                const picked = blankKey(ref) in values;
                const blankValue = shown[i];
                const unpicked = blankValue === undefined;
                const empty = blankValue === '';
                const fieldName = segment.title.replace(/\s*\(.*\)$/, '').toLowerCase();
                return (
                  <Box
                    component="button"
                    type="button"
                    key={i}
                    aria-label={`${segment.title}: ${
                      unpicked ? 'not picked' : blankValue || PRELIMINARY_READ_NONE_LABEL
                    }`}
                    aria-haspopup="listbox"
                    aria-expanded={active?.blank.row === row && active.blank.segment === i}
                    onClick={(e: React.MouseEvent<HTMLElement>) => setActive({ blank: ref, anchor: e.currentTarget })}
                    sx={(theme) => {
                      const tint = picked ? theme.palette.success.main : theme.palette.primary.main;
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
                    {unpicked ? fieldName : empty ? `+ ${fieldName}` : blankValue}
                    {picked && !empty && (
                      <CheckCircle sx={{ fontSize: 12, color: 'success.main', ml: 0.25, verticalAlign: 'middle' }} />
                    )}
                  </Box>
                );
              })}
            </Typography>
            {added ? (
              <CheckCircle
                sx={{ fontSize: 16, color: 'success.main', m: '2px' }}
                titleAccess={`Added to read: ${suggestion.name}`}
              />
            ) : (
              <Tooltip title={mustPick ? `Pick the ${mustPick.title.toLowerCase()} first` : 'Add to read'}>
                <span>
                  <IconButton
                    size="small"
                    aria-label={`Add to read: ${suggestion.name}`}
                    disabled={Boolean(mustPick)}
                    onClick={() => onAdd(sentence)}
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
            const current = option === shownValues(active.blank.row)[active.blank.segment];
            const clash = findConflictingValue(rowValues(active.blank.row), active.blank.segment, option);

            return (
              <MenuItem
                key={option}
                role="option"
                selected={current}
                aria-selected={current}
                disabled={Boolean(clash)}
                sx={{ borderRadius: 1, mx: 1 }}
                onClick={() => pick(option)}
              >
                {option || PRELIMINARY_READ_NONE_LABEL}
                {clash && (
                  <Typography component="span" variant="caption" sx={{ ml: 1 }}>
                    (not with “{clash}”)
                  </Typography>
                )}
              </MenuItem>
            );
          })}
      </Menu>
    </Box>
  );
};
