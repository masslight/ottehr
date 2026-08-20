import { Checkbox, FormControlLabel, Typography, useTheme } from '@mui/material';
import { FC, useEffect, useRef, useState } from 'react';

type StatelessExamCheckboxProps = {
  label?: string;
  abnormal?: boolean;
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  dataTestId?: string;
};

export const StatelessExamCheckbox: FC<StatelessExamCheckboxProps> = (props) => {
  const { label, abnormal, checked, indeterminate, onChange, disabled, dataTestId } = props;
  const theme = useTheme();
  const labelRef = useRef<HTMLLabelElement>(null);
  const [isMultiline, setIsMultiline] = useState(false);

  useEffect(() => {
    if (labelRef.current) {
      const height = labelRef.current.offsetHeight;
      const lineHeight = parseInt(getComputedStyle(labelRef.current).lineHeight);
      setIsMultiline(height > lineHeight);
    }
  }, [label]);

  return (
    <FormControlLabel
      sx={{ m: 0, alignItems: isMultiline ? 'flex-start' : 'center' }}
      control={
        <Checkbox
          size="small"
          disabled={disabled}
          data-testid={dataTestId}
          sx={{
            '&.Mui-checked, &.MuiCheckbox-indeterminate': {
              color: disabled ? undefined : abnormal ? theme.palette.error.main : theme.palette.success.main,
            },
            p: 0.5,
          }}
          checked={checked}
          indeterminate={indeterminate}
          onChange={(e) => onChange && onChange(e.target.checked)}
        />
      }
      label={
        label ? (
          <Typography ref={labelRef} fontWeight={checked && abnormal ? 600 : 400}>
            {label}
          </Typography>
        ) : undefined
      }
    />
  );
};
