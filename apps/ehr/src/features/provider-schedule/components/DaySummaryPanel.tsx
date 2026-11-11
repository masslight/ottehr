import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useMemo } from 'react';
import { openTimeForDay } from 'utils/lib/provider-schedule/expand';
import { ScheduleBlockInstance, ScheduledAppointment } from 'utils/lib/provider-schedule/types';
import { formatTimeRange } from './calendarTime';
import { EffectiveVisitType } from './ProviderCalendar';

interface DaySummaryPanelProps {
  date: string;
  blocks: ScheduleBlockInstance[];
  appointments: ScheduledAppointment[];
  providerVisitTypes: EffectiveVisitType[];
  outsideCount: number;
}

const formatMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/** Booked vs open time for one day, and how many more of each visit type would still fit. */
export const DaySummaryPanel: FC<DaySummaryPanelProps> = ({
  date,
  blocks,
  appointments,
  providerVisitTypes,
  outsideCount,
}) => {
  const dayBlocks = useMemo(() => blocks.filter((b) => b.date === date), [blocks, date]);
  const dayAppts = useMemo(
    () => appointments.filter((a) => DateTime.fromISO(a.start, { setZone: true }).toISODate() === date),
    [appointments, date]
  );
  const open = useMemo(
    () => openTimeForDay(dayBlocks, dayAppts, providerVisitTypes),
    [dayBlocks, dayAppts, providerVisitTypes]
  );
  const active = dayAppts.filter((a) => a.status !== 'cancelled' && a.status !== 'no-show');
  const total = open.openMinutes + open.bookedMinutes;
  const pct = total ? Math.round((open.bookedMinutes / total) * 100) : 0;

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Typography variant="overline" color="text.secondary">
        {DateTime.fromISO(date).toFormat('cccc, LLL d')}
      </Typography>

      {dayBlocks.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          No schedule on this day.
        </Typography>
      ) : (
        <>
          <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {active.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                booked
              </Typography>
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {formatMinutes(open.openMinutes)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                open
              </Typography>
            </Box>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                {pct}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                utilized
              </Typography>
            </Box>
          </Stack>
          <Box
            role="img"
            aria-label={`${pct}% of bookable time is booked`}
            sx={{ mt: 1.5, height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}
          >
            <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: 'primary.main' }} />
          </Box>

          {outsideCount > 0 && (
            <Typography variant="body2" color="error.main" sx={{ mt: 1.5 }}>
              {outsideCount} appointment{outsideCount === 1 ? '' : 's'} in view fall outside the current schedule.
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Still bookable today
          </Typography>
          <Stack spacing={0.75}>
            {providerVisitTypes.map((vt) => {
              const n = open.openSlotsByVisitType[vt.id] ?? 0;
              return (
                <Box key={vt.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: vt.color, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ flexGrow: 1, color: n ? 'text.primary' : 'text.disabled' }}>
                    {vt.name}{' '}
                    <Typography component="span" variant="caption" color="text.secondary">
                      {vt.durationMinutes} min
                    </Typography>
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: n ? 'text.primary' : 'text.disabled' }}>
                    {n}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Each count assumes only that visit type is booked into the remaining gaps.
          </Typography>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Blocks
          </Typography>
          <Stack spacing={0.5}>
            {dayBlocks.map((b) => (
              <Box key={b.key} sx={{ display: 'flex', gap: 1 }}>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ width: 128, flexShrink: 0, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatTimeRange(b.start, b.end)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: b.kind === 'unavailable' ? 'text.secondary' : 'text.primary' }}
                >
                  {b.label}
                  {b.source.type === 'exception' && (
                    <Typography component="span" variant="caption" color="warning.dark">
                      {' '}
                      · one-off
                    </Typography>
                  )}
                </Typography>
              </Box>
            ))}
          </Stack>
        </>
      )}
    </Paper>
  );
};
