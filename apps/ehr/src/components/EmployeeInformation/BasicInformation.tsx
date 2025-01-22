import { Controller } from 'react-hook-form';
import { TextField, FormLabel } from '@mui/material';
import { BasicInformationProps } from './types';

export function BasicInformation({ control, existingUser, errors }: BasicInformationProps): JSX.Element {
  return (
    <>
      <FormLabel sx={{ mb: 1, fontWeight: '600 !important' }}>Employee information</FormLabel>
      <Controller
        name="firstName"
        control={control}
        render={({ field: { onChange, value } }) => (
          <TextField
            label="First name"
            required
            value={value || ''}
            onChange={onChange}
            sx={{ marginTop: 2, marginBottom: 1, width: '100%' }}
            margin="dense"
          />
        )}
      />
      <Controller
        name="middleName"
        control={control}
        render={({ field: { onChange, value } }) => (
          <TextField
            label="Middle name"
            value={value || ''}
            onChange={onChange}
            sx={{ marginTop: 2, marginBottom: 1, width: '100%' }}
            margin="dense"
          />
        )}
      />
      <Controller
        name="lastName"
        control={control}
        render={({ field: { onChange, value } }) => (
          <TextField
            label="Last name"
            required
            value={value || ''}
            onChange={onChange}
            sx={{ marginBottom: 2, width: '100%' }}
            margin="dense"
          />
        )}
      />
      <TextField
        label="Email"
        value={existingUser?.email ?? ''}
        sx={{ marginBottom: 2, width: '100%' }}
        margin="dense"
        InputProps={{
          readOnly: true,
          disabled: true,
        }}
      />
      <Controller
        name="phoneNumber"
        control={control}
        render={({ field: { onChange, value } }) => (
          <TextField
            label="Phone"
            value={value || ''}
            onChange={onChange}
            error={errors.phoneNumber}
            helperText={errors.phoneNumber ? 'Phone number must be 10 digits' : ''}
            FormHelperTextProps={{
              sx: { ml: 0, mt: 1 },
            }}
            sx={{ marginBottom: 2, width: '100%' }}
            margin="dense"
          />
        )}
      />
    </>
  );
}
