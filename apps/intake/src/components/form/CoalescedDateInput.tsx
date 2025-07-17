import { Box, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { DateTime } from 'luxon';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { months } from 'utils';
import { IntakeThemeContext } from '../../contexts';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';
import { InputHelperText } from './InputHelperText';

interface DateInputFieldProps {
  name: string;
  required?: boolean;
  label?: string;
  helperText?: string;
  showHelperTextIcon?: boolean;
  currentValue: string | undefined;
  defaultValue: string | undefined;
  readOnlyValue: string | undefined;
  setCurrentValue: (newVal: string | undefined) => void;
  disabled: boolean;
}

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const startYear = 1900;

const days = Array.from({ length: 31 }, (_, index) => {
  const day: number = index + 1;
  return { value: day < 10 ? `0${day}` : `${day}`, label: `${day}` };
});

const years = Array.from({ length: currentYear - startYear + 1 }, (_, index) => {
  const year: number = startYear + index;
  return { value: `${year}`, label: `${year}` };
}).reverse();

const CoalescedDateInput = ({
  name,
  required,
  currentValue,
  defaultValue,
  readOnlyValue,
  label,
  setCurrentValue,
  disabled,
  helperText,
  showHelperTextIcon,
}: DateInputFieldProps): JSX.Element => {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  useEffect(() => {
    if (currentValue === '') {
      setSelectedDay('');
      setSelectedMonth('');
      setSelectedYear('');
    } else {
      const [year, month, day] = (readOnlyValue ?? currentValue ?? defaultValue ?? '--').split('-');
      setSelectedDay(day);
      setSelectedMonth(month);
      setSelectedYear(year);
    }
  }, [currentValue, defaultValue, readOnlyValue]);

  const {
    formState: { errors },
  } = useFormContext();

  const { otherColors } = useContext(IntakeThemeContext);

  const coalescedDate = useMemo(() => {
    const isoString = `${selectedYear}-${selectedMonth}-${selectedDay}`;

    const parsedDate = DateTime.fromFormat(isoString, 'yyyy-MM-dd');
    if (!parsedDate.isValid) {
      return isoString;
    }

    return parsedDate.toFormat('yyyy-MM-dd');
  }, [selectedDay, selectedMonth, selectedYear]);

  useEffect(() => {
    if (coalescedDate === '--' && currentValue === '--') {
      setCurrentValue('');
    }
    if (coalescedDate !== '--' && currentValue !== coalescedDate && currentValue !== '--') {
      setCurrentValue(coalescedDate);
    }
  }, [currentValue, coalescedDate, setCurrentValue]);

  return (
    <Box sx={{ paddingBottom: '10px' }}>
      <BoldPurpleInputLabel required={required} shrink>
        {label ?? 'Date of birth'}
      </BoldPurpleInputLabel>
      <div style={{ width: '100%', display: 'flex', gap: '10px' }}>
        <FormControl required={required} sx={{ width: '150px' }}>
          <InputLabel>Month</InputLabel>
          <Select
            disabled={disabled || !!readOnlyValue}
            label="Month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {months.map((month) => (
              <MenuItem key={month.value} value={month.value}>
                {month.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl required={required} sx={{ width: '150px' }}>
          <InputLabel>Day</InputLabel>
          <Select
            disabled={disabled || !!readOnlyValue}
            label="Day"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
          >
            {days.map((day) => (
              <MenuItem key={day.value} value={day.value}>
                {day.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl required={required} sx={{ width: '150px' }}>
          <InputLabel>Year</InputLabel>
          <Select
            disabled={disabled || !!readOnlyValue}
            label="Year"
            value={selectedYear}
            onChange={(e: any) => setSelectedYear?.(e.target.value)}
          >
            {years.map((year) => (
              <MenuItem key={year.value} value={year.value}>
                {year.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>
      <InputHelperText
        textColor={otherColors.cancel}
        name={name}
        errors={errors}
        helperText={helperText}
        showHelperTextIcon={showHelperTextIcon}
      />
    </Box>
  );
};

export default CoalescedDateInput;
