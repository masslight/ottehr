import { Box, FormControl, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { InputMask } from 'ui-components/lib/components/InputMask';
import { AllStates, stateCodeToFullName } from 'utils/lib/types/common';

// Optional address block for NIO forms. Unlike AddressFields, every field is optional (partial
// addresses are allowed by design) and the field names are prefixed, so multiple address groups —
// the organization address plus per-coverage mail addresses — can coexist in one form.
export function NioAddressFields({ prefix }: { prefix: string }): ReactElement {
  const { control } = useFormContext();
  return (
    <>
      <Controller
        name={`${prefix}.line1`}
        control={control}
        render={({ field }) => (
          <TextField
            label="Address Line 1"
            size="small"
            fullWidth
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
          />
        )}
      />
      <Controller
        name={`${prefix}.line2`}
        control={control}
        render={({ field }) => (
          <TextField
            label="Address Line 2"
            size="small"
            fullWidth
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
          />
        )}
      />
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Controller
          name={`${prefix}.city`}
          control={control}
          render={({ field }) => (
            <TextField
              label="City"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
            />
          )}
        />
        <Controller
          name={`${prefix}.state`}
          control={control}
          render={({ field }) => (
            <FormControl size="small" fullWidth>
              <InputLabel id={`${prefix}-state-label`}>State</InputLabel>
              <Select
                label="State"
                labelId={`${prefix}-state-label`}
                size="small"
                fullWidth
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {AllStates.map((state) => (
                  <MenuItem value={state.value} key={state.value}>
                    {stateCodeToFullName[state.value]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        />
        <Controller
          name={`${prefix}.zip`}
          control={control}
          render={({ field }) => (
            <TextField
              label="ZIP"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              InputProps={{
                inputComponent: InputMask as any,
                inputProps: { mask: '00000-0000' },
              }}
            />
          )}
        />
      </Box>
    </>
  );
}
