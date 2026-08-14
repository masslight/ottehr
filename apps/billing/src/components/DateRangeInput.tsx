import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Box, Button, Divider, Popover, TextField } from '@mui/material';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateRange, DateRangeCalendar, LocalizationProvider, RangePosition } from '@mui/x-date-pickers-pro';
import { DateTime } from 'luxon';
import { MouseEvent, ReactElement, useState } from 'react';
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

export const dateRangeDayTestId = (isoDate: string): string => `date-range-day-${isoDate}`;

const withDayTestId = (ownerState: { day: DateTime }): Record<string, string> => ({
  'data-testid': dateRangeDayTestId(ownerState.day.toISODate() ?? ''),
});

type Props = {
  label: string;
  valueFrom: string;
  valueTo: string;
  onChange: (from: string, to: string) => void;
  size?: 'small' | 'medium';
  dataTestId?: string;
};

/**
 * Date-range filter: one popover with a range calendar where the first click sets the start and the
 * second the end. Picking the same day for both windows a single day. Only complete ranges are
 * committed, so no intermediate (start, stale-end) pair ever triggers a fetch.
 */
export const DateRangeInput = ({ label, valueFrom, valueTo, onChange, size, dataTestId }: Props): ReactElement => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [pendingRange, setPendingRange] = useState<DateRange<DateTime>>([null, null]);
  const [rangePosition, setRangePosition] = useState<RangePosition>('start');

  const dateFrom = parseIsoDate(valueFrom);
  const dateTo = parseIsoDate(valueTo);

  const openPicker = (event: MouseEvent<HTMLElement>): void => {
    setPendingRange([dateFrom, dateTo]);
    setRangePosition('start');
    setAnchorEl(event.currentTarget);
  };

  const closePicker = (): void => setAnchorEl(null);

  const commitRange = (from: DateTime, to: DateTime): void => {
    onChange(from.toISODate() ?? '', to.toISODate() ?? '');
  };

  const handleRangeChange = (value: DateRange<DateTime>): void => {
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
  };

  const handleTodayClick = (): void => {
    const today = DateTime.now();
    commitRange(today, today);
    closePicker();
  };

  const fromText = dateFrom?.toFormat(DISPLAY_DATE_FORMAT) ?? '';
  const toText = dateTo?.toFormat(DISPLAY_DATE_FORMAT) ?? '';
  const displayValue = fromText === toText ? fromText : `${fromText} - ${toText}`;

  return (
    <>
      <TextField
        label={label}
        value={displayValue}
        onClick={openPicker}
        size={size ?? 'small'}
        InputLabelProps={{ shrink: !!displayValue || anchorEl != null }}
        inputProps={{
          readOnly: true,
          'data-testid': dataTestId,
          sx: {
            cursor: 'pointer',
          },
        }}
        InputProps={{
          endAdornment: <ArrowDropDownIcon sx={{ color: 'action.active' }} />,
        }}
        sx={{
          minWidth: 210,
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
        <LocalizationProvider dateAdapter={AdapterLuxon}>
          <DateRangeCalendar
            calendars={1}
            sx={RANGE_CALENDAR_SX}
            value={pendingRange}
            onChange={handleRangeChange}
            rangePosition={rangePosition}
            onRangePositionChange={setRangePosition}
            slotProps={{ day: withDayTestId }}
          />
        </LocalizationProvider>
        <Divider />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            px: 1,
            py: 0.5,
          }}
        >
          <Button size="small" onClick={handleTodayClick} data-testid="date-range-today-button">
            Today
          </Button>
        </Box>
      </Popover>
    </>
  );
};
