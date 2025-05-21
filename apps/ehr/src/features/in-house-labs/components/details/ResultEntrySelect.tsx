import { Select, InputLabel, FormControl, MenuItem } from '@mui/material';
import { TestItemComponent } from 'utils';
import { useFormContext, Controller } from 'react-hook-form';

interface ResultEntrySelectProps {
  testItemComponent: TestItemComponent;
  isAbnormal: boolean;
  assessAbnormality: (entry: string) => void;
}

export const ResultEntrySelect: React.FC<ResultEntrySelectProps> = ({
  testItemComponent,
  isAbnormal,
  assessAbnormality,
}) => {
  const { control } = useFormContext();
  let values: string[] = [];
  if (testItemComponent.dataType === 'CodeableConcept') {
    values = testItemComponent.valueSet;
  }

  return (
    <FormControl
      sx={{
        width: '80%',
        '& .MuiOutlinedInput-root': {
          color: isAbnormal ? 'error.main' : '',
          '& fieldset': {
            borderColor: isAbnormal ? 'error.main' : '',
          },
          '&:hover fieldset': {
            borderColor: isAbnormal ? 'error.dark' : '',
          },
          '&.Mui-focused fieldset': {
            borderColor: isAbnormal ? 'error.dark' : '',
          },
        },
      }}
      size="small"
    >
      <InputLabel
        id="result-entry-labe"
        sx={{
          color: isAbnormal ? 'error.main' : '',
          '&.Mui-focused': {
            color: isAbnormal ? 'error.main' : '',
          },
        }}
      >
        Select
      </InputLabel>
      <Controller
        name={testItemComponent.observationDefinitionId}
        control={control}
        defaultValue=""
        render={({ field }) => (
          <Select
            fullWidth
            labelId="result-entry-label"
            id="result-entry-select"
            label="Select"
            {...field}
            onChange={(e) => {
              field.onChange(e);
              assessAbnormality(e.target.value);
            }}
          >
            {values?.map((val, idx) => (
              <MenuItem id={`${val}-${idx}-id`} key={`${val}-${idx}-key`} value={val}>
                {val}
              </MenuItem>
            ))}
          </Select>
        )}
      />
    </FormControl>
  );
};
