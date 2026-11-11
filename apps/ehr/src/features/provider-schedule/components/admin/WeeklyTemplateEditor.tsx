// FullCalendar v5 needs its React vdom shim loaded before any plugin (side-effect imports sort first).
import '@fullcalendar/react/dist/vdom';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar, {
  DateSelectArg,
  EventChangeArg,
  EventClickArg,
  EventContentArg,
  EventInput,
} from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useMemo, useState } from 'react';
import { minutesToTime, slotsThatFit, timeToMinutes, validateTemplate } from 'utils/lib/provider-schedule/expand';
import {
  IsoWeekday,
  ProviderScheduleTemplate,
  ScheduleLocation,
  TemplateBlock,
} from 'utils/lib/provider-schedule/types';
import { withAlpha } from '../calendarTime';
import { EffectiveVisitType } from '../ProviderCalendar';
import { BlockDialog, BlockDraft } from './BlockDialog';

/** The editor draws one abstract week; 2024-01-01 is a Monday, so day N of that week is weekday N. */
const REFERENCE_MONDAY = DateTime.fromISO('2024-01-01', { zone: 'utc' });
const refDate = (weekday: IsoWeekday, time: string): string =>
  REFERENCE_MONDAY.plus({ days: weekday - 1, minutes: timeToMinutes(time) }).toFormat("yyyy-LL-dd'T'HH:mm:ss");
const fromRef = (d: Date): { weekday: IsoWeekday; time: string } => {
  const dt = DateTime.fromJSDate(d, { zone: 'utc' });
  return { weekday: dt.weekday as IsoWeekday, time: minutesToTime(dt.hour * 60 + dt.minute) };
};

const newId = (): string => crypto.randomUUID();

interface WeeklyTemplateEditorProps {
  templates: ProviderScheduleTemplate[];
  locations: ScheduleLocation[];
  providerVisitTypes: EffectiveVisitType[];
  onChange: (templates: ProviderScheduleTemplate[]) => void;
}

export const WeeklyTemplateEditor: FC<WeeklyTemplateEditorProps> = ({
  templates,
  locations,
  providerVisitTypes,
  onChange,
}) => {
  const theme = useTheme();
  const sorted = useMemo(
    () => [...templates].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)),
    [templates]
  );
  const [selectedId, setSelectedId] = useState<string | undefined>(sorted[0]?.id);
  const template = templates.find((t) => t.id === selectedId) ?? sorted[0];
  const [week, setWeek] = useState(1);
  const [dialog, setDialog] = useState<BlockDraft>();

  const issues = useMemo(() => (template ? validateTemplate(template) : []), [template]);
  const issueBlockIds = useMemo(() => new Set(issues.flatMap((i) => i.blockIds)), [issues]);
  const visitTypeById = useMemo(() => new Map(providerVisitTypes.map((v) => [v.id, v])), [providerVisitTypes]);

  const updateTemplate = (patch: Partial<ProviderScheduleTemplate>): void => {
    if (!template) return;
    onChange(templates.map((t) => (t.id === template.id ? { ...t, ...patch } : t)));
  };
  const setBlocks = (blocks: TemplateBlock[]): void => updateTemplate({ blocks });

  const addTemplate = (copyFrom?: ProviderScheduleTemplate): void => {
    const id = newId();
    const nextMonday = DateTime.now().plus({ weeks: 1 }).startOf('week').toISODate()!;
    const created: ProviderScheduleTemplate = copyFrom
      ? {
          ...structuredClone(copyFrom),
          id,
          name: `${copyFrom.name} (copy)`,
          effectiveFrom: nextMonday,
          effectiveTo: undefined,
          blocks: copyFrom.blocks.map((b) => ({ ...b, id: newId() })),
        }
      : {
          id,
          name: 'New template',
          locationId: locations[0]?.id ?? '',
          effectiveFrom: nextMonday,
          cycleWeeks: 1,
          blocks: [],
        };
    onChange([...templates, created]);
    setSelectedId(id);
    setWeek(1);
  };

  const removeTemplate = (): void => {
    if (!template) return;
    const rest = templates.filter((t) => t.id !== template.id);
    onChange(rest);
    setSelectedId(rest[0]?.id);
  };

  const saveDraft = (draft: BlockDraft): void => {
    if (!template) return;
    const base = {
      startTime: draft.startTime,
      endTime: draft.endTime,
      kind: draft.kind,
      label: draft.label.trim(),
      visitTypeIds: draft.kind === 'bookable' ? draft.visitTypeIds : [],
      reason: draft.kind === 'unavailable' ? draft.reason : undefined,
    };
    if (draft.id) {
      setBlocks(template.blocks.map((b) => (b.id === draft.id ? { ...b, ...base, weekday: draft.weekdays[0] } : b)));
    } else {
      setBlocks([
        ...template.blocks,
        ...draft.weekdays.map((weekday) => ({ ...base, id: newId(), weekday, cycleWeek: week })),
      ]);
    }
    setDialog(undefined);
  };

  const events: EventInput[] = useMemo(() => {
    if (!template) return [];
    return template.blocks
      .filter((b) => b.cycleWeek === week)
      .map((b) => {
        const single = b.visitTypeIds.length === 1 ? visitTypeById.get(b.visitTypeIds[0]) : undefined;
        const tint = b.kind === 'unavailable' ? '#7a7a7a' : single?.color ?? '#2a6fdb';
        return {
          id: b.id,
          start: refDate(b.weekday, b.startTime),
          end: refDate(b.weekday, b.endTime),
          backgroundColor: withAlpha(tint, b.kind === 'unavailable' ? 0.16 : 0.14),
          borderColor: issueBlockIds.has(b.id) ? theme.palette.error.main : tint,
          textColor: theme.palette.text.primary,
          classNames: [
            b.kind === 'unavailable' ? 'ps-block-unavailable' : '',
            issueBlockIds.has(b.id) ? 'ps-block-issue' : '',
          ].filter(Boolean),
          extendedProps: { block: b },
        };
      });
  }, [template, week, visitTypeById, issueBlockIds, theme]);

  const renderBlock = (arg: EventContentArg): JSX.Element => {
    const block = arg.event.extendedProps.block as TemplateBlock | undefined;
    // The drag-to-select preview (selectMirror) is a synthetic event with no block attached.
    if (!block) {
      return (
        <Box sx={{ p: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{arg.timeText}</Typography>
        </Box>
      );
    }
    const minutes = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
    const allowed = block.visitTypeIds.length
      ? block.visitTypeIds.map((id) => visitTypeById.get(id)).filter((v): v is EffectiveVisitType => Boolean(v))
      : providerVisitTypes;
    const disabledCount = block.visitTypeIds.length - allowed.length;
    return (
      <Box sx={{ p: 0.5, overflow: 'hidden', height: '100%', lineHeight: 1.25 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 600 }} noWrap>
          {block.label}
        </Typography>
        <Typography sx={{ fontSize: 11, color: 'text.secondary' }} noWrap>
          {arg.timeText}
        </Typography>
        {block.kind === 'bookable' && minutes >= 45 && (
          <Typography sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'normal' }}>
            {block.visitTypeIds.length === 0
              ? 'Any visit type'
              : allowed.map((v) => `${slotsThatFit(minutes, v.durationMinutes)}× ${v.name.toLowerCase()}`).join(' · ')}
            {disabledCount > 0 && ` (+${disabledCount} not offered)`}
          </Typography>
        )}
      </Box>
    );
  };

  const onSelect = (arg: DateSelectArg): void => {
    const start = fromRef(arg.start);
    const end = fromRef(arg.end);
    arg.view.calendar.unselect();
    setDialog({
      weekdays: [start.weekday],
      startTime: start.time,
      endTime: end.weekday !== start.weekday ? '24:00' : end.time,
      kind: 'bookable',
      label: '',
      visitTypeIds: [],
    });
  };

  const onEventClick = (arg: EventClickArg): void => {
    const b = arg.event.extendedProps.block as TemplateBlock;
    setDialog({
      id: b.id,
      weekdays: [b.weekday],
      startTime: b.startTime,
      endTime: b.endTime,
      kind: b.kind,
      label: b.label,
      visitTypeIds: b.visitTypeIds,
      reason: b.reason,
    });
  };

  const onEventChange = (arg: EventChangeArg): void => {
    if (!template || !arg.event.start || !arg.event.end) return;
    const start = fromRef(arg.event.start);
    const end = fromRef(arg.event.end);
    if (end.weekday !== start.weekday && end.time !== '00:00') {
      arg.revert();
      return;
    }
    setBlocks(
      template.blocks.map((b) =>
        b.id === arg.event.id
          ? {
              ...b,
              weekday: start.weekday,
              startTime: start.time,
              endTime: end.weekday !== start.weekday ? '24:00' : end.time,
            }
          : b
      )
    );
  };

  if (!template) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 2 }}>
        <Typography sx={{ mb: 2 }}>This provider has no schedule template yet.</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => addTemplate()}>
          Create template
        </Button>
      </Paper>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <TextField
          select
          size="small"
          label="Template"
          value={template.id}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setWeek(1);
          }}
          sx={{ minWidth: 300 }}
        >
          {sorted.map((t) => (
            <MenuItem key={t.id} value={t.id}>
              {t.name} — from {DateTime.fromISO(t.effectiveFrom).toFormat('LLL d, yyyy')}
              {t.effectiveTo ? ` to ${DateTime.fromISO(t.effectiveTo).toFormat('LLL d, yyyy')}` : ''}
            </MenuItem>
          ))}
        </TextField>
        <Button size="small" startIcon={<AddIcon />} onClick={() => addTemplate()}>
          New
        </Button>
        <Button size="small" startIcon={<ContentCopyOutlinedIcon />} onClick={() => addTemplate(template)}>
          Duplicate
        </Button>
        <Tooltip title="Delete this template">
          <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={removeTemplate}>
            Delete
          </Button>
        </Tooltip>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            size="small"
            label="Name"
            value={template.name}
            onChange={(e) => updateTemplate({ name: e.target.value })}
            sx={{ flex: 2 }}
          />
          <TextField
            select
            size="small"
            label="Location"
            value={template.locationId}
            onChange={(e) => updateTemplate({ locationId: e.target.value })}
            sx={{ flex: 2 }}
          >
            {locations.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="date"
            label="Effective from"
            value={template.effectiveFrom}
            onChange={(e) => e.target.value && updateTemplate({ effectiveFrom: e.target.value })}
            InputLabelProps={{ shrink: true }}
            sx={{ flex: 1.3 }}
          />
          <TextField
            size="small"
            type="date"
            label="Effective to"
            value={template.effectiveTo ?? ''}
            onChange={(e) => updateTemplate({ effectiveTo: e.target.value || undefined })}
            InputLabelProps={{ shrink: true }}
            helperText="Blank = ongoing"
            sx={{ flex: 1.3 }}
          />
          <TextField
            select
            size="small"
            label="Repeats"
            value={template.cycleWeeks}
            onChange={(e) => {
              const cycleWeeks = Number(e.target.value);
              updateTemplate({ cycleWeeks, blocks: template.blocks.filter((b) => b.cycleWeek <= cycleWeeks) });
              setWeek((w) => Math.min(w, cycleWeeks));
            }}
            sx={{ flex: 1.2 }}
          >
            <MenuItem value={1}>Every week</MenuItem>
            <MenuItem value={2}>2-week cycle</MenuItem>
            <MenuItem value={3}>3-week cycle</MenuItem>
            <MenuItem value={4}>4-week cycle</MenuItem>
          </TextField>
        </Stack>
      </Paper>

      {issues.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {issues.map((i) => (
            <div key={i.message}>{i.message}</div>
          ))}
        </Alert>
      )}

      <Box
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}
      >
        {template.cycleWeeks > 1 ? (
          <Tabs
            value={week}
            onChange={(_, w: number) => setWeek(w)}
            sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36 } }}
          >
            {Array.from({ length: template.cycleWeeks }, (_, i) => (
              <Tab key={i} value={i + 1} label={`Week ${i + 1}`} />
            ))}
          </Tabs>
        ) : (
          <span />
        )}
        <Typography variant="body2" color="text.secondary">
          Drag on the grid to add a block. Drag or resize a block to move it; click to edit.
        </Typography>
      </Box>

      <Box
        sx={{
          '& .fc': { fontFamily: theme.typography.fontFamily, fontSize: 13 },
          '& .fc .fc-timegrid-slot': { height: 18 },
          '& .fc .fc-timegrid-slot-label': { color: theme.palette.text.secondary, fontSize: 11.5 },
          '& .fc .fc-col-header-cell-cushion': { color: theme.palette.text.primary, fontWeight: 600 },
          '& .fc .fc-timegrid-event': {
            borderRadius: '4px',
            borderWidth: '0 0 0 3px',
            boxShadow: 'none',
            cursor: 'pointer',
          },
          '& .fc .ps-block-unavailable': {
            backgroundImage: `repeating-linear-gradient(135deg, transparent 0 6px, ${withAlpha(
              '#7a7a7a',
              0.14
            )} 6px 12px)`,
          },
          '& .fc .ps-block-issue': { borderWidth: '2px !important', borderStyle: 'solid' },
          '& .fc .fc-highlight': { backgroundColor: withAlpha('#2a6fdb', 0.15) },
          '& .fc .fc-day-today': { backgroundColor: 'transparent !important' },
        }}
      >
        <FullCalendar
          key={`${template.id}-${week}`}
          plugins={[timeGridPlugin, interactionPlugin]}
          timeZone="UTC"
          initialView="timeGridWeek"
          initialDate={REFERENCE_MONDAY.toISODate()!}
          headerToolbar={false}
          firstDay={1}
          dayHeaderFormat={{ weekday: 'long' }}
          allDaySlot={false}
          slotDuration="00:15:00"
          snapDuration="00:05:00"
          slotLabelInterval="01:00"
          slotMinTime="06:00:00"
          slotMaxTime="20:00:00"
          scrollTime="07:30:00"
          height={720}
          selectable
          selectMirror
          editable
          eventOverlap
          events={events}
          eventContent={renderBlock}
          select={onSelect}
          eventClick={onEventClick}
          eventChange={onEventChange}
        />
      </Box>

      <BlockDialog
        open={Boolean(dialog)}
        initial={dialog}
        providerVisitTypes={providerVisitTypes}
        onClose={() => setDialog(undefined)}
        onSave={saveDraft}
        onDelete={(id) => {
          setBlocks(template.blocks.filter((b) => b.id !== id));
          setDialog(undefined);
        }}
      />
    </Box>
  );
};
