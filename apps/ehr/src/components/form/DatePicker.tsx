import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Box, InputLabelProps } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs from 'dayjs';
import { Control, Controller } from 'react-hook-form';

interface BasicDatePickerProps {
  name: string;
  control: Control<any>;
  required?: boolean;
  defaultValue?: string;
  onChange?: (date: string) => void;
  disabled?: boolean;
  variant?: 'standard' | 'outlined' | 'filled';
  label?: string;
  InputLabelProps?: InputLabelProps;
  id?: string;
}

export function BasicDatePicker({
  name,
  control,
  required,
  defaultValue,
  onChange,
  disabled,
  variant = 'standard',
  label,
  InputLabelProps,
  id,
}: BasicDatePickerProps): JSX.Element {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={{ width: '100%' }}>
        <Controller
          name={name}
          control={control}
          defaultValue={defaultValue || ''}
          rules={{ required: required }}
          render={({ field, fieldState: { error } }) => (
            <DatePicker
              value={field.value ? dayjs(field.value) : null}
              onChange={(newValue) => {
                const dateStr = newValue ? newValue.format('YYYY-MM-DD') : '';
                field.onChange(dateStr);
                onChange?.(dateStr);
              }}
              onClose={() => {
                field.onBlur();
              }}
              disabled={disabled}
              sx={{ width: '100%', scrollbarWidth: 'none' }}
              slots={{
                openPickerIcon: ArrowDropDownIcon,
              }}
              slotProps={{
                textField: {
                  id: id,
                  variant,
                  error: !!error,
                  helperText: error?.message,
                  onBlur: () => {
                    field.onBlur();
                  },
                  required,
                  InputLabelProps,
                },
                openPickerButton: {
                  sx: {
                    padding: 0,
                    marginRight: 0,
                  },
                },
              }}
              label={label}
            />
          )}
        />
      </Box>
    </LocalizationProvider>
  );
}
