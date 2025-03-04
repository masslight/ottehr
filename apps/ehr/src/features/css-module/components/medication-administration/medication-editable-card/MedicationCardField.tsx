import React from 'react';
import { TextField, Select, MenuItem, FormControl, InputLabel, FormHelperText, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { OrderFieldsSelectsOptions } from '../../../hooks/useGetFieldOptions';
import { MedicationData, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { medicationOrderFieldsWithOptions } from './utils';

interface MedicationCardFieldProps {
  field: keyof MedicationData;
  label: string;
  type?: 'text' | 'number' | 'select' | 'date' | 'time' | 'month';
  value: string | number | undefined;
  onChange: <Field extends keyof MedicationData>(field: Field, value: MedicationData[Field]) => void;
  required?: boolean;
  showError?: boolean;
  isEditable?: boolean;
  selectsOptions: OrderFieldsSelectsOptions;
  renderValue?: string;
}

const StyledTextField = styled(TextField)({
  '& .MuiInputBase-input': {
    height: '1.44em',
  },
});

const StyledFormControl = styled(FormControl)({
  width: '100%',
});

const emptySelectsOptions: OrderFieldsSelectsOptions = {
  medicationId: { options: [], status: 'loading' },
  route: { options: [], status: 'loading' },
  associatedDx: { options: [], status: 'loading' },
  units: { options: [], status: 'loading' },
  location: { options: [], status: 'loading' },
};

export const MedicationCardField: React.FC<MedicationCardFieldProps> = ({
  field,
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  showError = false,
  isEditable = true,
  selectsOptions = emptySelectsOptions,
  renderValue,
}) => {
  const handleChange = (newValue: string | number | undefined): void => {
    onChange(field, newValue);
  };

  const isInstruction = field === 'instructions';

  if (type === 'select' && medicationOrderFieldsWithOptions.includes(field)) {
    const mappedLabel = label === 'medicationId' ? 'Medication' : label;

    const options = selectsOptions[field as keyof OrderFieldsSelectsOptions].options;
    const isOptionsLoaded = selectsOptions[field as keyof OrderFieldsSelectsOptions].status === 'loaded';

    const select = isOptionsLoaded ? (
      <Select
        disabled={!isEditable}
        labelId={`${field}-label`}
        value={value}
        {...(renderValue
          ? {
              renderValue: () => renderValue,
            }
          : {})}
        onChange={(e) => handleChange(e.target.value)}
        label={label}
        required={required}
        error={showError && required && !value}
        autoComplete="off"
      >
        <MenuItem value="">Select {mappedLabel}</MenuItem>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    ) : (
      <Skeleton variant="rectangular" width="100%" height={56} />
    );

    return (
      <StyledFormControl disabled={!isEditable} required={required} error={showError && required && !value}>
        <InputLabel id={`${field}-label`}>{mappedLabel}</InputLabel>
        {select}
        {showError && required && !value && <FormHelperText>This field is required</FormHelperText>}
      </StyledFormControl>
    );
  }

  return (
    <StyledTextField
      disabled={!isEditable}
      autoComplete="off"
      fullWidth
      label={label}
      variant="outlined"
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      type={type}
      {...(type === 'number' ? { inputProps: { min: 0 } } : {})}
      multiline={isInstruction}
      rows={isInstruction ? 3 : undefined}
      InputLabelProps={
        type === 'date' || type === 'time' || type === 'month' || isInstruction ? { shrink: true } : undefined
      }
      required={required}
      error={showError && required && !value}
      helperText={showError && required && !value ? REQUIRED_FIELD_ERROR_MESSAGE : ''}
    />
  );
};

export default MedicationCardField;
