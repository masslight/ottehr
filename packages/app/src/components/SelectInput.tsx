import { ExpandMore } from '@mui/icons-material';
import { FormControl, MenuItem, Select, SelectProps, useTheme } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { otherColors } from '../OttEHRThemeProvider';
import { findLabelFromOptions } from '../helpers';
import { BoldPrimaryInputLabel } from './BoldPrimaryInputLabel';
import { InputHelperText } from './InputHelperText';
import { RenderLabelFromSelect } from './RenderLabelFromSelect';

export interface SelectInputOption {
  label: string;
  value: string;
}

type SelectInputProps = {
  helperText?: string;
  label: string;
  name: string;
  options: SelectInputOption[];
  placeholder?: string;
} & SelectProps;

export const SelectInput: FC<SelectInputProps> = ({
  defaultValue,
  helperText,
  label,
  name,
  options,
  placeholder,
  ...otherProps
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const theme = useTheme();

  return (
    <Controller
      control={control}
      defaultValue={defaultValue || ''}
      name={name}
      render={({ field }) => (
        <FormControl
          error={!!errors[name]}
          required={otherProps.required}
          variant="standard"
          sx={{
            width: '100%',
          }}
        >
          <BoldPrimaryInputLabel id={`${name}-label`} shrink>
            {label}
          </BoldPrimaryInputLabel>
          <Select
            {...field}
            {...otherProps}
            IconComponent={ExpandMore}
            // To stop it adding a padding-right on the main element, shifting the background image
            MenuProps={{ disableScrollLock: true, PaperProps: { style: { maxHeight: 400 } } }}
            disableUnderline
            displayEmpty
            labelId={`${name}-label`}
            renderValue={(selected) => {
              if (selected.length === 0) {
                return (
                  <RenderLabelFromSelect styles={{ color: otherColors.placeholder }}>
                    {placeholder || 'Select...'}
                  </RenderLabelFromSelect>
                );
              }
              return <RenderLabelFromSelect>{findLabelFromOptions(selected, options)}</RenderLabelFromSelect>;
            }}
            sx={{
              '& .MuiSelect-icon': {
                mr: '10px',
              },
              '& .MuiSelect-iconOpen': {
                mr: '10px',
              },
              '& .MuiInputBase-input': {
                backgroundColor: theme.palette.background.paper,
                border: '1px solid',
                borderColor: otherColors.lightGray,
                borderRadius: '8px',
                p: '10px 26px 10px 12px',
                '&:focus': {
                  backgroundColor: theme.palette.background.paper,
                  borderRadius: '8px',
                },
              },
            }}
          >
            {options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          <InputHelperText errors={errors} helperText={helperText} name={name} />
        </FormControl>
      )}
    />
  );
};
