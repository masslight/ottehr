import { Box, Button, DialogActions, Divider, Popover, TextField, TextFieldProps } from '@mui/material';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { CalendarIcon, PickersActionBarProps } from '@mui/x-date-pickers-pro';
import { DatePicker, DateRange, DateRangeCalendar, LocalizationProvider, RangePosition } from '@mui/x-date-pickers-pro';
import { DateTime } from 'luxon';
import { MouseEvent, ReactElement, ReactNode, useState } from 'react';
import { DISPLAY_DATE_FORMAT } from 'utils/lib/utils';

const RANGE_CALENDAR_SX = {
  '& .MuiPickersCalendarHeader-labelContainer': {
    cursor: 'default',
    '&::after': {
      borderLeft: '5px solid transparent',
      borderRight: '5px solid transparent',
      borderTop: '5px solid currentColor',
      content: '""',
      display: 'inline-block',
      marginLeft: 0.5,
    },
  },
  '& .MuiDateRangePickerDay-day': {
    transform: 'none !important',
    '& > *': {
      transform: 'none !important',
    },
  },
} as const;

const parseIsoDate = (value: string): DateTime | null => {
  if (!value) {
    return null;
  }
  const parsed = DateTime.fromISO(value);
  return parsed.isValid ? parsed : null;
};

export const dateDayTestId = (isoDate: string): string => `date-day-${isoDate}`;

const withDayTestId = (ownerState: { day: DateTime }): Record<string, string> => ({
  'data-testid': dateDayTestId(ownerState.day.toISODate() ?? ''),
});

interface SharedWrapperProps {
  label?: string;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  error?: boolean;
  helperText?: ReactNode | string;
  dataTestId?: string;
}

interface DateInputProps extends SharedWrapperProps {
  value: string;
  onChange: (value: string) => void;
}

interface DateRangeInputProps extends SharedWrapperProps {
  valueFrom: string;
  valueTo: string;
  onChange: (from: string, to: string) => void;
}

const DateInputWrapper = (props: DateInputProps | DateRangeInputProps): ReactElement => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [pendingRange, setPendingRange] = useState<DateRange<DateTime>>([null, null]);
  const [rangePosition, setRangePosition] = useState<RangePosition>('start');

  let singleDateValue: DateTime | null = null;
  let fromDateValue: DateTime | null = null;
  let toDateValue: DateTime | null = null;
  if ('value' in props) {
    singleDateValue = parseIsoDate(props.value);
  } else {
    fromDateValue = parseIsoDate(props.valueFrom);
    toDateValue = parseIsoDate(props.valueTo);
  }

  const openPicker = (event: MouseEvent<HTMLElement>): void => {
    if ('valueFrom' in props) {
      setPendingRange([fromDateValue, toDateValue]);
      setRangePosition('start');
    }
    setAnchorEl(event.currentTarget);
  };

  const closePicker = (): void => setAnchorEl(null);

  const commitRange = (from?: DateTime | null, to?: DateTime): void => {
    if ('value' in props) {
      props.onChange(from?.toISODate() ?? '');
    } else {
      props.onChange(from?.toISODate() ?? '', to?.toISODate() ?? '');
    }
  };

  const handleSingleChange = (value: DateTime | null): void => {
    if ('value' in props) {
      commitRange(value);
      closePicker();
    }
  };

  const handleRangeChange = (value: DateRange<DateTime>): void => {
    if ('valueFrom' in props) {
      if (rangePosition === 'start') {
        setPendingRange([value[0], null]);
        setRangePosition('end');
        return;
      }
      const [start, end] = value;
      if (start && end) {
        commitRange(start, end);
        closePicker();
      } else {
        setPendingRange(value);
      }
    }
  };

  const handleTodayClick = (): void => {
    const today = DateTime.now();
    commitRange(today, today);
    closePicker();
  };

  let displayValue: string;
  if ('value' in props) {
    displayValue = singleDateValue?.toFormat(DISPLAY_DATE_FORMAT) ?? '';
  } else {
    const fromText = fromDateValue?.toFormat(DISPLAY_DATE_FORMAT) ?? '';
    const toText = toDateValue?.toFormat(DISPLAY_DATE_FORMAT) ?? '';
    displayValue = fromText === toText ? fromText : `${fromText} - ${toText}`;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterLuxon}>
      {'value' in props ? (
        <DatePicker
          label={props.label}
          onChange={handleSingleChange}
          format={'MM/dd/yyyy'}
          slots={{ actionBar: DatePickerActionBar }}
          slotProps={{
            textField: {
              size: props.size ?? 'small',
              sx: { minWidth: 160 },
              'data-testid': props.dataTestId,
              fullWidth: props.fullWidth,
              error: props.error,
              helperText: props.helperText,
            } as TextFieldProps,
            actionBar: {
              actions: ['today'],
            },
          }}
          closeOnSelect
          value={singleDateValue}
        />
      ) : (
        <>
          <TextField
            label={props.label}
            value={displayValue}
            onClick={openPicker}
            size={props.size ?? 'small'}
            fullWidth={props.fullWidth}
            InputLabelProps={{ shrink: !!displayValue || anchorEl != null }}
            inputProps={{
              readOnly: true,
              'data-testid': props.dataTestId,
              sx: {
                cursor: 'pointer',
              },
            }}
            InputProps={{
              endAdornment: <CalendarIcon sx={{ color: 'action.active' }} />,
            }}
            sx={{
              minWidth: 260,
              '& .MuiInputBase-root': {
                cursor: 'pointer',
              },
            }}
          />
          <Popover
            open={anchorEl != null}
            anchorEl={anchorEl}
            onClose={closePicker}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
          >
            <DateRangeCalendar
              calendars={1}
              sx={RANGE_CALENDAR_SX}
              value={pendingRange}
              onChange={handleRangeChange}
              rangePosition={rangePosition}
              onRangePositionChange={setRangePosition}
              slotProps={{ day: withDayTestId }}
            />
            <DialogActions>
              <DatePickerActionBarContent onSetToday={handleTodayClick} />
            </DialogActions>
          </Popover>
        </>
      )}
    </LocalizationProvider>
  );
};

const DatePickerActionBar = (props: PickersActionBarProps): ReactElement => {
  return (
    <DialogActions className={props.className}>
      <DatePickerActionBarContent onSetToday={props.onSetToday} />
    </DialogActions>
  );
};

const DatePickerActionBarContent = (props: { onSetToday: () => void }): ReactElement => {
  return (
    <Box width={'100%'}>
      <Divider />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          px: 1,
          py: 0.5,
        }}
      >
        <Button size="small" onClick={props.onSetToday} data-testid="date-range-today-button">
          Today
        </Button>
      </Box>
    </Box>
  );
};

/**
 * Date input: one popover with a range calendar where the first click sets the start and the
 * second the end. Picking the same day for both windows a single day. Only complete ranges are
 * committed, so no intermediate (start, stale-end) pair ever triggers a fetch.
 */
export const DateInput = (props: DateInputProps): ReactElement => {
  return <DateInputWrapper {...props} />;
};

/**
 * Date-range filter: one popover with a range calendar where the first click sets the start and the
 * second the end. Picking the same day for both windows a single day. Only complete ranges are
 * committed, so no intermediate (start, stale-end) pair ever triggers a fetch.
 */
export const DateRangeInput = (props: DateRangeInputProps): ReactElement => {
  return <DateInputWrapper {...props} />;
};
