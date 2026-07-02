import { TextField } from '@mui/material';
import { ReactElement } from 'react';
import { PatternFormat } from 'react-number-format';

interface ZipInputProps {
  value: string;
  onChange: (digits: string) => void;
}

export function ZipInput({ value, onChange }: ZipInputProps): ReactElement {
  // commit
  return (
    <PatternFormat
      customInput={TextField}
      size="small"
      fullWidth
      format="#####-####"
      placeholder="XXXXX-XXXX"
      value={value}
      onValueChange={(values, sourceInfo) => {
        if (sourceInfo.source === 'event') onChange(values.value);
      }}
    />
  );
}
