import { Stack, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { DateInput } from './DateInput';

export interface InstitutionalClaimAdditionalFieldsData {
  billType: string;
  patientDischargeStatusCode: string;
  admissionType: string;
  admissionSource: string;
  admissionDate: string;
  dischargeDate: string;
}

export function InstitutionalClaimAdditionalFields(): ReactElement {
  const { control, getValues } = useFormContext();
  return (
    <Stack spacing={2}>
      <Controller
        name="billType"
        control={control}
        rules={{
          validate: (value) =>
            !value?.trim() ||
            (value.length === 4 && (value as string).charAt(0) === '0') ||
            'Bill Type must be 4 digits starting with 0',
        }}
        render={({ field, fieldState: { error: fieldError } }) => (
          <TextField
            label="Bill Type"
            size="small"
            fullWidth
            value={field.value}
            onChange={(e) => field.onChange(e.target.value.replace(/[^0-9]/g, ''))}
            error={!!fieldError}
            helperText={fieldError?.message}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 4 }}
          />
        )}
      />
      <Controller
        name="patientDischargeStatusCode"
        control={control}
        render={({ field, fieldState: { error: fieldError } }) => (
          <TextField
            label="Patient Discharge Status Code"
            size="small"
            fullWidth
            value={field.value}
            onChange={(e) => field.onChange(e.target.value.replace(/[^0-9]/g, ''))}
            error={!!fieldError}
            helperText={fieldError?.message}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 2 }}
          />
        )}
      />
      <Controller
        name="admissionType"
        control={control}
        render={({ field, fieldState: { error: fieldError } }) => (
          <TextField
            label="Admission Type"
            size="small"
            fullWidth
            value={field.value}
            onChange={(e) => field.onChange(e.target.value.replace(/[^0-9]/g, ''))}
            error={!!fieldError}
            helperText={fieldError?.message}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 1 }}
          />
        )}
      />
      <Controller
        name="admissionSource"
        control={control}
        render={({ field, fieldState: { error: fieldError } }) => (
          <TextField
            label="Point of Origin / Admission Source"
            size="small"
            fullWidth
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            error={!!fieldError}
            helperText={fieldError?.message}
            inputProps={{ maxLength: 1 }}
          />
        )}
      />
      <Controller
        name="admissionDate"
        control={control}
        rules={{
          validate: (value) =>
            !getValues('dischargeDate') || !!value || 'Admission date is required when discharge date is set',
        }}
        render={({ field, fieldState: { error: fieldError } }) => (
          <DateInput
            label="Admission Date"
            size="small"
            fullWidth
            value={field.value ?? ''}
            onChange={(value) => field.onChange(value)}
            error={!!fieldError}
            helperText={fieldError?.message}
          />
        )}
      />
      <Controller
        name="dischargeDate"
        control={control}
        rules={{
          validate: (value) =>
            !getValues('admissionDate') || !!value || 'Discharge date is required when admission date is set',
        }}
        render={({ field, fieldState: { error: fieldError } }) => (
          <DateInput
            label="Discharge Date"
            size="small"
            fullWidth
            value={field.value ?? ''}
            onChange={(value) => field.onChange(value)}
            error={!!fieldError}
            helperText={fieldError?.message}
          />
        )}
      />
    </Stack>
  );
}
