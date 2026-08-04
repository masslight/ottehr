import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { Box, Button, Checkbox, Divider, FormControlLabel, Popover, TextField } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useEffect, useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { RangeCalendar } from './RangeCalendar';

const DISPLAY_FORMAT = 'MM/dd/yyyy';

const INCOMPLETE_RANGE_MESSAGE = 'Both start and end dates are required.';
const RANGE_ORDER_MESSAGE = 'Start date must be on or before end date.';

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
 * writes it to both form fields). Checking "Date Range" keeps the same calendar but makes the next
 * two clicks pick a start and an end date. Selection itself lives in `RangeCalendar`; this component
 * owns the form fields, their validation, and the popover around it.
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
  const [session, setSession] = useState(0);

  const dateFrom = parseIsoDate(fromField.value);
  const dateTo = parseIsoDate(toField.value);
  const isMultiDayRange = Boolean(dateFrom && dateTo && !dateFrom.hasSame(dateTo, 'day'));

  // `reset()` (URL/localStorage seeding) does not run validation, so re-run it on value changes.
  useEffect(() => {
    void trigger(dateFromName);
  }, [fromField.value, toField.value, trigger, dateFromName]);

  const openPicker = (event: React.MouseEvent<HTMLElement>): void => {
    setRangeMode(isMultiDayRange);
    setSession((current) => current + 1);
    setAnchorEl(event.currentTarget);
  };

  const closePicker = (): void => setAnchorEl(null);

  const commitRange = (from: DateTime, to: DateTime): void => {
    fromField.onChange(from.toISODate());
    toField.onChange(to.toISODate());
  };

  const commitAndClose = (from: DateTime, to: DateTime): void => {
    commitRange(from, to);
    closePicker();
  };

  const handleRangeModeToggle = (checked: boolean): void => {
    setRangeMode(checked);
    if (!checked && dateFrom && isMultiDayRange) {
      // Collapsing back to single-date keeps the start date selected.
      commitRange(dateFrom, dateFrom);
    }
  };

  const handleTodayClick = (): void => {
    const today = DateTime.now();
    commitAndClose(today, today);
  };

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
        slotProps={{ paper: { 'data-testid': dataTestIds.dashboard.datePickerPopover } as Record<string, unknown> }}
      >
        <RangeCalendar
          key={session}
          value={[dateFrom, dateTo]}
          rangeMode={rangeMode}
          maxRangeDays={maxRangeDays}
          onComplete={commitAndClose}
        />
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
