import { DatePicker, DatePickerProps, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { Controller, ControllerProps, useFormContext } from 'react-hook-form';

type DatePickerControllerProps = Pick<ControllerProps, 'name' | 'rules'> &
  Pick<DatePickerProps<DateTime>, 'label' | 'format'> & { placeholder?: string };

export const DatePickerController: FC<DatePickerControllerProps> = (props) => {
  const { name, rules, label, format, placeholder } = props;

  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <LocalizationProvider dateAdapter={AdapterLuxon}>
          <DatePicker
            label={label}
            onChange={onChange}
            format={format}
            slotProps={{
              textField: {
                style: { width: '100%' },
                size: 'small',
                placeholder,
                helperText: error?.message,
                error: !!error,
              },
            }}
            value={value}
          />
        </LocalizationProvider>
      )}
    />
  );
};
