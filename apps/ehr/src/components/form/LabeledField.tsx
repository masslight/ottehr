import { FormControl, InputLabel, useTheme } from '@mui/material';
import { FC, ReactElement } from 'react';

interface LabeledFieldProps {
  children: ReactElement<any>;
  label: string;
  required?: boolean;
  error?: boolean;
}

export const LabeledField: FC<LabeledFieldProps> = ({ children, label, required = false, error }) => {
  const theme = useTheme();

  return (
    <FormControl fullWidth>
      <InputLabel
        shrink
        required={required}
        error={error}
        sx={{ fontWeight: 'bold', backgroundColor: theme.palette.background.paper, px: '5px' }}
      >
        {label}
      </InputLabel>
      {children}
    </FormControl>
  );
};
