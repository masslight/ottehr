import { Autocomplete, AutocompleteRenderInputParams, TextField } from '@mui/material';
import { ReactElement, ReactNode, Ref, useEffect, useState } from 'react';
import { BillingService } from 'utils/lib/types/data/billing/billing.types';
import { formatAntCaseString, parseAntCaseString } from 'utils/lib/types/data/billing/claim-status';
import { searchBillingServices } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';
import { valueToText } from '../utils/format';

// Service picker for the rules builder. It offers every service seen on a claim so far (the registry
// behind the claims list's Service filter) by the name the claim screens show ("Workers Comp", not
// its workers-comp code), and stores that name: the engine compares services by name, ignoring case
// and hyphens, so a name and its code are the same service. Free text is allowed so a rule can name a
// service no claim has used yet. The registry is small and loads once, filtered client-side (the
// TagSelect precedent).

interface ServiceSelectProps {
  multiple: boolean;
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
  required?: boolean;
  // Validation display + react-hook-form focus ref, for use inside Controller-registered forms.
  error?: boolean;
  helperText?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}

// The registry's codes as display names, one per service.
const serviceNames = (services: BillingService[]): string[] => {
  const seen = new Set<string>();
  return services
    .map((service) => formatAntCaseString(service.name))
    .filter((name) => {
      const key = parseAntCaseString(name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

// A name that spells a listed service differently ("workers comp", or the code workers-comp) becomes
// that service's displayed name; anything else is kept as typed.
const canonicalName = (text: string, names: string[]): string => {
  const key = parseAntCaseString(text);
  return names.find((name) => parseAntCaseString(name) === key) ?? text.trim();
};

export function ServiceSelect({
  multiple,
  value,
  onChange,
  label,
  required,
  error,
  helperText,
  inputRef,
}: ServiceSelectProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [names, setNames] = useState<string[]>([]);
  // Multiple only: text typed but not yet added as a chip.
  const [pending, setPending] = useState('');

  useEffect(() => {
    if (!oystehrZambda) return;
    let active = true;
    searchBillingServices(oystehrZambda, {})
      .then((res) => {
        if (active) setNames(serviceNames(res.services ?? []));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [oystehrZambda]);

  const renderInput = (params: AutocompleteRenderInputParams): ReactElement => (
    <TextField
      {...params}
      label={label ?? (multiple ? 'Services' : 'Service')}
      placeholder={multiple ? 'Pick or type services…' : 'Pick or type a service…'}
      required={required}
      error={error}
      helperText={helperText}
      inputRef={inputRef}
    />
  );

  if (multiple) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    // Picked and typed names, in their displayed spelling, without repeats.
    const commit = (next: string[]): void => {
      const keys = new Set<string>();
      onChange(
        next
          .map((name) => canonicalName(name, names))
          .filter((name) => {
            const key = parseAntCaseString(name);
            if (!key || keys.has(key)) return false;
            keys.add(key);
            return true;
          })
      );
    };
    return (
      <Autocomplete<string, true, false, true>
        multiple
        freeSolo
        size="small"
        options={names}
        value={values}
        inputValue={pending}
        onInputChange={(_, text) => setPending(text)}
        onChange={(_, next) => commit(next)}
        // A name typed but not yet entered is added on blur rather than silently dropped.
        onBlur={() => {
          if (!pending.trim()) return;
          commit([...values, pending]);
          setPending('');
        }}
        renderInput={renderInput}
        sx={{ minWidth: 260 }}
      />
    );
  }

  // The typed text is the value (the ProcedureCodeAutocomplete precedent). It also drives the
  // selected option whenever it names a listed service, so reopening the list offers every service
  // rather than only the one already picked.
  const text = valueToText(value);
  return (
    <Autocomplete<string, false, false, true>
      freeSolo
      size="small"
      options={names}
      value={names.includes(text) ? text : null}
      inputValue={text}
      onInputChange={(_, next, reason) => {
        if (reason !== 'reset') onChange(next); // an option pick arrives through onChange
      }}
      onChange={(_, next) => onChange(next ?? '')}
      onBlur={() => {
        const canonical = canonicalName(text, names);
        if (canonical !== text) onChange(canonical);
      }}
      renderInput={renderInput}
      sx={{ minWidth: 240 }}
    />
  );
}
