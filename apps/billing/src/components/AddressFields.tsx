import { Box, FormControl, FormHelperText, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { InputMask } from 'ui-components';
import { AllStates, isPostalCodeValid, REQUIRED_FIELD_ERROR_MESSAGE, stateCodeToFullName } from 'utils';

export function AddressFields({ requireFullZip }: { requireFullZip?: boolean }): ReactElement {
  const { control } = useFormContext();
  return (
    <>
      <Controller
        name="line1"
        control={control}
        rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
        render={({ field, fieldState: { error: fieldError } }) => (
          <TextField
            label="Address 1 *"
            size="small"
            fullWidth
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            error={!!fieldError}
            helperText={fieldError?.message}
          />
        )}
      />
      <Controller
        name="line2"
        control={control}
        render={({ field, fieldState: { error: fieldError } }) => (
          <TextField
            label="Address 2"
            size="small"
            fullWidth
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            error={!!fieldError}
            helperText={fieldError?.message}
          />
        )}
      />
      <Controller
        name="city"
        control={control}
        rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
        render={({ field, fieldState: { error: fieldError } }) => (
          <TextField
            label="City *"
            size="small"
            fullWidth
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            error={!!fieldError}
            helperText={fieldError?.message}
          />
        )}
      />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Controller
          name="state"
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <FormControl size="small" fullWidth>
              <InputLabel id="state-select-label" error={!!fieldError}>
                State *
              </InputLabel>
              <Select
                aria-describedby={fieldError ? 'state-helper-text' : undefined}
                label="State *"
                labelId="state-select-label"
                size="small"
                fullWidth
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                error={!!fieldError}
              >
                {AllStates.map((state) => (
                  <MenuItem value={state.value} key={state.value}>
                    {stateCodeToFullName[state.value]}
                  </MenuItem>
                ))}
              </Select>
              {fieldError ? (
                <FormHelperText id={`state-helper-text`} error={true}>
                  {fieldError?.message}
                </FormHelperText>
              ) : (
                <></>
              )}
            </FormControl>
          )}
        />
        <Controller
          name="zip"
          control={control}
          rules={{
            required: REQUIRED_FIELD_ERROR_MESSAGE,
            validate: (value) =>
              (value && isPostalCodeValid(value, requireFullZip)) ||
              `ZIP code must be 5 digits,${!requireFullZip ? ' optionally' : ''} with a 4-digit extension`,
          }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="ZIP Code *"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
              InputProps={{
                inputComponent: InputMask as any,
                inputProps: {
                  mask: '00000-0000',
                },
              }}
            />
          )}
        />
      </Box>
    </>
  );
}
