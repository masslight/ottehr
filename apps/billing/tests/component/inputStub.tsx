import { ReactElement, ReactNode } from 'react';

// A plain labelled input standing in for pickers that need MUI X or live search under jsdom
// (DateInput, PayerSelect, ProviderSelect, ProcedureCodeAutocomplete).
export function InputStub({
  label,
  value,
  onChange,
  helperText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helperText?: ReactNode;
}): ReactElement {
  return (
    <label>
      {label}
      <input aria-label={label} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
      {helperText ? <span>{helperText}</span> : null}
    </label>
  );
}
