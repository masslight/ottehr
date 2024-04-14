import { LocalizationProvider } from '@mui/x-date-pickers-pro';
import { DatePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { TextField } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { DateTime } from 'luxon';
import { useNavigate } from 'react-router-dom';

type CustomFormEventHandler = (event: React.FormEvent<HTMLFormElement>, value: any, field: string) => void;

interface DateSearchProps {
  date: DateTime | null;
  setDate: (dateTime: DateTime | null) => void;
  defaultValue?: string | null;
  updateURL?: boolean;
  storeDateInLocalStorage?: boolean;
  label?: string;
  queryParams?: URLSearchParams;
  required?: boolean;
  handleSubmit?: CustomFormEventHandler;
  small?: boolean;
  ageRange?: { min: number; max: number };
  setValidDate?: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function DateSearch({
  date,
  setDate,
  defaultValue,
  updateURL,
  storeDateInLocalStorage,
  label,
  queryParams,
  required,
  handleSubmit,
  small,
  ageRange,
  setValidDate,
}: DateSearchProps): ReactElement {
  const [error, setError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const searchDate = queryParams?.get('searchDate') || typeof date === 'object' ? date?.toISODate() : date;
  const navigate = useNavigate();
  useEffect(() => {
    if (updateURL && localStorage.getItem('selectedDate')) {
      queryParams?.set('searchDate', JSON.parse(localStorage.getItem('selectedDate') ?? '') ?? '');
      navigate(`?${queryParams?.toString()}`);
    }
  }, [navigate, queryParams, updateURL]);

  function ageIsInRange(date: DateTime, min: number, max: number): boolean {
    const age = Math.floor(-date.diffNow('years').years);
    return age >= min && age <= max;
  }

  const handleDatePickerChange = (date: DateTime | null, event: any): void => {
    if (typeof date === 'object' && date?.toISODate()) {
      if (ageRange && date) {
        if (!ageIsInRange(date, ageRange.min, ageRange.max)) {
          setErrorMessage(`Age must be between ${ageRange.min} and ${ageRange.max}`);
          setError(true);
          setDate(date);
          setValidDate && setValidDate(false);
          return;
        }
      }
      setError(false);
      setErrorMessage('');
      setDate(date);
      setValidDate && setValidDate(true);

      if (storeDateInLocalStorage) {
        if (date) {
          localStorage.setItem('selectedDate', JSON.stringify(date.toISODate()));
        } else {
          localStorage.removeItem('selectedDate');
        }
      }

      if (handleSubmit) {
        handleSubmit(event, date, 'date');
      }
    } else {
      setErrorMessage('please enter date in format MM/DD/YYYY');
      setError(true);
      setDate(date);
      setValidDate && setValidDate(false);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterLuxon}>
      <DatePicker
        label={label ?? 'Date'}
        onChange={handleDatePickerChange}
        inputFormat="MM/dd/yyyy"
        value={storeDateInLocalStorage ? (searchDate ? DateTime.fromISO(searchDate) : defaultValue) : date}
        renderInput={(params) => (
          <TextField
            style={{ width: '100%' }}
            name="date"
            id="appointment-date"
            label="Date"
            size={small ? 'small' : 'medium'}
            required={required}
            {...params}
            error={error}
            helperText={errorMessage}
          />
        )}
      />
    </LocalizationProvider>
  );
}
