import { useContext, useEffect, useMemo, useState } from 'react';
import { Select, MenuItem, InputLabel, FormControl, Box } from '@mui/material';
import { months } from 'ottehr-utils';
import { DateTime } from 'luxon';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';
import { useFormContext } from 'react-hook-form';
import { InputHelperText } from './InputHelperText';
import { IntakeThemeContext } from '../../contexts';

interface DateInputFieldProps {
  name: string;
  required?: boolean;
  label?: string;
  currentValue: string | undefined;
  defaultValue: string | undefined;
  setCurrentValue: (newVal: string | undefined) => void;
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
  label,
  setCurrentValue,
}: DateInputFieldProps): JSX.Element => {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');

  useEffect(() => {
    // console.log('current value, default value', currentValue, defaultValue);
    const [year, month, day] = (currentValue ?? defaultValue ?? '--').split('-');
    setSelectedDay(day);
    setSelectedMonth(month);
    setSelectedYear(year);
  }, [currentValue, defaultValue]);

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
    if (coalescedDate !== '--' && currentValue !== coalescedDate) {
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
          <Select label="Month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {months.map((month) => (
              <MenuItem key={month.value} value={month.value}>
                {month.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl required={required} sx={{ width: '150px' }}>
          <InputLabel>Day</InputLabel>
          <Select label="Day" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
            {days.map((day) => (
              <MenuItem key={day.value} value={day.value}>
                {day.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl required={required} sx={{ width: '150px' }}>
          <InputLabel>Year</InputLabel>
          <Select label="Year" value={selectedYear} onChange={(e: any) => setSelectedYear?.(e.target.value)}>
            {years.map((year) => (
              <MenuItem key={year.value} value={year.value}>
                {year.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>
      <InputHelperText textColor={otherColors.cancel} name={name} errors={errors} />
    </Box>
  );
};

export default CoalescedDateInput;
