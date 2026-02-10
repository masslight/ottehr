import { Checkbox, FormControlLabel } from '@mui/material';
import { palette } from '@theme/colors';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import Markdown from 'react-markdown';
import { DescriptionRenderer } from './DescriptionRenderer';
import { LinkRenderer } from './LinkRenderer';

interface ControlledCheckBoxProps {
  name: string;
  label: string | undefined;
  defaultValue?: boolean;
  required?: boolean;
}

const ControlledCheckBox: FC<ControlledCheckBoxProps> = ({ name, label, defaultValue, required }) => {
  const { control } = useFormContext();

  return (
    <FormControlLabel
      sx={{ pt: 1, alignItems: 'flex-start', margin: '0px' }}
      required={required}
      control={
        <Controller
          name={name}
          control={control}
          defaultValue={defaultValue}
          render={({ field: props }) => {
            return (
              <Checkbox
                {...props}
                checked={(props.value === '' ? false : (props.value as boolean | undefined)) ?? false}
                color="primary"
                style={{ borderRadius: '4px' }}
                sx={{
                  alignSelf: 'flex-start',
                  width: '18px',
                  height: '18px',
                  marginRight: '10px',
                  '&.MuiCheckbox-root': {
                    borderRadius: '4px',
                  },
                  '&.Mui-checked': {
                    color: palette.secondary.main,
                    borderRadius: '4px',
                    outline: '1px solid #2169F5',
                  },
                }}
                required={required}
              />
            );
          }}
        />
      }
      label={<Markdown components={{ p: DescriptionRenderer, a: LinkRenderer }}>{label}</Markdown>}
    />
  );
};
export default ControlledCheckBox;
