import {
  Autocomplete,
  Box,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Paper,
  PaperProps,
  Select,
  Skeleton,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { DesktopDateTimePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTime } from 'luxon';
import React from 'react';
import { LOCATION_OPTIONS } from 'src/shared/utils/options';
import { sortInventoryLotsForPicking } from 'utils/lib/fhir/medication-inventory';
import {
  INVENTORY_MARKER_LABELS,
  InventoryLot,
  MEDICATION_COUNTED_AS_LABELS,
  MedicationCountedAs,
} from 'utils/lib/types/api/config/in-house-medications';
import { IN_HOUSE_CONTAINED_MEDICATION_ID } from 'utils/lib/types/api/medication-administration.constants';
import { MedicationData } from 'utils/lib/types/api/medication-administration.types';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';
import { dataTestIds } from '../../../../../../constants/data-test-ids';
import { OrderFieldsSelectsOptions } from '../../../hooks/useGetFieldOptions';
import { MedicationFieldType } from './fieldsConfig';
import { InHouseMedicationFieldType, medicationOrderFieldsWithOptions } from './utils';

type MedicationLocation = NonNullable<MedicationData['location']>;

export const POPULAR_SEPARATOR = 'popular-separator';
export const OTHER_SEPARATOR = 'other-separator';

/** Lots of the order's drug on hand at the visit's location (requirement 3); only for drugs set up for inventory. */
export interface InventoryLotSuggestions {
  lots: InventoryLot[];
  locationName?: string;
}

type LotOption = { lot: InventoryLot; expired: boolean };

const LOT_FOOTER_TEXT = "Or type a lot that isn't listed. It's saved as typed and doesn't change stock.";

const LotSuggestionsPaper = ({ children, ...props }: PaperProps): React.ReactElement => (
  <Paper {...props}>
    {children}
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ px: 2, pt: 1, pb: 0.5, borderTop: 1, borderColor: 'divider' }}
      // The footer is informational; without this, pressing it blurs the input and closes the list.
      onMouseDown={(event) => event.preventDefault()}
    >
      {LOT_FOOTER_TEXT}
    </Typography>
  </Paper>
);

const lotOnHandLabel = (lot: InventoryLot): string => {
  const labels = MEDICATION_COUNTED_AS_LABELS[lot.unit as MedicationCountedAs];
  const unit = labels ? (lot.onHand === 1 ? labels.singular.toLowerCase() : labels.plural) : lot.unit;
  return [`${lot.onHand} ${unit}`, lot.manufacturer].filter(Boolean).join(' · ');
};

interface MedicationCardFieldProps {
  field: MedicationFieldType;
  label: string;
  type?: InHouseMedicationFieldType;
  value?: string | number | MedicationLocation;
  onChange: <Field extends keyof MedicationData>(field: Field, value: MedicationData[Field]) => void;
  required?: boolean;
  showError?: boolean;
  isEditable?: boolean;
  selectsOptions: OrderFieldsSelectsOptions;
  renderValue?: string;
  inventoryLots?: InventoryLotSuggestions;
  /** A lot was picked from the suggestions (or typed exactly); fills expiration, NDC and manufacturer too. */
  onInventoryLotPick?: (lot: InventoryLot) => void;
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
  providerId: { options: [], status: 'loading' },
};

export const MedicationCardField: React.FC<MedicationCardFieldProps> = ({
  field,
  label,
  type = 'text',
  value: rawValue,
  onChange,
  required = false,
  showError = false,
  isEditable = true,
  selectsOptions = emptySelectsOptions,
  renderValue,
  inventoryLots,
  onInventoryLotPick,
}) => {
  const theme = useTheme();
  const handleChange = (newValue: string | number | undefined): void => {
    onChange(field, newValue);
  };

  const isInstruction = field === 'instructions';

  if (field === 'lotNumber' && inventoryLots && inventoryLots.lots.length > 0 && onInventoryLotPick) {
    const { lots, locationName } = inventoryLots;
    const options = sortInventoryLotsForPicking(lots, DateTime.now().toISODate());
    const text = typeof rawValue === 'string' ? rawValue : '';
    const findLot = (lotNumber: string): InventoryLot | undefined =>
      lots.find((lot) => lot.lotNumber === lotNumber.trim());
    const hasError = showError && required && !text;
    return (
      <StyledFormControl data-testid={dataTestIds.orderMedicationPage.inputField(field)} disabled={!isEditable}>
        <Autocomplete<LotOption, false, false, true>
          freeSolo
          openOnFocus
          disabled={!isEditable}
          options={options}
          value={null}
          inputValue={text}
          getOptionLabel={(option) => (typeof option === 'string' ? option : option.lot.lotNumber)}
          getOptionKey={(option) => (typeof option === 'string' ? option : option.lot.id)}
          // Show every lot until the typed text narrows it; a typed listed lot keeps the whole list visible.
          filterOptions={(all, { inputValue }) => {
            const search = inputValue.trim().toLowerCase();
            if (!search || findLot(inputValue)) return all;
            return all.filter((option) => option.lot.lotNumber.toLowerCase().includes(search));
          }}
          groupBy={() => (locationName ? `On hand at ${locationName}` : 'On hand')}
          PaperComponent={LotSuggestionsPaper}
          onChange={(_e, option) => {
            if (option && typeof option !== 'string') onInventoryLotPick(option.lot);
          }}
          onInputChange={(_e, newText, reason) => {
            if (reason !== 'input') return;
            const typedLot = findLot(newText);
            if (typedLot) onInventoryLotPick(typedLot);
            else handleChange(newText);
          }}
          renderOption={(props, { lot, expired }) => (
            <li {...props} key={lot.id}>
              <Box
                sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, width: '100%' }}
                color={expired ? 'text.secondary' : undefined}
              >
                <span>
                  <Typography component="span" fontWeight={500}>
                    {lot.lotNumber}
                  </Typography>
                  {' · exp '}
                  {formatDateForDisplay(lot.expirationDate) || '—'}
                  {expired && (
                    <Chip
                      label={INVENTORY_MARKER_LABELS.expired}
                      size="small"
                      color="error"
                      variant="outlined"
                      sx={{ ml: 1 }}
                    />
                  )}
                </span>
                <Typography component="span" color="text.secondary">
                  {lotOnHandLabel(lot)}
                </Typography>
              </Box>
            </li>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              required={required}
              error={hasError}
              helperText={hasError ? REQUIRED_FIELD_ERROR_MESSAGE : ''}
            />
          )}
        />
      </StyledFormControl>
    );
  }

  if (field === 'location') {
    // getMedicationFieldValue coerces unset fields to '' — treat anything non-object as no selection.
    const currentValue = rawValue && typeof rawValue === 'object' ? rawValue : null;
    return (
      <StyledFormControl data-testid={dataTestIds.orderMedicationPage.inputField(field)} disabled={!isEditable}>
        <Autocomplete
          disabled={!isEditable}
          options={LOCATION_OPTIONS}
          value={currentValue}
          getOptionLabel={(option) => option.name}
          getOptionKey={(option) => `${option.code}|${option.name}`}
          isOptionEqualToValue={(option, val) => option.code === val.code && option.name === val.name}
          onChange={(_e, opt) => onChange(field, opt ? { code: opt.code, name: opt.name } : undefined)}
          renderInput={(params) => <TextField {...params} label={label} placeholder={`Search ${label}`} />}
        />
      </StyledFormControl>
    );
  }

  // After the location branch, value is scalar.
  const value = rawValue as string | number | undefined;

  if (field === 'effectiveDateTime') {
    const dateTimeValue = value ? DateTime.fromISO(value as string) : null;

    return (
      <LocalizationProvider dateAdapter={AdapterLuxon}>
        <DesktopDateTimePicker
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
          format="MM/dd/yyyy hh:mm a"
        />
      </LocalizationProvider>
    );
  }

  if (field === 'expDate') {
    const dateTimeValue = value ? DateTime.fromISO(value as string) : null;

    return (
      <LocalizationProvider dateAdapter={AdapterLuxon}>
        <DatePicker
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
              inputProps: {
                'data-testid': dataTestIds.orderMedicationPage.inputField(field),
              },
            },
          }}
          format="MM/dd/yyyy"
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
