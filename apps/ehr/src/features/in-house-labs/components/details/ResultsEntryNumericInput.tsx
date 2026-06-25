import { TextField, useTheme } from '@mui/material';
import { ControllerRenderProps, FieldValues } from 'react-hook-form';
import InputMask from 'src/components/InputMask';
import { DataEntryComponent, IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG } from 'utils';
import { configNumericResultEntryTestId } from '../../utils/test-ids';

interface ResultEntryNumericInputProps {
  testItemComponent: DataEntryComponent;
  isAbnormal: boolean;
  setIsAbnormal: (bool: boolean) => void;
  field: ControllerRenderProps<FieldValues, string>;
  disabled?: boolean; // equates to the final view
}

export const ResultEntryNumericInput: React.FC<ResultEntryNumericInputProps> = ({
  testItemComponent,
  isAbnormal,
  setIsAbnormal,
  field,
  disabled,
}) => {
  const theme = useTheme();
  const nullValueCode = IN_HOUSE_LAB_OD_NULL_OPTION_CONFIG.valueCode;

  const assessAbnormality = (entry: string): void => {
    if (
      testItemComponent.dataType === 'Quantity' &&
      testItemComponent.normalRange.low !== null &&
      testItemComponent.normalRange.high !== null
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
    <TextField
      data-testid={configNumericResultEntryTestId(testItemComponent.componentName)}
      disabled={!!disabled}
      key={field.value === nullValueCode ? 'null' : 'value'}
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
        inputComponent: InputMask as any,
        inputProps: {
          mask: Number,
          scale: 5,
          radix: '.',
        },
      }}
    />
  );
};
