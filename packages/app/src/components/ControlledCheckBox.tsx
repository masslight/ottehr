import { FC, ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { FormControlLabel, Checkbox } from '@mui/material';
import { Box } from '@mui/system';

interface ControlledCheckBoxProps {
  name: string;
  label: string | undefined;
  defaultValue?: boolean;
  required?: boolean;
  document: ReactElement | undefined;
}

const ControlledCheckBox: FC<ControlledCheckBoxProps> = ({ name, label, defaultValue, required, document }) => {
  const { control } = useFormContext();
  return (
    <FormControlLabel
      sx={{ pt: 1, alignItems: 'flex-start' }}
      control={
        <Controller
          name={name}
          control={control}
          defaultValue={defaultValue}
          render={({ field: props }) => {
            return (
              <Checkbox
                {...props}
                checked={(props.value as boolean | undefined) ?? false}
                color="primary"
                style={{ borderRadius: '4px' }}
                sx={{
                  alignSelf: 'flex-start',
                  paddingRight: 1,
                  paddingBottom: 1,
                  width: '18px',
                  height: '18px',
                  marginRight: '10px',
                  '&.MuiCheckbox-root': {
                    borderRadius: '4px',
                  },
                  '&.Mui-checked': {
                    color: '#F5F2FF',
                    borderRadius: '4px',
                    outline: '1px solid #4D15B7',
                  },
                }}
                required={required}
              />
            );
          }}
        />
      }
      label={
        <Box sx={{ fontSize: 16 }}>
          {label}&nbsp;
          {document}
        </Box>
      }
    />
  );
};
export default ControlledCheckBox;
