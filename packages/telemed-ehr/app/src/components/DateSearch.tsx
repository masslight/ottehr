import { TextField } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers-pro';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { ReactElement, useEffect, useState } from 'react';
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
  disabled?: boolean;
  disableDates?: (day: DateTime) => boolean;
  closeOnSelect?: boolean;
  handleSubmit?: CustomFormEventHandler;
  small?: boolean;
  ageRange?: { min: number; max: number };
  setIsValidDate?: (isValid: boolean) => void;
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
  disabled,
  disableDates,
  closeOnSelect,
  handleSubmit,
  small,
  ageRange,
  setIsValidDate: setValidDate,
}: DateSearchProps): ReactElement {
  const [error, setError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const formatDate = typeof date === 'object' ? date?.toISODate() : date;
  const searchDate = queryParams?.get('searchDate') || formatDate;
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
        closeOnSelect={closeOnSelect}
        componentsProps={{
          actionBar: { actions: ['today'] },
        }}
        disabled={disabled}
        shouldDisableDate={disableDates}
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
