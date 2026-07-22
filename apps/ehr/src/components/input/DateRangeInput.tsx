import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Box, Button, Checkbox, Divider, FormControlLabel, Popover, TextField } from '@mui/material';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import {
  DateCalendar,
  DateRange,
  DateRangeCalendar,
  LocalizationProvider,
  RangePosition,
} from '@mui/x-date-pickers-pro';
import { DateTime } from 'luxon';
import React, { useEffect, useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';

const DISPLAY_FORMAT = 'MM/dd/yyyy';

const INCOMPLETE_RANGE_MESSAGE = 'Both start and end dates are required.';
const RANGE_ORDER_MESSAGE = 'Start date must be on or before end date.';

// MUI's range calendar omits the standard month indicator and scales its day buttons to overlap
// the range-preview border. Restore the shared visual treatment without changing range behavior,
// colors, or the calendar's reserved six-week height.
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

// Both sides parse in UTC so the day count is deterministic (24h/day) and matches how the
// get-appointments zambda validates its cap server-side.
const exceedsMaxRange = (dateFrom: string, dateTo: string, maxRangeDays: number): boolean =>
  DateTime.fromISO(dateTo, { zone: 'utc' }).diff(DateTime.fromISO(dateFrom, { zone: 'utc' }), 'days').days >
  maxRangeDays;

const parseIsoDate = (value: unknown): DateTime | null => {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  const parsed = DateTime.fromISO(value);
  return parsed.isValid ? parsed : null;
};

// Puts a stable test id on every day cell so tests can click a specific date directly.
const withDayTestId = (ownerState: { day: DateTime }): Record<string, string> => ({
  'data-testid': dataTestIds.dashboard.datePickerDay(ownerState.day.toISODate() ?? ''),
});

type Props = {
  /** Form field names holding the range boundaries as ISO dates (yyyy-MM-dd). */
  dateFromName: string;
  dateToName: string;
  label: string;
  size?: 'small' | 'medium';
  dataTestId?: string;
  /** When set, an end date further than this many days from the start cannot be selected. */
  maxRangeDays?: number;
};

/**
 * Date filter that defaults to single-date selection (the common case: one click picks a day and
 * writes it to both form fields). Checking "Date Range" switches the same popover to a one-month
 * range calendar where the user picks a start and an end date; only complete ranges are committed
 * to the form, so no intermediate (start, stale-end) pair ever triggers a fetch.
 */
export const DateRangeInput: React.FC<Props> = ({
  dateFromName,
  dateToName,
  label,
  size,
  dataTestId,
  maxRangeDays,
}) => {
  const { getValues, trigger } = useFormContext();
  const {
    field: fromField,
    fieldState: { error },
  } = useController({
    name: dateFromName,
    rules: {
      // The picker itself only commits valid complete ranges; this guards values seeded from the
      // URL so a bad link shows an inline error instead of a silently stale board.
      validate: (value: string | null) => {
        const dateTo = getValues(dateToName) as string | null;
        if (!value && !dateTo) {
          return true;
        }
        if (!value || !dateTo) {
          return INCOMPLETE_RANGE_MESSAGE;
        }
        if (value > dateTo) {
          return RANGE_ORDER_MESSAGE;
        }
        if (maxRangeDays != null && exceedsMaxRange(value, dateTo, maxRangeDays)) {
          return `Date range must not exceed ${maxRangeDays} days.`;
        }
        return true;
      },
    },
  });
  const { field: toField } = useController({ name: dateToName });

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [rangeMode, setRangeMode] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange<DateTime>>([null, null]);
  const [rangePosition, setRangePosition] = useState<RangePosition>('start');

  const dateFrom = parseIsoDate(fromField.value);
  const dateTo = parseIsoDate(toField.value);
  const isMultiDayRange = Boolean(dateFrom && dateTo && !dateFrom.hasSame(dateTo, 'day'));

  // `reset()` (URL/localStorage seeding) does not run validation, so re-run it on value changes.
  useEffect(() => {
    void trigger(dateFromName);
  }, [fromField.value, toField.value, trigger, dateFromName]);

  const openPicker = (event: React.MouseEvent<HTMLElement>): void => {
    setRangeMode(isMultiDayRange);
    setPendingRange([dateFrom, dateTo]);
    setRangePosition('start');
    setAnchorEl(event.currentTarget);
  };

  const closePicker = (): void => setAnchorEl(null);

  const commitRange = (from: DateTime, to: DateTime): void => {
    fromField.onChange(from.toISODate());
    toField.onChange(to.toISODate());
  };

  const handleRangeModeToggle = (checked: boolean): void => {
    setRangeMode(checked);
    setPendingRange([dateFrom, dateTo]);
    setRangePosition('start');
    if (!checked && dateFrom && isMultiDayRange) {
      // Collapsing back to single-date keeps the start date selected.
      commitRange(dateFrom, dateFrom);
    }
  };

  const handleRangeChange = (value: DateRange<DateTime>): void => {
    // The first click always starts a fresh range: the calendar would otherwise merge the clicked
    // day with the previous end date into a complete — but unintended — range and fetch it.
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

  // While the end date is being picked, cap it so the range cannot exceed the server-side limit.
  const rangeEndLimit =
    maxRangeDays != null && rangePosition === 'end' && pendingRange[0] && !pendingRange[1]
      ? pendingRange[0].plus({ days: maxRangeDays })
      : undefined;

  const fromText = dateFrom?.toFormat(DISPLAY_FORMAT) ?? '';
  const toText = dateTo?.toFormat(DISPLAY_FORMAT) ?? '';
  const displayValue = fromText === toText ? fromText : `${fromText} – ${toText}`;

  return (
    <>
      <TextField
        label={label}
        value={displayValue}
        onClick={openPicker}
        size={size ?? 'small'}
        fullWidth
        error={error != null}
        helperText={error?.message}
        inputProps={{ readOnly: true, 'data-testid': dataTestId, sx: { cursor: 'pointer' } }}
        InputProps={{ endAdornment: <ArrowDropDownIcon sx={{ color: 'action.active' }} /> }}
        sx={{ '& .MuiInputBase-root': { cursor: 'pointer' } }}
      />
      <Popover
        open={anchorEl != null}
        anchorEl={anchorEl}
        onClose={closePicker}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <LocalizationProvider dateAdapter={AdapterLuxon}>
          {rangeMode ? (
            <DateRangeCalendar
              calendars={1}
              sx={RANGE_CALENDAR_SX}
              value={pendingRange}
              onChange={handleRangeChange}
              rangePosition={rangePosition}
              onRangePositionChange={setRangePosition}
              maxDate={rangeEndLimit}
              slotProps={{ day: withDayTestId }}
            />
          ) : (
            <DateCalendar
              value={dateFrom}
              onChange={(day: DateTime | null) => {
                if (day) {
                  commitRange(day, day);
                  closePicker();
                }
              }}
              slotProps={{ day: withDayTestId }}
            />
          )}
        </LocalizationProvider>
        <Divider />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.5 }}>
          <FormControlLabel
            sx={{ ml: 0 }}
            control={
              <Checkbox
                checked={rangeMode}
                onChange={(event) => handleRangeModeToggle(event.target.checked)}
                inputProps={{ 'data-testid': dataTestIds.dashboard.dateRangeModeCheckbox } as Record<string, unknown>}
              />
            }
            label="Date Range"
          />
          <Button size="small" onClick={handleTodayClick} data-testid={dataTestIds.dashboard.datePickerTodayButton}>
            Today
          </Button>
        </Box>
      </Popover>
    </>
  );
};
