import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DateTime } from 'luxon';
import { FC, useEffect, useMemo, useState } from 'react';
import { isValidTimeOfDay, timeToMinutes } from 'utils/lib/provider-schedule/expand';
import {
  BlockKind,
  ScheduleException,
  UNAVAILABLE_REASONS,
  UnavailableReason,
} from 'utils/lib/provider-schedule/types';
import { useProviderAppointments } from '../../hooks/useProviderSchedule';
import { EffectiveVisitType } from '../ProviderCalendar';
import { REASON_LABEL } from './BlockDialog';

interface ExceptionsEditorProps {
  providerId: string;
  timezone: string;
  exceptions: ScheduleException[];
  providerVisitTypes: EffectiveVisitType[];
  onChange: (exceptions: ScheduleException[]) => void;
}

const describeTime = (e: ScheduleException): string =>
  e.startTime && e.endTime
    ? `${DateTime.fromFormat(e.startTime, 'HH:mm').toFormat('h:mm a')}–${DateTime.fromFormat(
        e.endTime,
        'HH:mm'
      ).toFormat('h:mm a')}`
    : 'All day';

export const ExceptionsEditor: FC<ExceptionsEditorProps> = ({
  providerId,
  timezone,
  exceptions,
  providerVisitTypes,
  onChange,
}) => {
  const today = DateTime.now().setZone(timezone).toISODate()!;
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<ScheduleException>();
  const rows = useMemo(
    () => exceptions.filter((e) => showPast || e.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    [exceptions, showPast, today]
  );

  const save = (e: ScheduleException): void => {
    onChange(
      exceptions.some((x) => x.id === e.id) ? exceptions.map((x) => (x.id === e.id ? e : x)) : [...exceptions, e]
    );
    setEditing(undefined);
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
          One-off changes on specific dates: time off (removes bookable time) or extra clinic sessions. They apply on
          top of whichever template is in effect.
        </Typography>
        <FormControlLabel
          control={<Switch size="small" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />}
          label="Show past"
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              date: today,
              kind: 'unavailable',
              label: 'Time off',
              reason: 'other',
              visitTypeIds: [],
            })
          }
        >
          Add exception
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Time</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Label</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} sx={{ color: 'text.secondary', py: 3, textAlign: 'center' }}>
                  No upcoming exceptions.
                </TableCell>
              </TableRow>
            )}
            {rows.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell>{DateTime.fromISO(e.date).toFormat('ccc, LLL d, yyyy')}</TableCell>
                <TableCell>{describeTime(e)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    color={e.kind === 'unavailable' ? 'default' : 'success'}
                    label={e.kind === 'unavailable' ? 'Time off' : 'Extra clinic'}
                  />
                </TableCell>
                <TableCell>{e.label}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" aria-label={`Edit ${e.label}`} onClick={() => setEditing(e)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ExceptionDialog
        providerId={providerId}
        initial={editing}
        isNew={Boolean(editing && !exceptions.some((x) => x.id === editing.id))}
        providerVisitTypes={providerVisitTypes}
        onClose={() => setEditing(undefined)}
        onSave={save}
        onDelete={(id) => {
          onChange(exceptions.filter((x) => x.id !== id));
          setEditing(undefined);
        }}
      />
    </Box>
  );
};

interface ExceptionDialogProps {
  providerId: string;
  initial: ScheduleException | undefined;
  isNew: boolean;
  providerVisitTypes: EffectiveVisitType[];
  onClose: () => void;
  onSave: (e: ScheduleException) => void;
  onDelete: (id: string) => void;
}

const ExceptionDialog: FC<ExceptionDialogProps> = ({
  providerId,
  initial,
  isNew,
  providerVisitTypes,
  onClose,
  onSave,
  onDelete,
}) => {
  const [draft, setDraft] = useState<ScheduleException | undefined>(initial);
  useEffect(() => setDraft(initial), [initial]);
  const appointmentsQuery = useProviderAppointments(providerId, draft?.date, draft?.date);

  const affected = useMemo(() => {
    if (!draft || draft.kind !== 'unavailable') return [];
    return (appointmentsQuery.data ?? []).filter((a) => {
      // Only visits still to come need rescheduling; completed / in-progress ones already happened.
      if (a.status !== 'booked' && a.status !== 'arrived') return false;
      if (!draft.startTime || !draft.endTime) return true;
      const s = DateTime.fromISO(a.start, { setZone: true });
      const e = DateTime.fromISO(a.end, { setZone: true });
      const startMin = s.hour * 60 + s.minute;
      const endMin = e.hour * 60 + e.minute;
      return startMin < timeToMinutes(draft.endTime) && timeToMinutes(draft.startTime) < endMin;
    });
  }, [appointmentsQuery.data, draft]);

  if (!draft) return null;
  const allDay = !draft.startTime;
  const timesValid =
    allDay ||
    (isValidTimeOfDay(draft.startTime!) &&
      isValidTimeOfDay(draft.endTime ?? '') &&
      timeToMinutes(draft.endTime!) > timeToMinutes(draft.startTime!));
  const canSave =
    Boolean(draft.date) && draft.label.trim() !== '' && timesValid && !(draft.kind === 'bookable' && allDay);
  const set = (patch: Partial<ScheduleException>): void => setDraft({ ...draft, ...patch });

  return (
    <Dialog open={Boolean(initial)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isNew ? 'Add exception' : 'Edit exception'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={draft.kind}
            onChange={(_, kind: BlockKind | null) => {
              if (!kind) return;
              set(
                kind === 'bookable'
                  ? {
                      kind,
                      reason: undefined,
                      label: 'Extra clinic',
                      startTime: draft.startTime ?? '09:00',
                      endTime: draft.endTime ?? '12:00',
                    }
                  : { kind, reason: 'other', label: 'Time off', visitTypeIds: [] }
              );
            }}
          >
            <ToggleButton value="unavailable">Time off</ToggleButton>
            <ToggleButton value="bookable">Extra clinic</ToggleButton>
          </ToggleButtonGroup>

          <Stack direction="row" spacing={2}>
            <TextField
              type="date"
              size="small"
              label="Date"
              value={draft.date}
              onChange={(e) => set({ date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Label"
              value={draft.label}
              onChange={(e) => set({ label: e.target.value })}
              sx={{ flex: 1.5 }}
            />
          </Stack>

          {draft.kind === 'unavailable' && (
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                select
                size="small"
                label="Reason"
                value={draft.reason ?? 'other'}
                onChange={(e) => set({ reason: e.target.value as UnavailableReason })}
                sx={{ flex: 1 }}
              >
                {UNAVAILABLE_REASONS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {REASON_LABEL[r]}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                sx={{ flex: 1 }}
                control={
                  <Switch
                    checked={allDay}
                    onChange={(e) =>
                      set(
                        e.target.checked
                          ? { startTime: undefined, endTime: undefined }
                          : { startTime: '13:00', endTime: '17:00' }
                      )
                    }
                  />
                }
                label="All day"
              />
            </Stack>
          )}

          {!allDay && (
            <Stack direction="row" spacing={2}>
              <TextField
                label="Start"
                type="time"
                size="small"
                value={draft.startTime}
                onChange={(e) => set({ startTime: e.target.value })}
                inputProps={{ step: 300 }}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="End"
                type="time"
                size="small"
                value={draft.endTime}
                onChange={(e) => set({ endTime: e.target.value })}
                inputProps={{ step: 300 }}
                InputLabelProps={{ shrink: true }}
                error={!timesValid}
                helperText={!timesValid ? 'End must be after start' : undefined}
                sx={{ flex: 1 }}
              />
            </Stack>
          )}

          {draft.kind === 'bookable' && (
            <Autocomplete
              multiple
              size="small"
              options={providerVisitTypes}
              value={providerVisitTypes.filter((v) => draft.visitTypeIds.includes(v.id))}
              getOptionLabel={(v) => v.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, value) => set({ visitTypeIds: value.map((v) => v.id) })}
              renderInput={(params) => (
                <TextField {...params} label="Visit types" helperText="Leave empty to allow any visit type." />
              )}
            />
          )}

          {affected.length > 0 && (
            <Alert severity="warning">
              {affected.length} booked appointment{affected.length === 1 ? '' : 's'} on this date fall in this time and
              will need rescheduling:
              <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
                {affected.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    {DateTime.fromISO(a.start, { setZone: true }).toFormat('h:mm a')} — {a.patientName}
                  </li>
                ))}
                {affected.length > 6 && <li>and {affected.length - 6} more</li>}
              </Box>
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!isNew && (
          <Button color="error" onClick={() => onDelete(draft.id)} sx={{ mr: 'auto' }}>
            Delete
          </Button>
        )}
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!canSave}
          onClick={() =>
            onSave({
              ...draft,
              label: draft.label.trim(),
              visitTypeIds: draft.kind === 'bookable' ? draft.visitTypeIds : [],
            })
          }
        >
          {isNew ? 'Add' : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
