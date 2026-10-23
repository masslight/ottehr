import { Autocomplete, AutocompleteRenderInputParams, TextField } from '@mui/material';
import { ReactElement, ReactNode, Ref, useMemo, useState } from 'react';
import { useBillingServices } from '../hooks/useBillingServices';
import { valueToText } from '../utils/format';

// Service picker for the rules builder. It offers every service seen on a claim so far (the same list
// and names as the claims list's Service filter) by the name the claim screens show ("Workers Comp"),
// and stores that name — rules compare services by the name shown, exactly. A condition can also name
// a service no claim has used yet.

interface ServiceSelectProps {
  multiple: boolean;
  value: string | string[] | null | undefined;
  onChange: (value: string | string[]) => void;
  label?: string;
  // Single picker only: whether a name outside the list can be entered. A set action turns the name
  // into the code the claim stores, which is only known for listed services.
  allowNew?: boolean;
  required?: boolean;
  // Validation display + react-hook-form focus ref, for use inside Controller-registered forms.
  error?: boolean;
  helperText?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
}

export function ServiceSelect({
  multiple,
  value,
  onChange,
  label,
  allowNew = true,
  required,
  error,
  helperText,
  inputRef,
}: ServiceSelectProps): ReactElement {
  const services = useBillingServices();
  const names = useMemo(() => [...new Set(services.map((service) => service.name))], [services]);
  // Multiple only: text typed but not yet added as a chip.
  const [pending, setPending] = useState('');

  const renderInput = (params: AutocompleteRenderInputParams): ReactElement => (
    <TextField
      {...params}
      label={label ?? (multiple ? 'Services' : 'Service')}
      placeholder={multiple ? 'Pick or type services…' : allowNew ? 'Pick or type a service…' : 'Pick a service…'}
      required={required}
      error={error}
      helperText={helperText}
      inputRef={inputRef}
    />
  );

  if (multiple) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    // Picked and typed names, trimmed, without repeats.
    const commit = (next: string[]): void => onChange([...new Set(next.map((name) => name.trim()).filter(Boolean))]);
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

  const text = valueToText(value);

  if (!allowNew) {
    // A stored name that is no longer listed stays visible, so the rule renders as saved; saving
    // rejects it.
    const options = text && !names.includes(text) ? [...names, text] : names;
    return (
      <Autocomplete<string, false, false, false>
        size="small"
        options={options}
        value={text || null}
        onChange={(_, next) => onChange(next ?? '')}
        renderInput={renderInput}
        sx={{ minWidth: 240 }}
      />
    );
  }

  // The typed text is the value (the ProcedureCodeAutocomplete precedent). It also drives the
  // selected option whenever it names a listed service, so reopening the list offers every service
  // rather than only the one already picked.
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
      renderInput={renderInput}
      sx={{ minWidth: 240 }}
    />
  );
}
