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
  const open = openingHour || day.open;
  let close = closingHour || day.close;
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
                  <TextField
                    type="number"
                    required
                    defaultValue={(() => {
                      const existing = day.hours.find((c) => c.hour === hour);
                      if (!existing) return 0;
                      if (isLocation) {
                        // Location: show prebook slots. Fall back to legacy
                        // `capacity` (which IS prebook slots under the implicit
                        // 15-min cadence assumption), so production data
                        // displays unchanged.
                        if (existing.prebookSlots !== undefined && existing.prebookSlots !== null) {
                          return existing.prebookSlots;
                        }
                        return existing.capacity ?? 0;
                      }
                      // Practitioner / Group: show provider capacity. Fall back
                      // to legacy capacity/4 for pre-migration data.
                      if (existing.providers !== undefined && existing.providers !== null) {
                        return existing.providers;
                      }
                      return existing.capacity ? existing.capacity / 4 : 0;
                    })()}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const value = Number(e.target.value) || 0;
                      const dayTemp = day;
                      const tempHours: Capacity[] = [];
                      for (let i = openingHour; i < close; i++) {
                        const existing = day.hours.find((h) => h.hour === i);
                        let prebookSlots: number | undefined = existing?.prebookSlots;
                        let providers: number | undefined = existing?.providers;
                        let capacity: number = existing?.capacity ?? 0;
                        if (hour === i) {
                          if (isLocation) {
                            prebookSlots = value;
                            // Back-populate legacy `capacity` with the same
                            // number — under the original 15-min semantic this
                            // IS prebook slots. Keeps un-migrated readers in
                            // sync. Clear `providers` to avoid ambiguity.
                            capacity = Math.round(value);
                            providers = undefined;
                          } else {
                            providers = value;
                            // Back-populate legacy `capacity` = providers × 4
                            // (bookings/hr at the old 15-min cadence).
                            capacity = Math.round(value * 4);
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
                      dayTemp.hours = tempHours;
                      setDay(dayTemp);
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      {/* )} */}
    </>
  );
};
