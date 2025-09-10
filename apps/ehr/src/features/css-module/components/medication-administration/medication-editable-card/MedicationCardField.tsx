import {
  Autocomplete,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  TextField,
  useTheme,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTime } from 'luxon';
import React from 'react';
import { IN_HOUSE_CONTAINED_MEDICATION_ID, MedicationData, REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { OrderFieldsSelectsOptions } from '../../../hooks/useGetFieldOptions';
import { MedicationFieldType } from './fieldsConfig';
import { InHouseMedicationFieldType, medicationOrderFieldsWithOptions } from './utils';

const POPULAR_SEPARATOR = 'popular-separator';
const OTHER_SEPARATOR = 'other-separator';

interface MedicationCardFieldProps {
  field: MedicationFieldType;
  label: string;
  type?: InHouseMedicationFieldType;
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
  providerId: { options: [], status: 'loading' },
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
  const theme = useTheme();
  const handleChange = (newValue: string | number | undefined): void => {
    onChange(field, newValue);
  };

  const isInstruction = field === 'instructions';

  if (field === 'effectiveDateTime') {
    const dateTimeValue = value ? DateTime.fromISO(value as string) : null;

    return (
      <LocalizationProvider dateAdapter={AdapterLuxon}>
        <DateTimePicker
          data-testid={dataTestIds.orderMedicationPage.inputField(field)}
          label={label}
          value={dateTimeValue}
          onChange={(newValue) => {
            if (!newValue) return;
            const isoString = newValue.toISO();
            if (isoString) {
              handleChange(isoString);
            }
          }}
          disabled={!isEditable}
          slotProps={{
            textField: {
              fullWidth: true,
              variant: 'outlined',
              required: required,
              error: showError && required && !value,
              helperText: showError && required && !value ? REQUIRED_FIELD_ERROR_MESSAGE : '',
            },
          }}
          format="yyyy-MM-dd HH:mm a"
        />
      </LocalizationProvider>
    );
  }

  if (field === 'expDate') {
    const dateTimeValue = value ? DateTime.fromISO(value as string) : null;

    return (
      <LocalizationProvider dateAdapter={AdapterLuxon}>
        <DatePicker
          data-testid={dataTestIds.orderMedicationPage.inputField(field)}
          label={label}
          value={dateTimeValue}
          onChange={(newValue) => {
            if (!newValue) return;
            const isoString = newValue.toISO();
            if (isoString) {
              handleChange(isoString);
            }
          }}
          disabled={!isEditable}
          slotProps={{
            textField: {
              fullWidth: true,
              variant: 'outlined',
              required: required,
              error: showError && required && !value,
              helperText: showError && required && !value ? REQUIRED_FIELD_ERROR_MESSAGE : '',
            },
          }}
          format="yyyy-MM-dd"
        />
      </LocalizationProvider>
    );
  }

  if (type === 'autocomplete') {
    const options = selectsOptions[field as keyof OrderFieldsSelectsOptions].options;
    const foundOption = options.find((option) => option.value === value);
    const isOptionsLoaded = selectsOptions[field as keyof OrderFieldsSelectsOptions].status === 'loaded';
    const currentValue = renderValue
      ? { value: IN_HOUSE_CONTAINED_MEDICATION_ID, label: renderValue }
      : foundOption || null;

    const autocomplete = isOptionsLoaded ? (
      <Autocomplete
        disabled={!isOptionsLoaded || !isEditable}
        options={options}
        isOptionEqualToValue={(option, value) =>
          option.value === value.value || value.value === IN_HOUSE_CONTAINED_MEDICATION_ID
        }
        value={currentValue}
        getOptionLabel={(option) => option.label}
        onChange={(_e, val) => {
          // Prevent selecting separators
          if (val?.value === POPULAR_SEPARATOR || val?.value === OTHER_SEPARATOR) {
            return;
          }
          // Handle clearing the field - set to empty string when val is null
          handleChange(val?.value ?? '');
        }}
        getOptionDisabled={(option) => option.value === POPULAR_SEPARATOR || option.value === OTHER_SEPARATOR} // Disable separators
        renderOption={(props, option) => {
          // Handle separators for grouped options
          if (option.value === POPULAR_SEPARATOR || option.value === OTHER_SEPARATOR) {
            return (
              <li
                {...props}
                key={option.value}
                style={{
                  opacity: 0.8,
                  color: theme.palette.text.secondary,
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  textAlign: 'left', // Left-aligned section headers
                  pointerEvents: 'none',
                  cursor: 'default',
                  paddingLeft: '16px',
                }}
              >
                {option.label}
              </li>
            );
          }

          return (
            <li {...props} key={option.value} style={{ paddingLeft: '32px' }}>
              {' '}
              {/* Indent selectable items */}
              {option.label}
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={`Search ${label}`}
            error={showError && required && !value}
          />
        )}
      />
    ) : (
      <Skeleton variant="rectangular" width="100%" height={56} />
    );

    return (
      <StyledFormControl
        data-testid={dataTestIds.orderMedicationPage.inputField(field)}
        disabled={!isEditable}
        required={required}
        error={showError && required && !value}
      >
        {autocomplete}
        {showError && required && !value && <FormHelperText>This field is required</FormHelperText>}
      </StyledFormControl>
    );
  }

  if (type === 'select' && medicationOrderFieldsWithOptions.includes(field)) {
    const options = selectsOptions[field as keyof OrderFieldsSelectsOptions].options;
    const isOptionsLoaded = selectsOptions[field as keyof OrderFieldsSelectsOptions].status === 'loaded';

    const select = isOptionsLoaded ? (
      <Select
        disabled={!isEditable}
        labelId={`${field}-label`}
        value={value ?? ''}
        {...(renderValue
          ? {
              renderValue: () => renderValue,
            }
          : {})}
        onChange={(e) => {
          // Prevent selecting separators
          if (e.target.value === POPULAR_SEPARATOR || e.target.value === OTHER_SEPARATOR) {
            return;
          }
          handleChange(e.target.value);
        }}
        label={label}
        required={required}
        error={showError && required && !value}
        autoComplete="off"
      >
        <MenuItem data-testid={dataTestIds.orderMedicationPage.inputField(field)} value="">
          Select {label}
        </MenuItem>
        {options.map((option) => {
          // Handle separators for grouped options
          if (option.value === POPULAR_SEPARATOR || option.value === OTHER_SEPARATOR) {
            return (
              <MenuItem
                key={option.value}
                value={option.value}
                disabled
                sx={{
                  '&.Mui-disabled': {
                    opacity: 0.8,
                    color: 'text.secondary',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    textAlign: 'left', // Left-aligned section headers
                    pointerEvents: 'none',
                    paddingLeft: '16px',
                  },
                }}
              >
                {option.label}
              </MenuItem>
            );
          }

          return (
            <MenuItem
              key={option.value}
              value={option.value}
              sx={{ paddingLeft: '32px' }} // Indent selectable items
            >
              {option.label}
            </MenuItem>
          );
        })}
      </Select>
    ) : (
      <Skeleton variant="rectangular" width="100%" height={56} />
    );

    return (
      <StyledFormControl
        data-testid={dataTestIds.orderMedicationPage.inputField(field)}
        disabled={!isEditable}
        required={required}
        error={showError && required && !value}
      >
        <InputLabel id={`${field}-label`}>{label}</InputLabel>
        {select}
        {showError && required && !value && <FormHelperText>This field is required</FormHelperText>}
      </StyledFormControl>
    );
  }

  return (
    <StyledTextField
      data-testid={dataTestIds.orderMedicationPage.inputField(field)}
      disabled={!isEditable}
      autoComplete="off"
      fullWidth
      label={label}
      variant="outlined"
      value={value ?? ''}
      onChange={(e) => handleChange(e.target.value)}
      type={type}
      {...(type === 'number' ? { inputProps: { min: 0 } } : {})}
      multiline={isInstruction}
      rows={isInstruction ? 3 : undefined}
      InputLabelProps={type === 'datetime' || isInstruction ? { shrink: true } : undefined}
      required={required}
      error={showError && required && !value}
      helperText={showError && required && !value ? REQUIRED_FIELD_ERROR_MESSAGE : ''}
      // https://github.com/mui/material-ui/issues/7960#issuecomment-1858083123
      {...(type === 'number'
        ? { onFocus: (e) => e.target.addEventListener('wheel', (e) => e.preventDefault(), { passive: false }) }
        : {})}
    />
  );
};

export default MedicationCardField;
