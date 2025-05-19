import { Select, InputLabel, FormControl, MenuItem } from '@mui/material';
import { TestItemComponent } from 'utils';

interface ResultEntrySelectProps {
  testItemComponent: TestItemComponent;
  result: string | null;
  setResult: React.Dispatch<React.SetStateAction<string | null>>;
}

export const ResultEntrySelect: React.FC<ResultEntrySelectProps> = ({ testItemComponent, result }) => {
  console.log('testItemComponent', testItemComponent);
  console.log('result', result);
  return (
    <FormControl sx={{ width: '80%' }} size="small">
      <InputLabel id="result-entry-labe">Select</InputLabel>
      <Select
        fullWidth
        labelId="result-entry-label"
        id="result-entry-select"
        label="Select"
        onChange={(e) => console.log('selected!', e.target.value)}
        value={result}
      >
        {['test', 'hi', 'oh']?.map((d) => (
          <MenuItem id={d} key={d} value={d}>
            {d}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
