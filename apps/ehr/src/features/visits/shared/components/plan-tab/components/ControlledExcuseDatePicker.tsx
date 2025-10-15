import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { DateExcuseFields } from 'src/features/visits/telemed/utils/school-work-excuse.helper';

type ControlledExcuseDatePickerProps = {
  name: DateExcuseFields;
  validate?: (value: DateTime | null) => string | undefined;
};

export const ControlledExcuseDatePicker: FC<ControlledExcuseDatePickerProps> = (props) => {
  const { name, validate } = props;

  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      rules={{ validate }}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <LocalizationProvider dateAdapter={AdapterLuxon}>
          <DatePicker
            value={value}
            onChange={onChange}
            slotProps={{
              textField: {
                size: 'small',
                placeholder: 'MM/DD/YYYY',
                helperText: error ? error.message : null,
                error: !!error,
              },
            }}
            format="MM/dd/yyyy"
          />
        </LocalizationProvider>
      )}
    />
  );
};
