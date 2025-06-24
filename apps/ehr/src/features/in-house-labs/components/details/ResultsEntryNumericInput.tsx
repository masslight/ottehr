import { TextField, useTheme } from '@mui/material';
// import InputMask from 'src/components/InputMask';
import { Controller, useFormContext } from 'react-hook-form';
import { TestItemComponent } from 'utils';

interface ResultEntryNumericInputProps {
  testItemComponent: TestItemComponent;
  isAbnormal: boolean;
  setIsAbnormal: (bool: boolean) => void;
  disabled?: boolean; // equates to the final view
}

export const ResultEntryNumericInput: React.FC<ResultEntryNumericInputProps> = ({
  testItemComponent,
  isAbnormal,
  setIsAbnormal,
  disabled,
}) => {
  const { control } = useFormContext();
  const theme = useTheme();

  const assessAbnormality = (entry: string): void => {
    if (
      testItemComponent.dataType === 'Quantity' &&
      testItemComponent.normalRange.low &&
      testItemComponent.normalRange.high
    ) {
      const entryNum = parseFloat(entry);
      const { high, low } = testItemComponent.normalRange;
      // todo double check with product team if this is inclusive on both ends
      // meaning it would be abnormal if it is strictly greater or strictly less than (but not equal)
      if (entryNum > high || entryNum < low) setIsAbnormal(true);
      if (entryNum <= high && entryNum >= low) setIsAbnormal(false);
    }
  };

  return (
    <Controller
      name={testItemComponent.observationDefinitionId}
      control={control}
      rules={{ required: 'Please enter a value' }}
      defaultValue=""
      render={({ field }) => (
        <TextField
          disabled={!!disabled}
          {...field}
          onChange={(e) => {
            const value = e.target.value;
            field.onChange(value);
            assessAbnormality(value);
          }}
          type="text"
          error={isAbnormal}
          sx={{
            width: '80%',
            '& .Mui-disabled': {
              color: isAbnormal ? 'error.dark' : '',
              WebkitTextFillColor: isAbnormal ? theme.palette.error.dark : theme.palette.text.primary,
            },
            '& .MuiOutlinedInput-root': {
              '&.Mui-disabled': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: isAbnormal ? 'error.dark' : '',
                },
              },
            },
          }}
          size="small"
          InputProps={{
            // inputComponent: InputMask as any,
            inputProps: {
              mask: Number,
              radix: '.',
              padFractionalZeros: true,
            },
          }}
          defaultValue={''}
        />
      )}
    />
  );
};
