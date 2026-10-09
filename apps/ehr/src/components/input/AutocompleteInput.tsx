import { Autocomplete, Box, Checkbox, createFilterOptions, FormHelperText, Skeleton, TextField } from '@mui/material';
import React, { useRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils/lib/validation/constants';

// Sentinel option prepended to the list when `withSelectAll` is set; it never ends up in the field value.
const SELECT_ALL_OPTION = { selectAll: true } as const;
const SELECT_ALL_LABEL = 'Select all';
const isSelectAllOption = (option: unknown): option is typeof SELECT_ALL_OPTION => option === SELECT_ALL_OPTION;
const defaultFilterOptions = createFilterOptions<any>();

export type AutocompleteInputProps<Value> = {
  name: string;
  label: string;
  options: Value[] | undefined;
  loading?: boolean;
  required?: boolean;
  disabled?: boolean;
  validate?: (value: string | undefined) => boolean | string;
  selectOnly?: boolean;
  freeSolo?: boolean;
  onInputTextChanged?: (text: string) => void;
  noOptionsText?: string;
  getOptionKey?: (option: Value) => string;
  getOptionLabel?: (option: Value) => string;
  isOptionEqualToValue?: (option: Value, value: Value) => boolean;
  dataTestId?: string;
  multiple?: boolean;
  // Only with `multiple`: renders a checkbox per option plus a "Select all" row that toggles every option
  // matching the current search text.
  withSelectAll?: boolean;
  // Only with `multiple`: while the input is not focused, shows at most this many chips plus "+n" text.
  limitTags?: number;
  size?: 'small' | 'medium';
};

export function AutocompleteInput<Value>({
  name,
  label,
  options,
  loading,
  required,
  disabled,
  validate,
  selectOnly,
  freeSolo,
  onInputTextChanged,
  noOptionsText,
  getOptionKey,
  getOptionLabel,
  isOptionEqualToValue,
  dataTestId,
  multiple,
  withSelectAll,
  limitTags,
  size,
}: AutocompleteInputProps<Value>): React.JSX.Element {
  const { control } = useFormContext();
  // Options left after filtering by the search text — what "Select all" applies to.
  const visibleOptionsRef = useRef<Value[]>([]);
  const selectAllEnabled = Boolean(withSelectAll && multiple);
  if (loading && !options) {
    return <Skeleton variant="rectangular" width="100%" height={size === 'medium' ? 56 : 40} />;
  }
  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: required ? REQUIRED_FIELD_ERROR_MESSAGE : false, validate: validate }}
      render={({ field, fieldState: { error } }) => {
        let optionsToUse = [...(options ?? [])];

        // freeSolo updates field.value on each keystroke, and it doesn't need the typed value to be added to options
        if (
          !freeSolo &&
          field.value &&
          !options?.find((option) =>
            isOptionEqualToValue ? isOptionEqualToValue(option, field.value) : option === field.value
          ) &&
          !multiple
        ) {
          optionsToUse = [...optionsToUse, field.value];
        }

        const isEqual = (option: Value, value: Value): boolean =>
          isOptionEqualToValue ? isOptionEqualToValue(option, value) : option === value;
        const selectedValues: Value[] = multiple && Array.isArray(field.value) ? field.value : [];
        const isSelected = (option: Value): boolean => selectedValues.some((value) => isEqual(option, value));

        const selectAllProps = selectAllEnabled
          ? {
              disableCloseOnSelect: true,
              filterOptions: (opts: Value[], state: any) => {
                const filtered = defaultFilterOptions(opts, state) as Value[];
                visibleOptionsRef.current = filtered;
                // The sentinel is not a Value; every callback below handles it before treating an option as one.
                return filtered.length > 0 ? [SELECT_ALL_OPTION as Value, ...filtered] : [];
              },
              getOptionKey: (option: any) =>
                isSelectAllOption(option) ? SELECT_ALL_LABEL : getOptionKey ? getOptionKey(option) : String(option),
              getOptionLabel: (option: any) =>
                isSelectAllOption(option) ? SELECT_ALL_LABEL : getOptionLabel ? getOptionLabel(option) : String(option),
              isOptionEqualToValue: (option: any, value: any) => !isSelectAllOption(option) && isEqual(option, value),
              renderOption: (props: any, option: any, { selected }: { selected: boolean }) => {
                const { key, ...optionProps } = props;
                if (isSelectAllOption(option)) {
                  const visible = visibleOptionsRef.current;
                  const selectedCount = visible.filter(isSelected).length;
                  return (
                    <li key={key} {...optionProps}>
                      <Checkbox
                        size="small"
                        sx={{ mr: 1 }}
                        checked={visible.length > 0 && selectedCount === visible.length}
                        indeterminate={selectedCount > 0 && selectedCount < visible.length}
                      />
                      {SELECT_ALL_LABEL}
                    </li>
                  );
                }
                return (
                  <li key={key} {...optionProps}>
                    <Checkbox size="small" sx={{ ml: 3, mr: 1 }} checked={selected} />
                    {getOptionLabel ? getOptionLabel(option) : String(option)}
                  </li>
                );
              },
            }
          : {};

        const handleChange = (_e: unknown, option: any, _reason: unknown, details?: { option: unknown }): void => {
          if (selectAllEnabled && isSelectAllOption(details?.option)) {
            const visible = visibleOptionsRef.current;
            const allVisibleSelected = visible.every(isSelected);
            field.onChange(
              allVisibleSelected
                ? selectedValues.filter((value) => !visible.some((option) => isEqual(option, value)))
                : [...selectedValues, ...visible.filter((option) => !isSelected(option))]
            );
            return;
          }
          field.onChange(option ?? null);
        };
        return (
          <Box sx={{ width: '100%' }}>
            <Autocomplete<Value, boolean | undefined, false, boolean>
              value={field.value ?? (multiple ? [] : null)}
              options={optionsToUse}
              // MUI types getOptionKey/getOptionLabel as (option: Value | string) => ... when FreeSolo
              // is boolean rather than false, but our props already enforce the correct type for callers.
              // The as any casts are safe here
              getOptionKey={getOptionKey as any}
              noOptionsText={noOptionsText}
              getOptionLabel={getOptionLabel as any}
              isOptionEqualToValue={isOptionEqualToValue as any}
              freeSolo={freeSolo}
              onChange={handleChange}
              {...(freeSolo
                ? {
                    onInputChange: (_e: any, newValue: string, reason: string) => {
                      if (reason === 'input') {
                        field.onChange(newValue.trim() || null);
                      }
                    },
                  }
                : {})}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={label + (required ? '*' : '')}
                  placeholder={!multiple ? label : undefined}
                  inputProps={{ ...params.inputProps, readOnly: selectOnly }}
                  error={error != null}
                  size={size ?? 'small'}
                  onChange={onInputTextChanged ? (e) => onInputTextChanged(e.target.value) : undefined}
                  data-testid={dataTestId}
                />
              )}
              loading={loading}
              disabled={disabled}
              multiple={multiple}
              limitTags={limitTags}
              fullWidth
              {...selectAllProps}
            />
            {error && <FormHelperText error={true}>{error?.message}</FormHelperText>}
          </Box>
        );
      }}
    />
  );
}
