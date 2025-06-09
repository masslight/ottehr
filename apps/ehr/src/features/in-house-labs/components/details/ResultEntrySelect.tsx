import { Select, FormControl, MenuItem, useTheme } from '@mui/material';
import { TestItemComponent } from 'utils';
import { useFormContext, Controller } from 'react-hook-form';

interface ResultEntrySelectProps {
  testItemComponent: TestItemComponent;
  isAbnormal: boolean;
  setIsAbnormal: (bool: boolean) => void;
  disabled?: boolean; // equates to the final view
}

export const ResultEntrySelect: React.FC<ResultEntrySelectProps> = ({
  testItemComponent,
  isAbnormal,
  setIsAbnormal,
  disabled,
}) => {
  const { control } = useFormContext();
  const theme = useTheme();

  const assessAbnormality = (entry: string): void => {
    if (testItemComponent.dataType === 'CodeableConcept' && testItemComponent.abnormalValues) {
      if (testItemComponent.abnormalValues.includes(entry)) {
        setIsAbnormal(true);
      } else {
        setIsAbnormal(false);
      }
    }
  };

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
          '&.Mui-disabled': {
            '& fieldset': {
              borderColor: isAbnormal ? 'error.dark' : '',
            },
          },
        },

        '& .MuiSelect-select.Mui-disabled': {
          color: isAbnormal ? 'error.dark' : 'text.primary',
          WebkitTextFillColor: isAbnormal ? theme.palette.error.dark : theme.palette.text.primary,
        },
      }}
      size="small"
    >
      <Controller
        name={testItemComponent.observationDefinitionId}
        control={control}
        rules={{ required: 'Please select a value' }}
        defaultValue=""
        render={({ field }) => (
          <Select
            disabled={!!disabled}
            fullWidth
            id="result-entry-select"
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
