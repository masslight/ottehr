import { TextField } from '@mui/material';
import { TestItemComponent } from 'utils';
// import InputMask from 'src/components/InputMask';
import { useFormContext, Controller } from 'react-hook-form';

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

  const assessAbnormality = (entry: string): void => {
    if (
      testItemComponent.dataType === 'Quantity' &&
      testItemComponent.normalRange.low &&
      testItemComponent.normalRange.high
    ) {
      const entryNum = parseFloat(entry);
      const { high, low } = testItemComponent.normalRange;
      // todo double chec with product team if this is inclusive on both ends
      // meaning it would be abnormal if it is strictly greater or strictly less than (but not equal)
      if (entryNum > high || entryNum < low) setIsAbnormal(true);
      if (entryNum <= high && entryNum >= low) setIsAbnormal(false);
    }
  };

  return (
    <Controller
      name={testItemComponent.observationDefinitionId}
      control={control}
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
            '& .MuiInputBase-root': {
              color: isAbnormal ? 'error.dark' : 'text.primary',
            },
            '& .Mui-disabled': {
              color: isAbnormal ? 'error.dark' : '',
              WebkitTextFillColor: isAbnormal ? '#C62828' : '',
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
