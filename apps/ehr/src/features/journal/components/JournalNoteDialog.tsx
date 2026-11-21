import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Tooltip,
} from '@mui/material';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useState } from 'react';
import { completeJournalTask, saveFreeFormEncounter } from 'src/api/api';
import { PatientDateOfBirth } from 'src/components/PatientDateOfBirth';
import { DEFAULT_TOOLTIP_PROPS } from 'src/components/WithTooltip';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import { NOTE_TYPE, NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { JournalItem, JournalPatient, JournalVisit } from 'utils/lib/types/api/provider-journal.types';
import { formatVisitLabel, JOURNAL_COLORS } from '../helpers/journalHelpers';

export type JournalNoteTarget =
  /** Call and text tasks assigned to the signed-in user, offered as "Mark … done". */
  | { mode: 'free-form'; patient: JournalPatient; completableTasks: JournalItem[] }
  | { mode: 'addendum'; patient: JournalPatient; visit: JournalVisit };

interface Props {
  target: JournalNoteTarget;
  onClose: () => void;
  onSaved: () => void;
}

/** Free form note: saved to the chart, not linked to a visit. Addendum: added to the visit's progress note. */
export const JournalNoteDialog = ({ target, onClose, onSaved }: Props): ReactElement => {
  const { oystehrZambda } = useApiClients();
  const apiClient = useOystehrAPIClient();
  const user = useEvolveUser();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  // Unticked: the provider ticks the call or text the note is about.
  const [done, setDone] = useState<Record<string, boolean>>({});

  const isAddendum = target.mode === 'addendum';
  const title = isAddendum ? 'Addendum' : 'Free Form';
  const visitLabel = isAddendum ? formatVisitLabel(target.visit.start) : '';
  const where = isAddendum ? `${target.patient.name} · Progress Note for ${visitLabel}` : target.patient.name;
  const stamp = `${DateTime.now().toFormat('MMM d, yyyy h:mm a')} · ${user?.userName ?? ''}`;
  const canSave = !!text.trim() && !saving;

  const save = async (): Promise<void> => {
    if (!oystehrZambda || !user) return;
    setSaving(true);
    try {
      if (target.mode === 'addendum') {
        const note: NoteDTO = {
          type: NOTE_TYPE.ADDENDUM,
          text: text.trim(),
          authorId: user.profile?.split('/')?.[1] ?? 'unknown',
          authorName: user.userName,
          patientId: target.patient.patientId,
          encounterId: target.visit.encounterId,
        };
        await apiClient?.saveChartData?.({ encounterId: target.visit.encounterId, notes: [note] });
        enqueueSnackbar(`Addendum added to the Progress Note for ${target.patient.name}'s visit (${visitLabel})`, {
          variant: 'success',
        });
      } else {
        await saveFreeFormEncounter(oystehrZambda, { patientId: target.patient.patientId, note: text.trim() });
        enqueueSnackbar(`Free Form saved to ${target.patient.name}'s chart`, { variant: 'success' });
        // The note is saved at this point; a task that could not be marked done gets its own message.
        for (const task of target.completableTasks) {
          if (!done[task.id] || !task.taskId) continue;
          try {
            await completeJournalTask(oystehrZambda, { taskId: task.taskId });
          } catch (error) {
            console.error(error);
            enqueueSnackbar(`Note saved, but '${task.title ?? task.label}' could not be marked done`, {
              variant: 'error',
            });
          }
        }
      }
      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      enqueueSnackbar(`Could not save the ${title}`, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: 20, fontWeight: 600, color: 'primary.dark', pb: 1 }}>{title}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, color: JOURNAL_COLORS.text2, fontSize: 13 }}>
          {where}
          {target.patient.birthDate && <PatientDateOfBirth dateOfBirth={target.patient.birthDate} />}
        </Box>
        <Box sx={{ color: JOURNAL_COLORS.text2, fontSize: 13 }}>{stamp}</Box>
        <TextField
          autoFocus
          multiline
          minRows={6}
          fullWidth
          value={text}
          onChange={(e) => setText(e.target.value)}
          inputProps={{ 'aria-label': title }}
        />
        {target.mode === 'free-form' &&
          target.completableTasks.map((task) => (
            <FormControlLabel
              key={task.id}
              control={
                <Checkbox
                  checked={!!done[task.id]}
                  onChange={(e) => setDone({ ...done, [task.id]: e.target.checked })}
                />
              }
              label={`Mark '${task.title ?? task.label}' done`}
            />
          ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '18px', textTransform: 'none' }}>
          Cancel
        </Button>
        <Tooltip {...DEFAULT_TOOLTIP_PROPS} title={text.trim() ? '' : 'Type a note first'}>
          <span>
            <Button
              variant="contained"
              disabled={!canSave}
              onClick={() => void save()}
              sx={{ borderRadius: '18px', textTransform: 'none', px: 2.75 }}
            >
              Save
            </Button>
          </span>
        </Tooltip>
      </DialogActions>
    </Dialog>
  );
};
