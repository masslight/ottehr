import { FormControl, MenuItem, Select, useTheme } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import { LabComponentValueSetConfig, TestItemComponent } from 'utils';

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
      console.log('entry', entry);
      if (testItemComponent.abnormalValues.map((val) => val.code).includes(entry)) {
        setIsAbnormal(true);
      } else {
        setIsAbnormal(false);
      }
    }
  };

  let values: LabComponentValueSetConfig[] = [];
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
              <MenuItem id={`${val}-${idx}-id`} key={`${val}-${idx}-key`} value={val.code}>
                {val.display}
              </MenuItem>
            ))}
          </Select>
        )}
      />
    </FormControl>
  );
};
