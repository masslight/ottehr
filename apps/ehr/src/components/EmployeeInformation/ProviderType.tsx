import { Autocomplete, TextField } from '@mui/material';
import { Control, UseFormSetValue, useWatch } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';

const providerTypeOptions = [
  { code: 'MD', label: 'MD' },
  { code: 'DO', label: 'DO' },
  { code: 'PA', label: 'PA' },
  { code: 'NP', label: 'NP' },
  { code: 'other', label: 'Other' },
];

export function ProviderTypeField({
  control,
  setValue,
}: {
  control: Control<any>;
  setValue: UseFormSetValue<any>;
}): JSX.Element {
  const providerType = useWatch({ control, name: 'providerType' });

  return (
    <>
      <Controller
        name="providerType"
        control={control}
        render={({ field, fieldState: { error } }) => (
          <Autocomplete
            {...field}
            fullWidth
            options={providerTypeOptions.map((opt) => opt.code)}
            getOptionLabel={(option) => {
              const found = providerTypeOptions.find((opt) => opt.code === option);
              return found ? found.label : option;
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Provider Type"
                data-testid={dataTestIds.employeesPage.providerDetailsProviderTypeDropdown}
                error={!!error}
                helperText={error ? 'Please select provider type' : null}
                FormHelperTextProps={{
                  sx: { ml: 0, mt: 1 },
                }}
                margin="dense"
              />
            )}
            value={field.value || null}
            onChange={(_, newValue) => {
              field.onChange(newValue ?? null);
              if (newValue !== 'other') {
                setValue('providerTypeText', '');
              }
            }}
          />
        )}
      />

      {providerType === 'other' && (
        <Controller
          name="providerTypeText"
          control={control}
          rules={{
            validate: (value, formValues) => {
              if (formValues.providerType === 'other' && !value) {
                return 'Please specify provider type';
              }
              return true;
            },
          }}
          render={({ field, fieldState: { error } }) => (
            <TextField
              {...field}
              fullWidth
              margin="normal"
              label="Specify Provider Type"
              required
              error={error?.message !== undefined}
              helperText={error?.message ?? ''}
              data-testid={dataTestIds.employeesPage.providerDetailsProviderTypeOtherText}
            />
          )}
        />
      )}
    </>
  );
}
