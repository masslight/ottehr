import { FormControl, FormControlLabel, Radio, RadioGroup, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { ExamCardsNames, ExamFieldsNames } from 'utils';
import { useExamObservations } from '../../../../hooks/useExamObservations';

type ControlledExamRadioGroupProps = {
  label: string;
  name: ExamFieldsNames | ExamCardsNames;
  abnormal?: boolean;
};

export const ControlledExamRadioGroup: FC<ControlledExamRadioGroupProps> = (props) => {
  const { label, name, abnormal } = props;

  const { value: field, update, isLoading } = useExamObservations(name);
  const theme = useTheme();

  const onChange = (value: string): void => {
    update({ ...field, value: value === 'true' });
  };

  return (
    <FormControl sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      <Typography sx={{ flex: 1 }}>{label}</Typography>
      <RadioGroup
        row
        value={field.value ? 'true' : 'false'}
        onChange={(e) => onChange(e.target.value)}
        sx={{ display: 'flex', gap: 1 }}
      >
        <FormControlLabel
          value="true"
          control={
            <Radio
              size="small"
              disabled={isLoading}
              sx={{
                p: 0.5,
                '&.Mui-checked': {
                  color: isLoading ? undefined : abnormal ? theme.palette.error.main : theme.palette.success.main,
                },
              }}
            />
          }
          label={<Typography fontWeight={field.value === true && abnormal ? 600 : 400}>Yes</Typography>}
          sx={{ m: 0 }}
        />
        <FormControlLabel
          value="false"
          control={
            <Radio
              size="small"
              disabled={isLoading}
              sx={{
                p: 0.5,
                '&.Mui-checked': {
                  color: isLoading ? undefined : abnormal ? theme.palette.success.main : theme.palette.error.main,
                },
              }}
            />
          }
          label={<Typography fontWeight={field.value === false && !abnormal ? 600 : 400}>No</Typography>}
          sx={{ m: 0 }}
        />
      </RadioGroup>
    </FormControl>
  );
};
