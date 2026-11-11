import { Autocomplete, Box, Chip, CircularProgress, Popover, Stack, TextField, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, ReactElement, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import useEvolveUser from 'src/hooks/useEvolveUser';
import PageContainer from 'src/layout/PageContainer';
import { isAppointmentOutsideSchedule } from 'utils/lib/provider-schedule/expand';
import { ScheduledAppointment, ScheduleProvider } from 'utils/lib/provider-schedule/types';
import { ADMIN_TIER_ROLES } from 'utils/lib/types/api/user.types';
import { formatTimeRange, todayIn } from '../components/calendarTime';
import { DaySummaryPanel } from '../components/DaySummaryPanel';
import { appointmentStatusLabel, CalendarView, ProviderCalendar } from '../components/ProviderCalendar';
import {
  useExpandedSchedule,
  useProviderAppointments,
  useProviderScheduleConfig,
  useScheduleLocations,
  useScheduleProviders,
  useScheduleVisitTypes,
} from '../hooks/useProviderSchedule';

const VIEWS: CalendarView[] = ['day', 'week', 'month'];

export const providerLabel = (p: ScheduleProvider): string => `${p.name}${p.credentials ? `, ${p.credentials}` : ''}`;

/**
 * A provider's day / week / month. Blocks from their template show as shaded bands behind
 * appointments; the side panel summarizes the focused day.
 */
export const ProviderSchedulePage: FC = () => {
  const [params, setParams] = useSearchParams();
  const user = useEvolveUser();
  const isAdmin = Boolean(user?.hasRole(ADMIN_TIER_ROLES));

  const providersQuery = useScheduleProviders();
  const locationsQuery = useScheduleLocations();
  const visitTypesQuery = useScheduleVisitTypes();

  const providers = providersQuery.data ?? [];
  // TODO(real API): default to the signed-in provider's PractitionerRole.
  const providerId = params.get('provider') ?? providers[0]?.id;
  const provider = providers.find((p) => p.id === providerId);
  const location = locationsQuery.data?.find((l) => provider?.locationIds.includes(l.id));
  const timezone = location?.timezone ?? 'America/New_York';

  const viewParam = params.get('view') as CalendarView | null;
  const view: CalendarView = viewParam && VIEWS.includes(viewParam) ? viewParam : 'week';
  const date = params.get('date') ?? todayIn(timezone);

  const [range, setRange] = useState<{ startDate: string; endDate: string }>();
  const configQuery = useProviderScheduleConfig(providerId);
  const appointmentsQuery = useProviderAppointments(providerId, range?.startDate, range?.endDate);
  const { blocks, providerVisitTypes } = useExpandedSchedule(
    configQuery.data,
    visitTypesQuery.data,
    range?.startDate,
    range?.endDate
  );
  const appointments = useMemo(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);

  const outsideCount = useMemo(() => {
    const enabled = providerVisitTypes.map((v) => v.id);
    return appointments.filter((a) => isAppointmentOutsideSchedule(a, blocks, enabled)).length;
  }, [appointments, blocks, providerVisitTypes]);

  const [popover, setPopover] = useState<{ appointment: ScheduledAppointment; anchor: HTMLElement }>();

  const update = (next: Record<string, string>): void => {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => merged.set(k, v));
    setParams(merged, { replace: true });
  };

  const loading = providersQuery.isLoading || visitTypesQuery.isLoading || configQuery.isLoading;
  const summaryDate =
    view === 'day' ? date : range && date >= range.startDate && date <= range.endDate ? date : range?.startDate ?? date;

  return (
    <PageContainer tabTitle="Schedule">
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Typography variant="h3" color="primary.dark" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Schedule
          </Typography>
          <Autocomplete
            size="small"
            sx={{ width: 280 }}
            options={providers}
            loading={providersQuery.isLoading}
            value={provider ?? null}
            getOptionLabel={providerLabel}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, p) => p && update({ provider: p.id })}
            disableClearable={Boolean(provider)}
            renderInput={(props) => <TextField {...props} label="Provider" />}
          />
          {location && (
            <Typography variant="body2" color="text.secondary">
              {location.name} · {DateTime.now().setZone(timezone).toFormat('ZZZZ')}
            </Typography>
          )}
          {isAdmin && provider && (
            <Chip
              component={RouterLink}
              to={`/admin/provider-schedules?provider=${provider.id}`}
              clickable
              variant="outlined"
              label="Edit template"
            />
          )}
        </Box>

        {loading || !provider ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
            {loading ? (
              <CircularProgress />
            ) : (
              <Typography color="text.secondary">No providers with a schedule.</Typography>
            )}
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 320px' },
              gap: 3,
              alignItems: 'start',
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <ProviderCalendar
                timezone={timezone}
                view={view}
                date={date}
                blocks={blocks}
                appointments={appointments}
                visitTypes={visitTypesQuery.data ?? []}
                providerVisitTypes={providerVisitTypes}
                onNavigate={(next) => update({ view: next.view, date: next.date })}
                onRangeChange={setRange}
                onAppointmentClick={(appointment, anchor) => setPopover({ appointment, anchor })}
                height={view === 'month' ? 'auto' : 760}
              />
              <Legend items={providerVisitTypes} />
            </Box>
            <DaySummaryPanel
              date={summaryDate}
              blocks={blocks}
              appointments={appointments}
              providerVisitTypes={providerVisitTypes}
              outsideCount={outsideCount}
            />
          </Box>
        )}

        <Popover
          open={Boolean(popover)}
          anchorEl={popover?.anchor}
          onClose={() => setPopover(undefined)}
          anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
          transformOrigin={{ vertical: 'center', horizontal: 'left' }}
        >
          {popover && (
            <AppointmentDetails
              appointment={popover.appointment}
              visitTypeName={visitTypesQuery.data?.find((v) => v.id === popover.appointment.visitTypeId)?.name}
              outside={isAppointmentOutsideSchedule(
                popover.appointment,
                blocks,
                providerVisitTypes.map((v) => v.id)
              )}
            />
          )}
        </Popover>
      </Box>
    </PageContainer>
  );
};

const Legend: FC<{ items: Array<{ id: string; name: string; color: string }> }> = ({ items }) => (
  <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
    {items.map((vt) => (
      <Box key={vt.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: vt.color }} />
        <Typography variant="caption" color="text.secondary">
          {vt.name}
        </Typography>
      </Box>
    ))}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '2px',
          bgcolor: 'action.selected',
          backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 2px, rgba(0,0,0,0.25) 2px 4px)',
        }}
      />
      <Typography variant="caption" color="text.secondary">
        Unavailable
      </Typography>
    </Box>
  </Stack>
);

const AppointmentDetails: FC<{ appointment: ScheduledAppointment; visitTypeName?: string; outside: boolean }> = ({
  appointment,
  visitTypeName,
  outside,
}): ReactElement => (
  <Box sx={{ p: 2, width: 280 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
      {appointment.patientName}
    </Typography>
    <Typography variant="body2" color="text.secondary">
      {DateTime.fromISO(appointment.start, { setZone: true }).toFormat('ccc LLL d')} ·{' '}
      {formatTimeRange(appointment.start, appointment.end)}
    </Typography>
    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
      <Chip size="small" label={visitTypeName ?? 'Visit'} />
      <Chip size="small" variant="outlined" label={appointmentStatusLabel(appointment.status)} />
    </Stack>
    {outside && (
      <Typography variant="body2" color="error.main" sx={{ mt: 1.5 }}>
        This visit is outside the provider&apos;s current schedule for its visit type. It stays booked; reschedule it if
        the time is no longer available.
      </Typography>
    )}
    {/* TODO(real API): link to /visit/:id once appointments come from FHIR. */}
  </Box>
);

export default ProviderSchedulePage;
