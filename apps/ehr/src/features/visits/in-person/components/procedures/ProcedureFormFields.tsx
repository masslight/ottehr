import { TextField } from '@mui/material';
import { FC } from 'react';

interface ProcedureOtherTextInputProps {
  parentLabel: string;
  visible: boolean;
  value: string | undefined;
  onChange: (value: string) => void;
  disabled: boolean;
}

export const ProcedureOtherTextInput: FC<ProcedureOtherTextInputProps> = ({
  parentLabel,
  visible,
  value,
  onChange,
  disabled,
}) =>
  visible ? (
    <TextField
      label={'Other ' + parentLabel.toLocaleLowerCase()}
      size="small"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  ) : null;
