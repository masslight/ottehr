import { Autocomplete, Box, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement, useCallback, useState } from 'react';
import { BillingPayerOption, BillingProviderOption } from 'utils/lib/types/data/billing/billing.types';
import { searchBillingPayers } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { useDebounce } from '../hooks/useDebounce';
import { useProviderOptionsSearch } from '../hooks/useOptionSearch';
import { formatTaxId } from '../utils/format';
import { DateInput } from './DateInput';

export const REMIT_PAYMENT_METHODS = [
  { value: 'eft', label: 'EFT' },
  { value: 'check', label: 'Check' },
  { value: 'virtual-card', label: 'Virtual Card' },
  { value: 'other', label: 'Other' },
] as const;

export interface RemitForm {
  payer: BillingPayerOption | null;
  billingProvider: BillingProviderOption | null;
  checkNumber: string;
  remitDate: string;
  checkDate: string;
  depositDate: string;
  checkAmount: string;
  paymentMethod: string;
  notes: string;
}

// factory so each new form gets a fresh "today"
export const emptyRemitForm = (): RemitForm => {
  const today = DateTime.now().toISODate() ?? '';
  return {
    payer: null,
    billingProvider: null,
    checkNumber: '',
    remitDate: today,
    checkDate: today,
    depositDate: today,
    checkAmount: '',
    paymentMethod: 'eft',
    notes: '',
  };
};

export const isRemitFormComplete = (form: RemitForm): boolean =>
  Boolean(
    form.payer &&
      form.billingProvider &&
      form.checkNumber.trim() &&
      form.remitDate &&
      form.checkDate &&
      form.depositDate &&
      parseFloat(form.checkAmount) >= 0
  );

interface Props {
  form: RemitForm;
  onChange: (form: RemitForm) => void;
  disabled?: boolean;
}

export function RemitFields({ form, onChange, disabled }: Props): ReactElement {
  const { oystehrZambda } = useApiClients();
  const { debounce } = useDebounce();
  const [payerOptions, setPayerOptions] = useState<BillingPayerOption[]>([]);
  const { options: billingProviderOptions, search: searchBillingProviderOptions } = useProviderOptionsSearch('billing');

  const searchPayers = useCallback(
    (query: string): void => {
      if (!oystehrZambda) return;
      debounce(async () => {
        try {
          const res = await searchBillingPayers(oystehrZambda, query ? { name: query } : {});
          setPayerOptions(res.payers ?? []);
        } catch {
          setPayerOptions([]);
        }
      }, 'remit-payer');
    },
    [oystehrZambda, debounce]
  );

  const set = <K extends keyof RemitForm>(key: K, value: RemitForm[K]): void => onChange({ ...form, [key]: value });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Autocomplete
        size="small"
        options={payerOptions}
        getOptionLabel={(o) => o.name}
        onInputChange={(_, value, reason) => {
          if (reason === 'input') searchPayers(value);
        }}
        onOpen={() => searchPayers('')}
        filterOptions={(x) => x}
        value={form.payer}
        onChange={(_, v) => set('payer', v)}
        renderInput={(params) => <TextField {...params} label="Payer *" />}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        disabled={disabled}
      />
      <Autocomplete
        size="small"
        options={billingProviderOptions}
        getOptionLabel={(o) => {
          const ids = [o.taxId ? `Tax ID ${formatTaxId(o.taxId)}` : '', o.npi ? `NPI ${o.npi}` : '']
            .filter(Boolean)
            .join(', ');
          return ids ? `${o.name} (${ids})` : o.name;
        }}
        onInputChange={(_, value, reason) => {
          if (reason === 'input') searchBillingProviderOptions(value);
        }}
        onOpen={() => searchBillingProviderOptions()}
        filterOptions={(x) => x}
        value={form.billingProvider}
        onChange={(_, v) => set('billingProvider', v)}
        renderInput={(params) => <TextField {...params} label="Billing Provider *" />}
        renderOption={(props, option) => (
          <Box component="li" {...props} key={option.id} sx={{ display: 'block !important', py: 0.75 }}>
            <Typography variant="body2" fontWeight={600}>
              {option.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {[option.taxId ? `Tax ID ${formatTaxId(option.taxId)}` : '', option.npi ? `NPI ${option.npi}` : '']
                .filter(Boolean)
                .join(' • ') || 'No Tax ID / NPI on file'}
            </Typography>
          </Box>
        )}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        disabled={disabled}
      />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField
          size="small"
          label="Check Number *"
          value={form.checkNumber}
          onChange={(e) => set('checkNumber', e.target.value)}
          disabled={disabled}
          sx={{ flex: 1.2 }}
        />
        <TextField
          size="small"
          label="Check Amount *"
          type="number"
          value={form.checkAmount}
          onChange={(e) => set('checkAmount', e.target.value)}
          InputProps={{ startAdornment: <Box sx={{ mr: 0.5, color: 'text.secondary' }}>$</Box> }}
          disabled={disabled}
          sx={{
            flex: 1,
            '& input[type=number]': { MozAppearance: 'textfield' },
            '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
              WebkitAppearance: 'none',
              margin: 0,
            },
          }}
        />
        <FormControl size="small" sx={{ flex: 1 }} disabled={disabled}>
          <InputLabel>Payment Method</InputLabel>
          <Select
            value={form.paymentMethod}
            label="Payment Method"
            onChange={(e) => set('paymentMethod', e.target.value)}
          >
            {REMIT_PAYMENT_METHODS.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <DateInput
            label="Remit Date *"
            size="small"
            fullWidth
            value={form.remitDate}
            onChange={(value) => set('remitDate', value)}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <DateInput
            label="Check Date *"
            size="small"
            fullWidth
            value={form.checkDate}
            onChange={(value) => set('checkDate', value)}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <DateInput
            label="Deposit Date *"
            size="small"
            fullWidth
            value={form.depositDate}
            onChange={(value) => set('depositDate', value)}
          />
        </Box>
      </Box>
      <TextField
        size="small"
        label="Notes"
        multiline
        minRows={2}
        value={form.notes}
        onChange={(e) => set('notes', e.target.value)}
        disabled={disabled}
      />
    </Box>
  );
}
