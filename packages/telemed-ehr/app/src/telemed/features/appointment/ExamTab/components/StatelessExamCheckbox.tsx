import { FC } from 'react';
import { Checkbox, FormControlLabel, Typography, useTheme } from '@mui/material';

type StatelessExamCheckboxProps = {
  label?: string;
  abnormal?: boolean;
  checked?: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
};

export const StatelessExamCheckbox: FC<StatelessExamCheckboxProps> = (props) => {
  const { label, abnormal, checked, onChange, disabled } = props;
  const theme = useTheme();

  return (
    <FormControlLabel
      sx={{ m: 0 }}
      control={
        <Checkbox
          size="small"
          disabled={disabled}
          sx={{
            '&.Mui-checked': {
              color: disabled ? undefined : abnormal ? theme.palette.error.main : theme.palette.success.main,
            },
            p: 0.5,
          }}
          checked={checked}
          onChange={(e) => onChange && onChange(e.target.checked)}
        />
      }
      label={label ? <Typography fontWeight={checked && abnormal ? 600 : 400}>{label}</Typography> : undefined}
    />
  );
};
