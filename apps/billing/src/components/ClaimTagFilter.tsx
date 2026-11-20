import {
  Autocomplete,
  Box,
  Button,
  Popover,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { KeyboardEvent, MouseEvent, ReactElement, useState } from 'react';
import { ClaimTagMatch } from 'utils/lib/types/data/billing/billing.schemas';


export interface ClaimTagFilterValue {
  include: string[];
  exclude: string[];
  match: ClaimTagMatch;
}

interface ClaimTagFilterProps {
  options: string[];
  value: ClaimTagFilterValue;
  onChange: (value: ClaimTagFilterValue) => void;
  disabled?: boolean;
  minWidth?: number;
}

export function summarizeTagFilter({ include, exclude, match }: ClaimTagFilterValue): string {
  const parts: string[] = [];
  if (include.length) parts.push(include.join(match === 'all' ? ' and ' : ' or '));
  if (exclude.length) parts.push(`not ${exclude.join(', ')}`);
  return parts.join('; ');
}

export function ClaimTagFilter({
  options,
  value,
  onChange,
  disabled,
  minWidth = 160,
}: ClaimTagFilterProps): ReactElement {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const { include, exclude, match } = value;
  const summary = summarizeTagFilter(value);

  // A chosen tag may be missing from the options (e.g. restored before the tags load, or since
  // deleted), so keep it pickable rather than dropping it. A tag can't be both wanted and unwanted.
  const allOptions = [...new Set([...options, ...include, ...exclude])];
  const includeOptions = allOptions.filter((tag) => !exclude.includes(tag));
  const excludeOptions = allOptions.filter((tag) => !include.includes(tag));

  const open = (event: MouseEvent<HTMLElement>): void => {
    if (!disabled) setAnchorEl(event.currentTarget);
  };

  // The field is read-only, so open the pickers from the keyboard the way a select opens.
  const openFromKeyboard = (event: KeyboardEvent<HTMLElement>): void => {
    if (disabled || !['Enter', ' ', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    setAnchorEl(event.currentTarget);
  };

  return (
    <>
      <TextField
        size="small"
        label="Tags"
        value={summary}
        placeholder="All"
        disabled={disabled}
        onClick={open}
        onKeyDown={openFromKeyboard}
        title={summary || undefined}
        InputProps={{ readOnly: true }}
        inputProps={{ 'aria-haspopup': 'dialog', style: { cursor: disabled ? undefined : 'pointer' } }}
        sx={{ minWidth, maxWidth: 300 }}
      />
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{ sx: { p: 2, width: 360 } }}
      >
        <Stack spacing={2}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2">Has tags</Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={match}
                disabled={include.length < 2}
                onChange={(_, next: ClaimTagMatch | null) => {
                  if (next) onChange({ ...value, match: next });
                }}
                aria-label="Match included tags"
              >
                <ToggleButton value="any" sx={{ py: 0.25, px: 1 }}>
                  Any
                </ToggleButton>
                <ToggleButton value="all" sx={{ py: 0.25, px: 1 }}>
                  All
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Autocomplete
              multiple
              disableCloseOnSelect
              size="small"
              options={includeOptions}
              value={include}
              onChange={(_, next) => onChange({ ...value, include: next })}
              renderInput={(params) => <TextField {...params} label="Include" placeholder="Any tags" />}
              ChipProps={{ color: 'primary', variant: 'outlined' }}
            />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Doesn't have tags
            </Typography>
            <Autocomplete
              multiple
              disableCloseOnSelect
              size="small"
              options={excludeOptions}
              value={exclude}
              onChange={(_, next) => onChange({ ...value, exclude: next })}
              renderInput={(params) => <TextField {...params} label="Exclude" placeholder="No tags left out" />}
              ChipProps={{ color: 'error', variant: 'outlined' }}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              disabled={!include.length && !exclude.length}
              onClick={() => onChange({ include: [], exclude: [], match: 'any' })}
            >
              Clear tags
            </Button>
          </Box>
        </Stack>
      </Popover>
    </>
  );
}
