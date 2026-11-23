import { Autocomplete, Box, Button, Popover, Stack, TextField, Typography } from '@mui/material';
import { KeyboardEvent, MouseEvent, ReactElement, useEffect, useRef, useState } from 'react';
import { CMS_PLACE_OF_SERVICE_CODES } from 'utils/lib/helpers/rcm/constants';
import { BillingCodeOption } from 'utils/lib/types/data/billing/billing.types';
import { searchBillingProcedureCodes } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';

export interface ClaimServiceLineFilterValue {
  cptCode: string[];
  modifier: string[];
  placeOfService: string[];
}

export const EMPTY_SERVICE_LINE_FILTER: ClaimServiceLineFilterValue = { cptCode: [], modifier: [], placeOfService: [] };

interface ClaimServiceLineFilterProps {
  value: ClaimServiceLineFilterValue;
  onChange: (value: ClaimServiceLineFilterValue) => void;
  disabled?: boolean;
  minWidth?: number;
}

export function hasServiceLineFilterValue({ cptCode, modifier, placeOfService }: ClaimServiceLineFilterValue): boolean {
  return Boolean(cptCode.length || modifier.length || placeOfService.length);
}

export function summarizeServiceLineFilter({ cptCode, modifier, placeOfService }: ClaimServiceLineFilterValue): string {
  const parts: string[] = [];
  if (cptCode.length) parts.push(`CPT ${cptCode.join(', ')}`);
  if (modifier.length) parts.push(`Mod ${modifier.join(', ')}`);
  if (placeOfService.length) parts.push(`POS ${placeOfService.join(', ')}`);
  return parts.join('; ');
}

// Codes are matched case-insensitively, so keep the typed ones in the case claims carry them in,
// once each.
const normalizeCodes = (codes: string[]): string[] => [
  ...new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean)),
];

const POS_DISPLAY = new Map(CMS_PLACE_OF_SERVICE_CODES.map((pos) => [pos.code, pos.display]));

export function ClaimServiceLineFilter({
  value,
  onChange,
  disabled,
  minWidth = 180,
}: ClaimServiceLineFilterProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [cptOptions, setCptOptions] = useState<BillingCodeOption[]>([]);
  const cptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summary = summarizeServiceLineFilter(value);

  useEffect(
    () => (): void => {
      if (cptTimer.current) clearTimeout(cptTimer.current);
    },
    []
  );

  const searchCpt = (query: string): void => {
    if (cptTimer.current) clearTimeout(cptTimer.current);
    if (!oystehrZambda || query.trim().length < 2) {
      setCptOptions([]);
      return;
    }
    cptTimer.current = setTimeout(async () => {
      try {
        const res = await searchBillingProcedureCodes(oystehrZambda, { query: query.trim() });
        setCptOptions(res.codes ?? []);
      } catch {
        setCptOptions([]);
      }
    }, 300);
  };

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
        label="Service Lines"
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
        PaperProps={{ sx: { p: 2, width: 380 } }}
      >
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Shows claims with a service line that matches every field filled in below. Within a field, any one of its
            codes matches.
          </Typography>
          <Autocomplete<string | BillingCodeOption, true, false, true>
            multiple
            freeSolo
            disableCloseOnSelect
            size="small"
            options={cptOptions}
            filterOptions={(x) => x}
            value={value.cptCode}
            getOptionLabel={(o) => (typeof o === 'string' ? o : o.code)}
            renderOption={(props, o) =>
              typeof o === 'string' ? null : (
                <li {...props} key={o.code}>
                  {o.code} — {o.display}
                </li>
              )
            }
            isOptionEqualToValue={(o, v) =>
              (typeof o === 'string' ? o : o.code) === (typeof v === 'string' ? v : v.code)
            }
            onInputChange={(_, query, reason) => {
              if (reason === 'input') searchCpt(query);
            }}
            onChange={(_, next) =>
              onChange({ ...value, cptCode: normalizeCodes(next.map((o) => (typeof o === 'string' ? o : o.code))) })
            }
            renderInput={(params) => (
              <TextField {...params} label="CPT / HCPCS codes" placeholder="Search or type a code" />
            )}
            ChipProps={{ variant: 'outlined' }}
          />
          <Autocomplete<string, true, false, true>
            multiple
            freeSolo
            disableCloseOnSelect
            size="small"
            options={[]}
            value={value.modifier}
            onChange={(_, next) => onChange({ ...value, modifier: normalizeCodes(next) })}
            renderInput={(params) => (
              <TextField {...params} label="Modifiers" placeholder="Type a modifier and press Enter" />
            )}
            ChipProps={{ variant: 'outlined' }}
          />
          <Autocomplete<string, true>
            multiple
            disableCloseOnSelect
            size="small"
            options={CMS_PLACE_OF_SERVICE_CODES.map((pos) => pos.code)}
            value={value.placeOfService}
            getOptionLabel={(code) => code}
            renderOption={(props, code) => (
              <li {...props} key={code}>
                {code} - {POS_DISPLAY.get(code) ?? ''}
              </li>
            )}
            filterOptions={(codes, { inputValue }) => {
              const query = inputValue.trim().toLowerCase();
              if (!query) return codes;
              return codes.filter(
                (code) => code.includes(query) || (POS_DISPLAY.get(code) ?? '').toLowerCase().includes(query)
              );
            }}
            onChange={(_, next) => onChange({ ...value, placeOfService: next })}
            renderInput={(params) => <TextField {...params} label="Places of service" placeholder="Any" />}
            ChipProps={{ variant: 'outlined' }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              disabled={!hasServiceLineFilterValue(value)}
              onClick={() => onChange(EMPTY_SERVICE_LINE_FILTER)}
            >
              Clear service lines
            </Button>
          </Box>
        </Stack>
      </Popover>
    </>
  );
}
