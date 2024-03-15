import { Dispatch, SetStateAction } from 'react';
import { Select, MenuItem, InputLabel, FormControl, Grid } from '@mui/material';
import { months } from 'ottehr-utils';
import { BoldPurpleInputLabel } from './BoldPurpleInputLabel';

interface DateInputFieldProps {
  required?: boolean;
  label?: string;
  selectedMonth: string;
  selectedDay: string;
  selectedYear: string;
  setSelectedMonth: Dispatch<SetStateAction<string>>;
  setSelectedYear: Dispatch<SetStateAction<string>>;
  setSelectedDay: Dispatch<SetStateAction<string>>;
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

const DateInputFields = ({
  required,
  selectedMonth,
  selectedDay,
  selectedYear,
  label,
  setSelectedMonth,
  setSelectedYear,
  setSelectedDay,
}: DateInputFieldProps): JSX.Element => {
  return (
    <FormControl required={required} sx={{ width: '100%' }}>
      <BoldPurpleInputLabel shrink>{label}</BoldPurpleInputLabel>
      <Grid container mt={1} spacing={1}>
        <Grid item md={4} xs={12}>
          <FormControl required={required} sx={{ width: '100%' }}>
            <InputLabel>Month</InputLabel>
            <Select label="Month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              {months.map((month) => (
                <MenuItem key={`month-${month.value}`} value={month.value}>
                  {month.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item md={4} xs={12}>
          <FormControl required={required} sx={{ width: '100%' }}>
            <InputLabel>Day</InputLabel>
            <Select label="Day" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)}>
              {days.map((day) => (
                <MenuItem key={`day-${day.value}`} value={day.value}>
                  {day.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item md={4} xs={12}>
          <FormControl required={required} sx={{ width: '100%' }}>
            <InputLabel>Year</InputLabel>
            <Select label="Year" value={selectedYear} onChange={(e: any) => setSelectedYear?.(e.target.value)}>
              {years.map((year) => (
                <MenuItem key={`year-${year.value}`} value={year.value}>
                  {year.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </FormControl>
  );
};

export default DateInputFields;
