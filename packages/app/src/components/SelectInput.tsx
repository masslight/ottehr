import { ExpandMore } from '@mui/icons-material';
import { FormControl, MenuItem, Select, SelectProps, useTheme } from '@mui/material';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { otherColors } from '../OttehrThemeProvider';
import { findLabelFromOptions } from '../helpers';
import { BoldPrimaryInputLabel } from './BoldPrimaryInputLabel';
import { InputHelperText } from './InputHelperText';
import { RenderLabelFromSelect } from './RenderLabelFromSelect';

export interface SelectInputOption {
  value: string;
  label: string;
}

type SelectInputProps = {
  name: string;
  label: string;
  options: SelectInputOption[];
  helperText?: string;
  placeholder?: string;
} & SelectProps;

export const SelectInput: FC<SelectInputProps> = ({
  name,
  label,
  defaultValue,
  options,
  helperText,
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
      name={name}
      control={control}
      defaultValue={defaultValue || ''}
      render={({ field }) => (
        <FormControl
          variant="standard"
          required={otherProps.required}
          error={!!errors[name]}
          sx={{
            width: '100%',
          }}
        >
          <BoldPrimaryInputLabel id={`${name}-label`} shrink>
            {label}
          </BoldPrimaryInputLabel>
          <Select
            labelId={`${name}-label`}
            IconComponent={ExpandMore}
            displayEmpty
            {...field}
            {...otherProps}
            disableUnderline
            // To stop it adding a padding-right on the main element, shifting the background image
            MenuProps={{ disableScrollLock: true, PaperProps: { style: { maxHeight: 400 } } }}
            sx={{
              '& .MuiInputBase-input': {
                borderRadius: '8px',
                backgroundColor: theme.palette.background.paper,
                border: '1px solid',
                borderColor: otherColors.lightGray,
                padding: '10px 26px 10px 12px',
                '&:focus': {
                  borderRadius: '8px',
                  backgroundColor: theme.palette.background.paper,
                },
              },
              '& .MuiSelect-icon': {
                marginRight: '10px',
              },
              '& .MuiSelect-iconOpen': {
                marginRight: '10px',
              },
            }}
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
          >
            {options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
          <InputHelperText name={name} errors={errors} helperText={helperText} />
        </FormControl>
      )}
    />
  );
};
