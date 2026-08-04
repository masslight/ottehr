import { alpha, Box } from '@mui/material';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateCalendar, LocalizationProvider, PickersDay, PickersDayProps } from '@mui/x-date-pickers-pro';
import { DateTime } from 'luxon';
import React, { useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';

// MUI 6's `DateRangeCalendar` has no month view and sizes its days differently from `DateCalendar`,
// so range selection is built on `DateCalendar` here instead. The switcher opens the first view.
const CALENDAR_VIEWS = ['month', 'day'] as const;

const BAND_START = { borderTopLeftRadius: '50%', borderBottomLeftRadius: '50%' } as const;
const BAND_END = { borderTopRightRadius: '50%', borderBottomRightRadius: '50%' } as const;

const IGNORE_HOVER = (): void => undefined;

type DayState = {
  /** Boundaries of the selection; `end` is null while it is still being picked. */
  start: DateTime | null;
  end: DateTime | null;
  /** Day under the cursor, which previews where the range would end. */
  hovered: DateTime | null;
  onHover: (day: DateTime | null) => void;
};

// Given by context because `slotProps.day` only accepts props of the day component it replaces.
const DayContext = React.createContext<DayState>({ start: null, end: null, hovered: null, onHover: IGNORE_HOVER });

/** Day cell that owns its own selected state, so the band and `aria-selected` always agree. */
const RangeDay: React.FC<PickersDayProps<DateTime>> = (dayProps) => {
  const { start, end, hovered, onHover } = React.useContext(DayContext);
  const { day, disabled, outsideCurrentMonth, isFirstVisibleCell, isLastVisibleCell } = dayProps;
  // Disabled days have `pointer-events: none`, so their hover lands on this wrapper instead: a day
  // that cannot be picked must not preview a range, and neither must a blank outside-month cell.
  const canPreview = !disabled && !outsideCurrentMonth;
  const isStart = start != null && day.hasSame(start, 'day');
  const isSelected = isStart || (end != null && day.hasSame(end, 'day'));
  // Until the end date is picked, the hovered day stands in for it as a preview.
  const bandEnd = end ?? hovered;
  // A single day needs no band, only its selected circle.
  const inBand =
    !outsideCurrentMonth &&
    start != null &&
    bandEnd != null &&
    !start.hasSame(bandEnd, 'day') &&
    day >= start.startOf('day') &&
    day <= bandEnd.startOf('day');
  const isPreview = inBand && end == null;

  return (
    <Box
      data-band={inBand ? (isPreview ? 'preview' : 'range') : undefined}
      onMouseEnter={() => onHover(canPreview ? day : null)}
      onMouseLeave={() => onHover(null)}
      // The day keeps its margins, so this wrapper spans the whole cell and consecutive bands touch.
      sx={(theme) => ({
        display: 'flex',
        ...(inBand && {
          backgroundColor: alpha(
            theme.palette.primary.main,
            isPreview ? theme.palette.action.hoverOpacity : theme.palette.action.focusOpacity
          ),
          ...((isStart || isFirstVisibleCell) && BAND_START),
          ...(((bandEnd != null && day.hasSame(bandEnd, 'day')) || isLastVisibleCell) && BAND_END),
          // Rounded where the week ends too, as MUI's own range calendar does.
          '&:first-of-type': BAND_START,
          '&:last-of-type': BAND_END,
        }),
      })}
    >
      <PickersDay {...dayProps} selected={isSelected} aria-selected={isSelected} />
    </Box>
  );
};

const DAY_SLOTS = { day: RangeDay } as const;

// Puts a stable test id on every day cell so tests can click a specific date directly.
const withDayTestId = (ownerState: { day: DateTime }): Record<string, string> => ({
  'data-testid': dataTestIds.dashboard.datePickerDay(ownerState.day.toISODate() ?? ''),
});

type Props = {
  /** The committed selection, shown as the highlighted day or range. */
  value: [DateTime | null, DateTime | null];
  /** When true, a start and an end date are picked before the selection is reported. */
  rangeMode: boolean;
  /** When set, an end date further than this many days from the start cannot be selected. */
  maxRangeDays?: number;
  /** Called once a complete selection has been picked; a single date reports the same day twice. */
  onComplete: (from: DateTime, to: DateTime) => void;
};

/**
 * Calendar behind the tracking board date filter. One click picks a day; in range mode the first
 * click stages a start and the second completes the range, so only complete ranges are reported.
 */
export const RangeCalendar: React.FC<Props> = ({ value: [dateFrom, dateTo], rangeMode, maxRangeDays, onComplete }) => {
  // Set while the end date is being picked; until then the committed range stays highlighted.
  const [pendingStart, setPendingStart] = useState<DateTime | null>(null);
  // The date the calendar is built around: what its month view and navigation work from.
  const [calendarDate, setCalendarDate] = useState<DateTime | null>(dateFrom);
  const [hovered, setHovered] = useState<DateTime | null>(null);

  // Leaving range mode drops transient selection state that must not affect a later range.
  useEffect(() => {
    setPendingStart(null);
    setHovered(null);
  }, [rangeMode]);

  const handleDayPick = (day: DateTime | null): void => {
    if (!day) {
      return;
    }
    if (!rangeMode) {
      onComplete(day, day);
      return;
    }
    // A click without a staged start — or before it — starts a fresh range instead of completing a
    // backwards one.
    if (pendingStart == null || day < pendingStart) {
      setPendingStart(day);
      setHovered(null);
      return;
    }
    onComplete(pendingStart, day);
  };

  // A staged start hides the committed end date: only the range being built is shown, previewed up
  // to the hovered day until the second click lands.
  const dayState: DayState =
    pendingStart != null
      ? { start: pendingStart, end: null, hovered, onHover: setHovered }
      : // Nothing to preview without a staged start, so hovering is not tracked at all.
        { start: dateFrom, end: dateTo, hovered: null, onHover: IGNORE_HOVER };

  return (
    <LocalizationProvider dateAdapter={AdapterLuxon}>
      <DayContext.Provider value={dayState}>
        <DateCalendar
          value={calendarDate}
          views={CALENDAR_VIEWS}
          openTo="day"
          // Keeps the month view and its navigation on the month actually displayed, whether it was
          // reached by the arrows or by picking a month.
          onMonthChange={setCalendarDate}
          onChange={(day, selectionState) => {
            // The month view reports 'partial': it navigates, it does not pick a date.
            if (selectionState === 'finish') {
              handleDayPick(day);
            }
          }}
          // While the end date is being picked, cap it so the range cannot exceed the server-side limit.
          maxDate={maxRangeDays != null && pendingStart != null ? pendingStart.plus({ days: maxRangeDays }) : undefined}
          slots={DAY_SLOTS}
          slotProps={{ day: withDayTestId }}
        />
      </DayContext.Provider>
    </LocalizationProvider>
  );
};
