import { FormControlLabel, FormControlLabelProps, MenuItem, Select } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';

type ControlledExcuseDropdownProps = {
  label: string;
  name: 'patientOrRelatedPerson';
  onChange?: (newValue: ExcuseFormValues['patientOrRelatedPerson']) => void;
  sx?: FormControlLabelProps['sx'];
};

export const ControlledExcuseDropdown: FC<ControlledExcuseDropdownProps> = (props) => {
  const { label, name, onChange: onExternalChange, sx } = props;

  const { control } = useFormContext();

  return (
    <FormControlLabel
      sx={sx}
      control={
        <Controller
          name={name}
          control={control}
          render={({ field: { value, onChange } }) => (
            <Select
              value={value}
              onChange={(e) => {
                if (onExternalChange) {
                  onExternalChange(e.target.value);
                }
                onChange(e);
              }}
            >
              <MenuItem value="patient">Patient</MenuItem>
              <MenuItem value="related-person">Related Person</MenuItem>
            </Select>
          )}
        />
      }
      label={label}
      labelPlacement="start"
    />
  );
};
