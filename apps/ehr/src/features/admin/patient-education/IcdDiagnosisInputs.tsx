import { Autocomplete, Chip, TextField } from '@mui/material';
import { FC } from 'react';
import { Icd10Option, useIcd10SearchInput } from './useIcd10SearchInput';

type PrimaryDiagnosisInputProps = {
  value: Icd10Option | null;
  onChange: (next: Icd10Option | null) => void;
  required?: boolean;
  errorMessage?: string;
};

export const PrimaryDiagnosisInput: FC<PrimaryDiagnosisInputProps> = ({ value, onChange, required, errorMessage }) => {
  const { inputValue, setInputValue, options, isFetching } = useIcd10SearchInput();
  return (
    <Autocomplete<Icd10Option, false>
      options={options}
      loading={isFetching}
      filterOptions={(x) => x}
      value={value}
      onChange={(_e, next) => onChange(next)}
      isOptionEqualToValue={(a, b) => a.code === b.code}
      getOptionLabel={(o) => `${o.code} — ${o.display}`}
      inputValue={inputValue}
      onInputChange={(_e, next) => setInputValue(next)}
      renderInput={(params) => (
        <TextField
          {...params}
          required={required}
          size="small"
          label="Diagnosis"
          placeholder="Start typing to search"
          error={!!errorMessage}
          helperText={errorMessage}
        />
      )}
    />
  );
};

type AlternateDiagnosesInputProps = {
  value: Icd10Option[];
  onChange: (next: Icd10Option[]) => void;
  primary: Icd10Option | null;
};

export const AlternateDiagnosesInput: FC<AlternateDiagnosesInputProps> = ({ value, onChange, primary }) => {
  const { inputValue, setInputValue, options, isFetching } = useIcd10SearchInput();
  // Hide options the caller has already chosen (as primary or as another alternate).
  const filteredOptions = options.filter((o) => o.code !== primary?.code && !value.some((a) => a.code === o.code));
  return (
    <Autocomplete<Icd10Option, true>
      multiple
      options={filteredOptions}
      loading={isFetching}
      filterOptions={(x) => x}
      value={value}
      onChange={(_e, next) => onChange(next)}
      isOptionEqualToValue={(a, b) => a.code === b.code}
      getOptionLabel={(o) => `${o.code} — ${o.display}`}
      inputValue={inputValue}
      onInputChange={(_e, next) => setInputValue(next)}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => {
          const { key: _key, ...tagProps } = getTagProps({ index });
          return <Chip key={option.code} label={`${option.code} — ${option.display}`} {...tagProps} />;
        })
      }
      renderInput={(params) => (
        <TextField {...params} size="small" label="Alternative ICD-10 codes" placeholder="Start typing to search" />
      )}
    />
  );
};
