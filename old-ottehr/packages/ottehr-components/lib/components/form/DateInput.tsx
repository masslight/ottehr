import { useFormContext } from 'react-hook-form';
import { IntakeThemeContext } from '../../contexts';
import { InputHelperText } from './InputHelperText';
import { FC, useContext } from 'react';
import DateInputFields from './DateInputFields';
import { Box, InputProps } from '@mui/material';

export type DateFieldMap = {
  day: string;
  month: string;
  year: string;
};

type DateInputProps = {
  name: string;
  fieldMap: DateFieldMap;
  label?: string;
  helperText?: string;
  showHelperTextIcon?: boolean;
  required?: boolean;
} & InputProps;

const DateInput: FC<DateInputProps> = ({ name, label, helperText, showHelperTextIcon, required, fieldMap }) => {
  const {
    formState: { errors },
    watch,
    setValue,
  } = useFormContext();
  const { otherColors } = useContext(IntakeThemeContext);

  const day = watch(fieldMap.day);
  const month = watch(fieldMap.month);
  const year = watch(fieldMap.year);

  return (
    <Box sx={{ padding: '10px', width: '100%' }} key={name}>
      <DateInputFields
        required={required}
        label={label}
        selectedDay={day ?? ''}
        selectedMonth={month ?? ''}
        selectedYear={year ?? ''}
        setSelectedMonth={(month) => {
          setValue(fieldMap.month, month);
        }}
        setSelectedDay={(day) => {
          setValue(fieldMap.day, day);
        }}
        setSelectedYear={(year) => {
          setValue(fieldMap.year, year);
        }}
        key={'DateInput'}
      />
      <InputHelperText
        textColor={otherColors.cancel}
        name={name}
        errors={errors}
        helperText={helperText}
        showHelperTextIcon={showHelperTextIcon}
        key={'helpertext'}
      />
    </Box>
  );
};

export default DateInput;
