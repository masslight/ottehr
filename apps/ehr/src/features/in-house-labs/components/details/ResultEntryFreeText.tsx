import { FormControl, TextField, useTheme } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import { TestItemComponent } from 'utils';

interface ResultEntryFreeTextProps {
  testItemComponent: TestItemComponent;
  disabled?: boolean; // equates to the final view
}

export const ResultEntryFreeText: React.FC<ResultEntryFreeTextProps> = ({ testItemComponent, disabled }) => {
  const { control } = useFormContext();
  const theme = useTheme();

  const validateInput = (entry: string): string | boolean => {
    if (testItemComponent.dataType === 'string' && testItemComponent.validations) {
      const { validations } = testItemComponent;
      console.log('entry and validations', entry, validations);
      if (validations.format && typeof validations.format.value === 'string') {
        const formatRegex = RegExp(validations.format.value);
        const matchesFormat = formatRegex.test(entry);
        if (!matchesFormat) {
          console.log(`string entry doesn't match format`, entry, validations.format.value);
          let helperText = 'Incorrect format';
          if (testItemComponent.validations.format?.display)
            helperText = `Format: ${testItemComponent.validations.format.display}`;
          return helperText;
        }
      }
    }
    return true;
  };

  return (
    <FormControl
      sx={{
        width: '80%',
        '& .MuiInputBase-input.Mui-disabled': {
          color: theme.palette.text.primary,
          WebkitTextFillColor: theme.palette.text.primary,
        },
      }}
      size="small"
    >
      <Controller
        name={testItemComponent.observationDefinitionId}
        control={control}
        rules={{ required: 'Please input a value', validate: validateInput }}
        defaultValue=""
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            disabled={!!disabled}
            fullWidth
            id="result-entry-text"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            onChange={(e) => {
              field.onChange(e);
            }}
          ></TextField>
        )}
      ></Controller>
    </FormControl>
  );
};
