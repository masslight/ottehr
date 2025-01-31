import { Controller } from 'react-hook-form';
import { TextField, FormLabel } from '@mui/material';
import { BasicInformationProps } from './types';
import { dataTestIds } from '../../constants/data-test-ids';

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
            data-testid={dataTestIds.employeesPage.firstName}
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
            data-testid={dataTestIds.employeesPage.middleName}
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
            data-testid={dataTestIds.employeesPage.lastName}
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
        data-testid={dataTestIds.employeesPage.email}
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
            data-testid={dataTestIds.employeesPage.phone}
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
