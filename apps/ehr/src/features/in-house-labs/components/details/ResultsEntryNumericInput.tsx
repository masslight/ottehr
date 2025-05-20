import { TextField } from '@mui/material';
import { TestItemComponent } from 'utils';
// import InputMask from 'src/components/InputMask';
import { useFormContext, Controller } from 'react-hook-form';

interface ResultEntryNumericInputProps {
  testItemComponent: TestItemComponent;
  isAbnormal: boolean;
  assessAbnormality: (entry: string) => void;
}

export const ResultEntryNumericInput: React.FC<ResultEntryNumericInputProps> = ({
  testItemComponent,
  isAbnormal,
  assessAbnormality,
}) => {
  console.log('testItemComponent', testItemComponent);
  const { control } = useFormContext();

  return (
    <Controller
      name={testItemComponent.observationDefinitionId}
      control={control}
      defaultValue=""
      render={({ field }) => (
        <TextField
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
