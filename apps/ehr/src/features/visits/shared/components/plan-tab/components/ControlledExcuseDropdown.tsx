import { FormControl, FormControlProps, MenuItem, Select, Typography } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { ExcuseFormValues } from 'src/features/visits/telemed/utils/school-work-excuse.helper';

type ControlledExcuseDropdownProps = {
  label: string;
  name: 'patientOrRelatedPerson';
  onChange?: (newValue: ExcuseFormValues['patientOrRelatedPerson']) => void;
  sx?: FormControlProps['sx'];
};

export const ControlledExcuseDropdown: FC<ControlledExcuseDropdownProps> = (props) => {
  const { label, name, onChange: onExternalChange, sx } = props;

  const { control } = useFormContext();

  return (
    <FormControl sx={{ flexDirection: 'row', alignItems: 'center', ...sx }}>
      <Typography component="label" htmlFor={name}>
        {label}
      </Typography>
      <Controller
        name={name}
        control={control}
        render={({ field: { value, onChange } }) => (
          <Select
            id={name}
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
    </FormControl>
  );
};
