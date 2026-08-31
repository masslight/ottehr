import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { Checkbox, FormControlLabel, SxProps, Theme } from '@mui/material';
import { ControllerRenderProps, FieldValues } from 'react-hook-form';

interface NullOptionCheckboxProps {
  disabled: boolean;
  nullCode: string | undefined;
  field: ControllerRenderProps<FieldValues, string>;
  label: string | undefined;
}

const NEUTRAL_RADIO_STYLING = {
  color: 'primary.main',
  '&.Mui-disabled': {
    color: 'primary.main',
    '& .MuiSvgIcon-root': {
      fill: 'primary.main',
    },
  },
};

export const NullOptionCheckbox: React.FC<NullOptionCheckboxProps> = ({ disabled, nullCode, field, label }) => {
  const finalViewNullOptionCheckboxLabelStyling = (curValue: string): SxProps<Theme> => {
    const isFinalView = !!disabled;
    if (isFinalView) {
      const isChecked = curValue === nullCode;
      if (isChecked) {
        return {
          color: 'text.primary',
          '& .MuiFormControlLabel-label': {
            color: 'text.primary',
          },
          '&.Mui-disabled .MuiFormControlLabel-label': {
            color: 'text.primary',
          },
        };
      } else {
        return {};
      }
    }
    return {};
  };

  const finalViewNullOptionCheckboxStyling = (curValue: string): SxProps<Theme> => {
    const isFinalView = !!disabled;
    if (isFinalView) {
      const isChecked = curValue === nullCode;
      if (isChecked) {
        return NEUTRAL_RADIO_STYLING;
      } else {
        return {};
      }
    }
    return {};
  };

  return (
    <FormControlLabel
      control={
        <Checkbox
          icon={<RadioButtonUncheckedIcon />}
          checkedIcon={<RadioButtonCheckedIcon />}
          disabled={!!disabled}
          checked={field.value === nullCode}
          onChange={() => field.onChange(field.value === nullCode ? '' : nullCode)}
          sx={disabled ? finalViewNullOptionCheckboxStyling(field.value) : {}}
        />
      }
      label={label}
      sx={disabled ? finalViewNullOptionCheckboxLabelStyling(field.value) : {}}
    />
  );
};
