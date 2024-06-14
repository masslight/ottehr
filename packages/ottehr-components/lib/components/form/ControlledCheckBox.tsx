import { Checkbox, FormControlLabel } from '@mui/material';
import { FC, useContext } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import Markdown from 'react-markdown';
import { IntakeThemeContext } from '../../contexts';
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
  const { otherColors } = useContext(IntakeThemeContext);

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
                // eslint-disable-next-line react/prop-types
                checked={(props.value as boolean | undefined) ?? false}
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
                    color: otherColors.purple,
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
      label={<Markdown components={{ p: DescriptionRenderer, a: LinkRenderer }}>{label}</Markdown>}
    />
  );
};
export default ControlledCheckBox;
