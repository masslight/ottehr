import { Box, FormControl, FormHelperText, InputLabel, MenuItem, Select, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { REQUIRED_FIELD_ERROR_MESSAGE } from 'utils';

interface DemographicForm {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  dob: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
}

export function DemographicFields({ showMiddle }: { showMiddle?: boolean }): ReactElement {
  const { control } = useFormContext<DemographicForm>();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25, mt: 0.5 }}>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Controller
          name="firstName"
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="First name *"
              size="small"
              fullWidth
              autoFocus
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
            />
          )}
        />
        {showMiddle && (
          <Controller
            name="middleName"
            control={control}
            render={({ field, fieldState: { error: fieldError } }) => (
              <TextField
                label="Middle name"
                size="small"
                fullWidth
                autoFocus
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                error={!!fieldError}
                helperText={fieldError?.message}
              />
            )}
          />
        )}
        <Controller
          name="lastName"
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="Last name *"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
            />
          )}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Controller
          name="dob"
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="Date of birth *"
              size="small"
              fullWidth
              type="date"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              error={!!fieldError}
              helperText={fieldError?.message}
            />
          )}
        />
        <Controller
          name="gender"
          control={control}
          rules={{ required: REQUIRED_FIELD_ERROR_MESSAGE }}
          render={({ field, fieldState: { error: fieldError } }) => (
            <FormControl size="small" fullWidth>
              <InputLabel id="gender-select-label" error={!!fieldError}>
                Gender *
              </InputLabel>
              <Select
                aria-describedby={fieldError ? 'gender-helper-text' : undefined}
                label="Gender *"
                labelId="gender-select-label"
                size="small"
                fullWidth
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                error={!!fieldError}
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
                <MenuItem value="unknown">Unknown</MenuItem>
              </Select>
              {fieldError ? (
                <FormHelperText id={`gender-helper-text`} error={true}>
                  {fieldError?.message}
                </FormHelperText>
              ) : (
                <></>
              )}
            </FormControl>
          )}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Controller
          name="phone"
          control={control}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="Phone number"
              size="small"
              fullWidth
              placeholder="(555) 000-0000"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
            />
          )}
        />
        <Controller
          name="email"
          control={control}
          render={({ field, fieldState: { error: fieldError } }) => (
            <TextField
              label="Email"
              size="small"
              fullWidth
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              error={!!fieldError}
              helperText={fieldError?.message}
            />
          )}
        />
      </Box>
    </Box>
  );
}
