import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers-pro';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { ReactElement, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataTestIds } from '../constants/data-test-ids';
import { TextFieldProps } from '@mui/material';

export type CustomFormEventHandler = (event: React.FormEvent<HTMLFormElement>, value: any, field: string) => void;

interface DateSearchProps {
  date: DateTime | null;
  setDate: (dateTime: DateTime | null) => void;
  defaultValue?: DateTime | null;
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
  setIsValidDate?: (isValid: boolean) => void;
  'data-testid'?: string;
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
  setIsValidDate: setValidDate,
  'data-testid': dataTestId,
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

  const handleDatePickerChange = (date: DateTime | null, event: any): void => {
    if (typeof date === 'object' && date?.toISODate()) {
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
        format={'MM/dd/yyyy'}
        slotProps={{
          textField: {
            style: { width: '100%' },
            required: required,
            error: error,
            helperText: errorMessage,
            name: 'date',
            id: 'appointment-date',
            label: label ?? 'Date',
            size: small ? 'small' : 'medium',
            'data-testid': dataTestId,
          } as TextFieldProps,
          actionBar: {
            actions: ['today'],
            // @ts-expect-error - that's valid field
            'data-testid': dataTestIds.dashboard.datePickerTodayButton,
          },
        }}
        closeOnSelect={closeOnSelect}
        disabled={disabled}
        shouldDisableDate={disableDates}
        value={storeDateInLocalStorage ? (searchDate ? DateTime.fromISO(searchDate) : defaultValue) : date}
      />
    </LocalizationProvider>
  );
}
