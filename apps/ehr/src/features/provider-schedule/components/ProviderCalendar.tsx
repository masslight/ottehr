// FullCalendar v5 needs its React vdom shim loaded before any plugin (side-effect imports sort first).
import '@fullcalendar/react/dist/vdom';
import dayGridPlugin from '@fullcalendar/daygrid';
import FullCalendar, { DatesSetArg, EventClickArg, EventContentArg, EventInput } from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Box, Button, IconButton, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { effectiveVisitTypes, isAppointmentOutsideSchedule, openTimeForDay } from 'utils/lib/provider-schedule/expand';
import { ScheduleBlockInstance, ScheduledAppointment, ScheduleVisitType } from 'utils/lib/provider-schedule/types';
import { floatingDate, nowFloating, todayIn, toFloating, withAlpha } from './calendarTime';

export type CalendarView = 'day' | 'week' | 'month';

const FC_VIEW: Record<CalendarView, string> = {
  day: 'timeGridDay',
  week: 'timeGridWeek',
  month: 'dayGridMonth',
};

export type EffectiveVisitType = ReturnType<typeof effectiveVisitTypes>[number];

export interface ProviderCalendarProps {
  timezone: string;
  view: CalendarView;
  /** yyyy-MM-dd the view is anchored on. */
  date: string;
  blocks: ScheduleBlockInstance[];
  appointments: ScheduledAppointment[];
  visitTypes: ScheduleVisitType[];
  providerVisitTypes: EffectiveVisitType[];
  onNavigate: (next: { view: CalendarView; date: string }) => void;
  /** Visible range, inclusive dates. */
  onRangeChange: (range: { startDate: string; endDate: string }) => void;
  onAppointmentClick?: (appointment: ScheduledAppointment, anchor: HTMLElement) => void;
  height?: number | string;
}

interface BlockEventProps {
  kind: 'block';
  block: ScheduleBlockInstance;
}
interface AppointmentEventProps {
  kind: 'appointment';
  appointment: ScheduledAppointment;
  visitType?: ScheduleVisitType;
  outside: boolean;
}
interface SummaryEventProps {
  kind: 'summary';
  date: string;
  booked: number;
  openMinutes: number;
  timeOff?: string;
}
type CalendarEventProps = BlockEventProps | AppointmentEventProps | SummaryEventProps;

const STATUS_LABEL: Record<ScheduledAppointment['status'], string> = {
  booked: 'Booked',
  arrived: 'Arrived',
  'in-progress': 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
};

export const appointmentStatusLabel = (status: ScheduledAppointment['status']): string => STATUS_LABEL[status];

export const ProviderCalendar: FC<ProviderCalendarProps> = ({
  timezone,
  view,
  date,
  blocks,
  appointments,
  visitTypes,
  providerVisitTypes,
  onNavigate,
  onRangeChange,
  onAppointmentClick,
  height = 'auto',
}) => {
  const theme = useTheme();
  const calendarRef = useRef<FullCalendar>(null);
  const [title, setTitle] = useState('');

  // Keep FullCalendar in sync with the controlled view/date.
  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    if (api.view.type !== FC_VIEW[view]) api.changeView(FC_VIEW[view], date);
    else api.gotoDate(date);
  }, [view, date]);

  const enabledIds = useMemo(() => providerVisitTypes.map((v) => v.id), [providerVisitTypes]);
  const visitTypeById = useMemo(() => new Map(visitTypes.map((v) => [v.id, v])), [visitTypes]);

  const events: EventInput[] = useMemo(() => {
    if (view === 'month') {
      const dates = Array.from(
        new Set(blocks.map((b) => b.date).concat(appointments.map((a) => toFloating(a.start).slice(0, 10))))
      );
      return dates.map((d) => {
        const dayBlocks = blocks.filter((b) => b.date === d);
        const dayAppts = appointments.filter((a) => toFloating(a.start).startsWith(d));
        const open = openTimeForDay(dayBlocks, dayAppts, providerVisitTypes);
        const allDayOff = dayBlocks.find(
          (b) =>
            b.kind === 'unavailable' && DateTime.fromISO(b.end).diff(DateTime.fromISO(b.start), 'hours').hours >= 24
        );
        const props: SummaryEventProps = {
          kind: 'summary',
          date: d,
          booked: dayAppts.filter((a) => a.status !== 'cancelled').length,
          openMinutes: Math.round(open.openMinutes),
          timeOff: allDayOff?.label,
        };
        return { id: `summary-${d}`, start: d, allDay: true, extendedProps: props };
      });
    }

    const blockEvents: EventInput[] = blocks.map((block) => {
      const firstType = block.visitTypeIds.length === 1 ? visitTypeById.get(block.visitTypeIds[0]) : undefined;
      const tint =
        block.kind === 'unavailable' ? theme.palette.grey[500] : firstType?.color ?? theme.palette.primary.main;
      return {
        id: `block-${block.key}`,
        start: toFloating(block.start),
        end: toFloating(block.end),
        display: 'background',
        backgroundColor: withAlpha(tint.startsWith('#') ? tint : '#888888', block.kind === 'unavailable' ? 0.22 : 0.1),
        classNames: [block.kind === 'unavailable' ? 'ps-block-unavailable' : 'ps-block-bookable'],
        extendedProps: { kind: 'block', block } satisfies BlockEventProps,
      };
    });

    const apptEvents: EventInput[] = appointments.map((appointment) => {
      const visitType = visitTypeById.get(appointment.visitTypeId);
      const outside = isAppointmentOutsideSchedule(appointment, blocks, enabledIds);
      const muted = appointment.status === 'cancelled' || appointment.status === 'no-show';
      const color = visitType?.color ?? theme.palette.primary.main;
      return {
        id: appointment.id,
        start: toFloating(appointment.start),
        end: toFloating(appointment.end),
        backgroundColor: muted ? theme.palette.background.paper : color,
        borderColor: outside ? theme.palette.error.main : color,
        textColor: muted ? theme.palette.text.secondary : '#fff',
        classNames: [muted ? 'ps-appt-muted' : '', outside ? 'ps-appt-outside' : ''].filter(Boolean),
        extendedProps: { kind: 'appointment', appointment, visitType, outside } satisfies AppointmentEventProps,
      };
    });
    return [...blockEvents, ...apptEvents];
  }, [view, blocks, appointments, providerVisitTypes, visitTypeById, enabledIds, theme]);

  const renderEvent = (arg: EventContentArg): JSX.Element | null => {
    const props = arg.event.extendedProps as CalendarEventProps | Record<string, never>;
    if (!('kind' in props)) return null;
    if (props.kind === 'block') {
      const { block } = props;
      const names =
        block.kind === 'bookable'
          ? block.visitTypeIds.length
            ? block.visitTypeIds
                .map((id) => visitTypeById.get(id)?.name)
                .filter(Boolean)
                .join(', ')
            : 'Any visit type'
          : undefined;
      return (
        <Box sx={{ px: 0.75, pt: 0.25, overflow: 'hidden', pointerEvents: 'none' }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: 'text.secondary',
              display: 'block',
              lineHeight: 1.3,
              textTransform: 'uppercase',
              letterSpacing: 0.3,
              fontSize: 10.5,
            }}
          >
            {block.label}
          </Typography>
          {names && view === 'day' && (
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10.5 }}>
              {names}
            </Typography>
          )}
        </Box>
      );
    }
    if (props.kind === 'appointment') {
      const { appointment, visitType, outside } = props;
      const compact = view === 'week';
      return (
        <Box
          sx={{ px: 0.5, overflow: 'hidden', lineHeight: 1.25, display: 'flex', gap: 0.5, alignItems: 'flex-start' }}
        >
          {outside && (
            <Tooltip title="Outside the provider's current schedule for this visit type">
              <WarningAmberRoundedIcon sx={{ fontSize: 14, mt: '1px', color: 'inherit' }} />
            </Tooltip>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Box
              component="span"
              sx={{
                fontWeight: 600,
                fontSize: 12,
                textDecoration: appointment.status === 'cancelled' ? 'line-through' : undefined,
              }}
            >
              {arg.timeText} {appointment.patientName}
            </Box>
            {!compact && (
              <Box component="span" sx={{ fontSize: 12, opacity: 0.9 }}>
                {' · '}
                {visitType?.name ?? 'Visit'}
                {appointment.status !== 'booked' ? ` · ${STATUS_LABEL[appointment.status]}` : ''}
              </Box>
            )}
          </Box>
        </Box>
      );
    }
    // Month summary
    const hours = Math.floor(props.openMinutes / 60);
    const mins = props.openMinutes % 60;
    return (
      <Box sx={{ px: 0.5, py: 0.25, width: '100%', overflow: 'hidden' }}>
        {props.timeOff ? (
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            {props.timeOff}
          </Typography>
        ) : (
          <>
            <Typography variant="caption" sx={{ display: 'block', fontWeight: 600, color: 'text.primary' }}>
              {props.booked} booked
            </Typography>
            <Typography
              variant="caption"
              sx={{ display: 'block', color: props.openMinutes ? 'success.dark' : 'text.secondary' }}
            >
              {props.openMinutes ? `${hours ? `${hours}h ` : ''}${mins ? `${mins}m ` : ''}open` : 'Full'}
            </Typography>
          </>
        )}
      </Box>
    );
  };

  const handleEventClick = (arg: EventClickArg): void => {
    const props = arg.event.extendedProps as CalendarEventProps;
    if (props.kind === 'appointment') onAppointmentClick?.(props.appointment, arg.el);
    if (props.kind === 'summary') onNavigate({ view: 'day', date: props.date });
  };

  const handleDatesSet = (arg: DatesSetArg): void => {
    setTitle(arg.view.title);
    onRangeChange({
      startDate: floatingDate(arg.start),
      // FullCalendar's end is exclusive.
      endDate: DateTime.fromJSDate(arg.end, { zone: 'utc' }).minus({ days: 1 }).toISODate()!,
    });
  };

  const step = (direction: 1 | -1): void => {
    const unit = view === 'day' ? 'days' : view === 'week' ? 'weeks' : 'months';
    onNavigate({
      view,
      date: DateTime.fromISO(date)
        .plus({ [unit]: direction })
        .toISODate()!,
    });
  };

  const today = todayIn(timezone);

  return (
    <Box
      sx={{
        '& .fc': { fontFamily: theme.typography.fontFamily, fontSize: 13 },
        '& .fc .fc-timegrid-slot': { height: 22 },
        '& .fc .fc-timegrid-slot-label': { color: theme.palette.text.secondary, fontSize: 11.5 },
        '& .fc .fc-col-header-cell-cushion, & .fc .fc-daygrid-day-number': {
          color: theme.palette.text.primary,
          textDecoration: 'none',
          fontWeight: 500,
        },
        '& .fc .fc-bg-event': { opacity: 1 },
        '& .fc .ps-block-unavailable': {
          backgroundImage: `repeating-linear-gradient(135deg, transparent 0 6px, ${withAlpha(
            '#7a7a7a',
            0.12
          )} 6px 12px)`,
        },
        '& .fc .ps-block-bookable': { borderLeft: `3px solid ${withAlpha('#5a6b80', 0.35)}` },
        '& .fc .fc-timegrid-event': { borderRadius: '4px', borderWidth: '0 0 0 3px', cursor: 'pointer' },
        '& .fc .ps-appt-outside': { borderWidth: '2px !important', borderStyle: 'dashed !important' },
        '& .fc .ps-appt-muted': { borderStyle: 'dashed', opacity: 0.85 },
        '& .fc .fc-daygrid-event': { cursor: 'pointer', background: 'transparent', border: 'none' },
        '& .fc .fc-day-today': { backgroundColor: withAlpha('#2a6fdb', 0.05) },
        '& .fc .fc-timegrid-now-indicator-line': { borderColor: theme.palette.error.main },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => onNavigate({ view, date: today })}
          disabled={date === today}
        >
          Today
        </Button>
        <IconButton size="small" aria-label="Previous" onClick={() => step(-1)}>
          <ChevronLeftIcon />
        </IconButton>
        <IconButton size="small" aria-label="Next" onClick={() => step(1)}>
          <ChevronRightIcon />
        </IconButton>
        <Typography variant="h6" component="h2" sx={{ flexGrow: 1, fontWeight: 600 }}>
          {title}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, next: CalendarView | null) => next && onNavigate({ view: next, date })}
          aria-label="Calendar view"
        >
          <ToggleButton value="day">Day</ToggleButton>
          <ToggleButton value="week">Week</ToggleButton>
          <ToggleButton value="month">Month</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, dayGridPlugin]}
        timeZone="UTC"
        now={nowFloating(timezone)}
        initialView={FC_VIEW[view]}
        initialDate={date}
        headerToolbar={false}
        firstDay={1}
        allDaySlot={false}
        nowIndicator
        slotDuration="00:15:00"
        slotLabelInterval="01:00"
        slotMinTime="07:00:00"
        slotMaxTime="19:00:00"
        scrollTime="07:30:00"
        expandRows
        height={height}
        dayMaxEvents={2}
        events={events}
        eventContent={renderEvent}
        eventClick={handleEventClick}
        datesSet={handleDatesSet}
        navLinks
        navLinkDayClick={(d: Date) => onNavigate({ view: 'day', date: floatingDate(d) })}
        dayHeaderFormat={
          view === 'week' ? { weekday: 'short', day: 'numeric', month: 'numeric', omitCommas: true } : undefined
        }
      />
    </Box>
  );
};
