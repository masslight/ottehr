import { BoxProps, FormControl, FormLabel, TextFieldProps } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateRangePicker } from '@mui/x-date-pickers-pro';
import { FC } from 'react';
import { Controller, ControllerProps, useFormContext } from 'react-hook-form';

type DateRangePickerControllerProps = Pick<ControllerProps, 'name' | 'rules'> &
  Pick<TextFieldProps, 'variant'> &
  Pick<BoxProps, 'sx'> & { label?: string; separator?: string };

export const DateRangePickerController: FC<DateRangePickerControllerProps> = (props) => {
  const { name, rules, label, separator, variant, sx } = props;

  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: { onChange, value }, fieldState: { error: _ } }) => (
        <FormControl>
          {label && <FormLabel sx={{ fontSize: '12px', pb: 0.5 }}>{label}</FormLabel>}
          <LocalizationProvider dateAdapter={AdapterLuxon} localeText={{ start: undefined, end: undefined }}>
            <DateRangePicker
              value={value}
              sx={{ ...sx }}
              onChange={onChange}
              format="MM/dd/yyyy"
              slotProps={{
                fieldSeparator: { children: separator || 'to' },
                textField: {
                  style: { width: '100%' },
                  placeholder: 'MM.DD.YYYY',
                  size: 'small',
                  variant,
                },
              }}
            />
          </LocalizationProvider>
        </FormControl>
      )}
    />
  );
};
