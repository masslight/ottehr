import { Checkbox, FormControlLabel } from '@mui/material';
import { Box } from '@mui/system';
import { FC, ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { otherColors } from '../OttEHRThemeProvider';

interface ControlledCheckBoxProps {
  defaultValue?: boolean;
  document: ReactElement | undefined;
  label: string | undefined;
  name: string;
  required?: boolean;
}

export const ControlledCheckBox: FC<ControlledCheckBoxProps> = ({ defaultValue, document, label, name, required }) => {
  const { control } = useFormContext();

  return (
    <FormControlLabel
      control={
        <Controller
          control={control}
          defaultValue={defaultValue}
          name={name}
          render={({ field: props }) => {
            return (
              <Checkbox
                {...props}
                checked={(props.value as boolean | undefined) ?? false}
                color="primary"
                required={required}
                style={{ borderRadius: '4px' }}
                sx={{
                  alignSelf: 'flex-start',
                  height: '18px',
                  mr: '10px',
                  pr: 1,
                  pb: 1,
                  width: '18px',
                  '&.Mui-checked': {
                    borderRadius: '4px',
                    color: otherColors.lightPurple,
                    outline: otherColors.purple,
                  },
                  '&.MuiCheckbox-root': {
                    borderRadius: '4px',
                  },
                }}
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
      sx={{ alignItems: 'flex-start', pt: 1 }}
    />
  );
};
