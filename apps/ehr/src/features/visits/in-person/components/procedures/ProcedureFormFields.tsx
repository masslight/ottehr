import {
  Autocomplete,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { FC } from 'react';

interface ProcedureDropdownProps {
  label: string;
  options: string[] | undefined;
  value: string | undefined;
  onChange: (value: string) => void;
  disabled: boolean;
  dataTestId: string;
}

export const ProcedureDropdown: FC<ProcedureDropdownProps> = ({
  label,
  options,
  value,
  onChange,
  disabled,
  dataTestId,
}) => {
  const availableOptions = value && !(options ?? []).includes(value) ? [value, ...(options ?? [])] : options ?? [];
  return (
    <FormControl fullWidth sx={{ backgroundColor: 'white' }} size="small" disabled={disabled}>
      <InputLabel id={label}>{label}</InputLabel>
      <Select
        label={label}
        labelId={label}
        variant="outlined"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        data-testid={dataTestId}
      >
        {availableOptions.map((option) => (
          <MenuItem key={option} value={option}>
            <Typography color="textPrimary" sx={{ fontSize: '16px' }}>
              {option}
            </Typography>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

interface ProcedureOtherTextInputProps {
  parentLabel: string;
  visible: boolean;
  value: string | undefined;
  onChange: (value: string) => void;
  disabled: boolean;
}

export const ProcedureOtherTextInput: FC<ProcedureOtherTextInputProps> = ({
  parentLabel,
  visible,
  value,
  onChange,
  disabled,
}) =>
  visible ? (
    <TextField
      label={'Other ' + parentLabel.toLocaleLowerCase()}
      size="small"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  ) : null;

interface ProcedureRadioGroupProps {
  label: string;
  options: string[];
  value: string | undefined;
  onChange: (value: string) => void;
  disabled: boolean;
  dataTestId: string;
}

export const ProcedureRadioGroup: FC<ProcedureRadioGroupProps> = ({
  label,
  options,
  value,
  onChange,
  disabled,
  dataTestId,
}) => (
  <FormControl disabled={disabled}>
    <FormLabel id={label}>{label}</FormLabel>
    <RadioGroup row aria-labelledby={label} onChange={(e) => onChange(e.target.value)} value={value ?? ''}>
      {options.map((option) => (
        <FormControlLabel key={option} value={option} control={<Radio />} label={option} data-testid={dataTestId} />
      ))}
    </RadioGroup>
  </FormControl>
);

interface ProcedureMultiSelectProps {
  label: string;
  options: string[] | undefined;
  values: string[] | undefined;
  onChange: (values: string[]) => void;
  disabled: boolean;
  dataTestId: string;
}

export const ProcedureMultiSelect: FC<ProcedureMultiSelectProps> = ({
  label,
  options,
  values,
  onChange,
  disabled,
  dataTestId,
}) => (
  <Autocomplete
    multiple
    disableCloseOnSelect
    options={(options ?? []).map((opt) => ({ value: opt, label: opt }))}
    value={(values ?? []).map((v) => ({ value: v, label: v }))}
    isOptionEqualToValue={(option, selected) => option.value === selected.value}
    onChange={(_e, newValues) => onChange(newValues.map((v) => v.value))}
    renderOption={(props, option) => (
      <li {...props} key={option.value}>
        {option.label}
      </li>
    )}
    renderInput={(params) => <TextField {...params} label={label} data-testid={dataTestId} />}
    disabled={disabled}
  />
);
