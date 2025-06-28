import { FormLabel, TextField } from '@mui/material';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTime } from 'luxon';
import { Controller } from 'react-hook-form';
import { phoneRegex, zipRegex } from 'utils';
import { dataTestIds } from '../../constants/data-test-ids';
import InputMask from '../InputMask';
import { BasicInformationProps } from './types';

export function BasicInformation({ control, existingUser }: BasicInformationProps): JSX.Element {
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
      <Controller
        name="birthDate"
        control={control}
        rules={{
          validate: (value) => {
            if (value) {
              const date = DateTime.fromISO(value);
              if (!date.isValid) {
                return 'Please enter a valid birth date';
              }
              if (date > DateTime.now()) {
                return 'Birth date cannot be in the future';
              }
            }
            return true;
          },
        }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <LocalizationProvider dateAdapter={AdapterLuxon}>
            <DatePicker
              label="Birth date"
              onChange={onChange}
              slotProps={{
                textField: {
                  style: { width: '100%' },
                  helperText: error?.message ? error?.message : null,
                  error: error?.message !== undefined,
                  inputProps: {
                    'data-testid': dataTestIds.employeesPage.birthDate,
                  },
                },
              }}
              value={value || null}
            />
          </LocalizationProvider>
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
        rules={{
          pattern: {
            value: phoneRegex,
            message: '{Phone number must be} 10 digits',
          },
        }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <TextField
            label="Phone"
            data-testid={dataTestIds.employeesPage.phone}
            value={value || ''}
            onChange={onChange}
            error={error?.message !== undefined}
            inputProps={{ mask: '(000) 000-0000' }}
            InputProps={{
              inputComponent: InputMask as any,
            }}
            helperText={error?.message ?? ''}
            FormHelperTextProps={{
              sx: { ml: 0, mt: 1 },
            }}
            sx={{ marginBottom: 2, width: '100%' }}
            margin="dense"
          />
        )}
      />
      <Controller
        name="faxNumber"
        control={control}
        rules={{
          pattern: {
            value: phoneRegex,
            message: 'Fax number must be 10 digits in the format (xxx) xxx-xxxx and a valid number',
          },
        }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <TextField
            label="Fax"
            data-testid={dataTestIds.employeesPage.fax}
            value={value || ''}
            onChange={onChange}
            error={error?.message !== undefined}
            sx={{ marginBottom: 2, width: '100%' }}
            inputProps={{ mask: '(000) 000-0000' }}
            InputProps={{
              inputComponent: InputMask as any,
            }}
            helperText={error?.message ?? ''}
            FormHelperTextProps={{
              sx: { ml: 0, mt: 1 },
            }}
            margin="dense"
          />
        )}
      />
      <Controller
        name="addressLine1"
        control={control}
        render={({ field: { onChange, value } }) => (
          <TextField
            label="Address line 1"
            data-testid={dataTestIds.employeesPage.addressLine1}
            value={value || ''}
            onChange={onChange}
            sx={{ marginBottom: 2, width: '100%' }}
            margin="dense"
          />
        )}
      />
      <Controller
        name="addressLine2"
        control={control}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <TextField
            label="Address line 2"
            data-testid={dataTestIds.employeesPage.addressLine2}
            value={value || ''}
            onChange={onChange}
            error={error?.message !== undefined}
            helperText={error?.message ?? ''}
            FormHelperTextProps={{
              sx: { ml: 0, mt: 1 },
            }}
            sx={{ marginBottom: 2, width: '100%' }}
            margin="dense"
          />
        )}
      />
      <Controller
        name="addressCity"
        control={control}
        render={({ field: { onChange, value } }) => (
          <TextField
            label="City"
            data-testid={dataTestIds.employeesPage.addressCity}
            value={value || ''}
            onChange={onChange}
            sx={{ marginBottom: 2, width: '100%' }}
            margin="dense"
          />
        )}
      />
      <Controller
        name="addressState"
        control={control}
        render={({ field: { onChange, value } }) => (
          <TextField
            label="State"
            data-testid={dataTestIds.employeesPage.addressState}
            value={value || ''}
            onChange={onChange}
            sx={{ marginBottom: 2, width: '100%' }}
            margin="dense"
          />
        )}
      />
      <Controller
        name="addressZip"
        control={control}
        rules={{
          pattern: {
            value: zipRegex,
            message: 'Zip code must be 5 digits',
          },
        }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <TextField
            label="Zip"
            data-testid={dataTestIds.employeesPage.addressZip}
            error={error?.message !== undefined}
            value={value || ''}
            onChange={onChange}
            helperText={error?.message ?? ''}
            FormHelperTextProps={{
              sx: { ml: 0, mt: 1 },
            }}
            inputProps={{ mask: '00000' }}
            InputProps={{
              inputComponent: InputMask as any,
            }}
            sx={{ marginBottom: 2, width: '100%' }}
            margin="dense"
          />
        )}
      />
    </>
  );
}
