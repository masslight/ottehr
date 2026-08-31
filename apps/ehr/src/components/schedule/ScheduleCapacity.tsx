import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Box, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import React from 'react';
import { formatHourNumber } from '../../helpers/formatDateTime';
import { Capacity, Day, HourOfDay } from '../../types/types';

interface ScheduleCapacityProps {
  day: Day;
  setDay: (dayTemp: Day) => void;
  openingHour: number;
  closingHour: number;
  openingBuffer: number;
  closingBuffer: number;
  /**
   * Owner resource type of the Schedule being edited. Drives the capacity-cell
   * semantics:
   *   - 'Location': "Prebook Slots" — integer, demand cap. Stored on
   *     `Capacity.prebookSlots`.
   *   - other (Practitioner, HealthcareService): "Provider Capacity" — supports
   *     decimals. Stored on `Capacity.providers`.
   */
  ownerType?: string;
}

interface CapacityCellProps {
  hour: number;
  day: Day;
  setDay: (day: Day) => void;
  isLocation: boolean;
  inputStep: number;
  openingHour: number;
  close: number;
}

// Reads the canonical capacity value for a given hour off the day model.
// Mirrors the resolution precedence used everywhere else (prebookSlots →
// capacity for Locations; providers → capacity/4 for everything else).
const canonicalCapacityForHour = (day: Day, hour: number, isLocation: boolean): number => {
  const existing = day.hours.find((c) => c.hour === hour);
  if (!existing) return 0;
  if (isLocation) {
    if (existing.prebookSlots !== undefined && existing.prebookSlots !== null) {
      return existing.prebookSlots;
    }
    return existing.capacity ?? 0;
  }
  if (existing.providers !== undefined && existing.providers !== null) {
    return existing.providers;
  }
  return existing.capacity ? existing.capacity / 4 : 0;
};

// Per-hour capacity input. Local raw-string state lets the user type partial
// decimals like "1." without the controlled-number-input gotcha where the
// in-progress string gets parsed away (`Number("1.")` === 1, would erase the
// dot). The parsed number is committed to the parent on every change so the
// model stays in sync. A focused input is never overwritten by an upstream
// re-render — re-sync from canonical only happens while the field is blurred
// (e.g., the schedule was reloaded from the server while the user was
// elsewhere on the page).
const CapacityCell: React.FC<CapacityCellProps> = ({
  hour,
  day,
  setDay,
  isLocation,
  inputStep,
  openingHour,
  close,
}) => {
  const canonicalValue = canonicalCapacityForHour(day, hour, isLocation);
  const [rawValue, setRawValue] = React.useState<string>(String(canonicalValue));
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Tracks the value this cell last submitted upstream. The effect uses it
  // to distinguish "canonical came back to confirm my own edit" (skip) from
  // "canonical changed because of an external update — server refetch,
  // sibling edit" (sync). Without this, a stepper click that briefly
  // shifts focus around can race the effect into resetting rawValue to a
  // stale canonical before the upstream update commits.
  const lastSubmittedRef = React.useRef<number>(canonicalValue);

  React.useEffect(() => {
    if (canonicalValue === lastSubmittedRef.current) return;
    if (document.activeElement !== inputRef.current) {
      setRawValue(String(canonicalValue));
    }
  }, [canonicalValue]);

  return (
    <TextField
      inputRef={inputRef}
      type="number"
      required
      value={rawValue}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const next = e.target.value;
        setRawValue(next);
        const parsed = Number(next);
        if (!Number.isFinite(parsed)) return;
        // Locations round to int (back-populates legacy capacity below);
        // record the value upstream will actually persist so the resync
        // effect's equality check matches what canonical comes back as.
        lastSubmittedRef.current = isLocation ? Math.round(parsed) : parsed;
        // Build a fresh hours array (immutable) — re-using `day`'s reference
        // here makes upstream `setDays(sameRef)` calls no-op via React's
        // Object.is bail, which manifests as edits silently failing to render.
        const tempHours: Capacity[] = [];
        for (let i = openingHour; i < close; i++) {
          const existing = day.hours.find((h) => h.hour === i);
          let prebookSlots: number | undefined = existing?.prebookSlots;
          let providers: number | undefined = existing?.providers;
          let capacity: number = existing?.capacity ?? 0;
          if (hour === i) {
            if (isLocation) {
              // Locations store an integer prebook slot count; manual typing
              // can still produce decimals, so round once and use the same
              // value for both fields to keep the extension internally
              // consistent. Back-populates legacy `capacity` to keep
              // un-migrated readers in sync. Clear `providers` to avoid
              // ambiguity.
              const intParsed = Math.round(parsed);
              prebookSlots = intParsed;
              capacity = intParsed;
              providers = undefined;
            } else {
              providers = parsed;
              // Back-populate legacy `capacity` = providers × 4
              // (bookings/hr at the old 15-min cadence).
              capacity = Math.round(parsed * 4);
              prebookSlots = undefined;
            }
          }
          tempHours.push({
            hour: i as HourOfDay,
            capacity,
            ...(providers !== undefined ? { providers } : {}),
            ...(prebookSlots !== undefined ? { prebookSlots } : {}),
          });
        }
        setDay({ ...day, hours: tempHours });
      }}
      onBlur={() => {
        // Locations persist an integer (prebookSlots). If the user typed a
        // decimal like "1.2" the upstream value was already rounded to 1 in
        // onChange — match the display on blur so the input doesn't keep
        // showing a value that was never saved. Don't run during typing
        // (would prevent entering multi-digit ints since "1" → "1" → "12"
        // is fine but mid-decimal "1." would be eaten).
        if (!isLocation) return;
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed)) return;
        const rounded = Math.round(parsed);
        if (String(rounded) !== rawValue) setRawValue(String(rounded));
      }}
      sx={{ width: '120px' }}
      InputProps={{
        inputProps: {
          min: 0,
          step: inputStep,
        },
      }}
      size="small"
    />
  );
};

export const ScheduleCapacity: React.FC<ScheduleCapacityProps> = ({
  day,
  setDay,
  openingHour,
  closingHour,
  openingBuffer,
  closingBuffer,
  ownerType,
}) => {
  const isLocation = ownerType === 'Location';
  const columnLabel = isLocation ? 'Available Pre-book Slots' : 'Provider Capacity';
  const columnCaption = isLocation
    ? 'Prebook appointments offered this hour. Can be lower than physical capacity if walk-ins are expected.'
    : 'Concurrent provider coverage. Supports decimals (e.g. 1.5 = one full + one half-time).';
  const inputStep = isLocation ? 1 : 0.5;
  // Use `??` so an explicit 0 (midnight) from the prop is preserved instead
  // of falling back to day.open / day.close. The close===0 special-case
  // remains: the underlying data model uses 0 to mean "midnight next day"
  // (= 24) for close, distinct from open=0 (midnight start).
  const open = openingHour ?? day.open;
  let close = closingHour ?? day.close;
  close = close === 0 && open !== 0 ? 24 : close;

  // create a list of all times in 1 hour increments between open and close
  const openHours = React.useMemo(() => {
    const times = [];
    for (let i = open; i < close; i++) {
      times.push(i);
    }
    return times;
  }, [open, close]);

  return (
    <>
      <Box>
        <Table>
          <TableHead>
            <TableRow key="headRow">
              <TableCell sx={{ fontWeight: 'bold' }}>Hour</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '70%' }}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                  {columnLabel}
                  <Tooltip title={columnCaption} placement="top" arrow>
                    <InfoOutlinedIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'help' }} />
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {openHours.map((hour, index) => (
              <TableRow key={hour}>
                <TableCell sx={{ fontSize: '16px' }}>
                  {`${formatHourNumber(hour)} - ${formatHourNumber(hour + 1)}`}
                  {index === 0 && (
                    <Typography variant="body2">{`Opening buffer ${
                      openingBuffer ?? day.openingBuffer ?? '-'
                    } minutes`}</Typography>
                  )}
                  {index === openHours.length - 1 && (
                    <Typography variant="body2">{`Closing buffer ${
                      closingBuffer ?? day.closingBuffer ?? '-'
                    } minutes`}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <CapacityCell
                    hour={hour}
                    day={day}
                    setDay={setDay}
                    isLocation={isLocation}
                    inputStep={inputStep}
                    openingHour={openingHour}
                    close={close}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </>
  );
};
