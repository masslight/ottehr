import { TextField } from '@mui/material';
import { TestItemComponent } from 'utils';
import InputMask from 'src/components/InputMask';

interface ResultEntryNumericInputProps {
  testItemComponent: TestItemComponent;
  result: string | null;
  setResult: React.Dispatch<React.SetStateAction<string | null>>;
}

export const ResultEntryNumericInput: React.FC<ResultEntryNumericInputProps> = ({ testItemComponent, result }) => {
  console.log('testItemComponent', testItemComponent);
  console.log('result', result);
  return (
    <TextField
      type="text"
      //   placeholder={numberType.replace(/#/g, '0')}
      // id={idString}
      sx={{ width: '80%' }}
      size="small"
      InputProps={{
        inputComponent: InputMask as any,
        inputProps: {
          mask: Number,
          radix: '.',
          padFractionalZeros: true,
          // scale: decimals,
          // step: decimals ? `0.${'0'.padStart(decimals - 1, '0')}1` : null,
          // readOnly: answer !== undefined,
        },
      }}
      defaultValue={result}
    />
  );
};
