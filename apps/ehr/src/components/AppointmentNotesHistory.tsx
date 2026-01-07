import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Appointment } from 'fhir/r4b';
import { ReactElement, useEffect, useMemo, useState } from 'react';
import { EHRVisitDetails } from 'utils';
import { formatLastModifiedTag } from '../helpers';
import { patchAppointmentComment } from '../helpers';
import { NoteHistory } from '../helpers/activityLogsUtils';
import { EvolveUser } from '../hooks/useEvolveUser';
import { EditPatientInfoDialog } from './dialogs';

interface AppointmentNotesHistoryProps {
  appointment: Appointment | undefined;
  curNoteAndHistory: NoteHistory[] | undefined;
  timezone?: string;
  user: EvolveUser | undefined;
  oystehr: Oystehr | undefined;
  getAndSetHistoricResources: ({ logs, notes }: { logs?: boolean; notes?: boolean }) => Promise<void>;
}

export default function AppointmentNotesHistory({
  appointment,
  curNoteAndHistory,
  timezone,
  user,
  oystehr,
  getAndSetHistoricResources,
}: AppointmentNotesHistoryProps): ReactElement {
  const theme = useTheme();
  // for historical notes (not sure if needed)
  const noteLastModified = formatLastModifiedTag('comment', appointment, timezone);
  const [noteEdit, setNoteEdit] = useState<string>(appointment?.comment || '');
  const [editNoteDialogOpen, setEditNoteDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    setNoteEdit(appointment?.comment || '');
  }, [appointment]);

  const queryClient = useQueryClient();
  const updateAppointmentNoteMutation = useMutation({
    mutationFn: async () => {
      if (!appointment || !oystehr || !user) {
        throw new Error('Missing required data');
      }
      return patchAppointmentComment(appointment!, noteEdit, user, oystehr!);
    },
    onSuccess: async (updatedAppointment) => {
      queryClient.setQueryData(['get-visit-details', appointment?.id], (old: EHRVisitDetails | undefined) =>
        old ? { ...old, appointment: updatedAppointment } : old
      );
      await getAndSetHistoricResources({ notes: true });
      setEditNoteDialogOpen(false);
    },
  });

  const handleNoteUpdate = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    await updateAppointmentNoteMutation.mutateAsync();
  };

  const noteBlock = (note: string, dtAdded: string, showEdit: boolean): ReactElement => (
    <>
      <Box sx={{ display: 'flex', mt: 2, justifyContent: 'space-between' }}>
        {note !== '' && (
          <>
            <Typography
              sx={{
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                color: theme.palette.primary.dark,
                whiteSpace: 'pre-line',
              }}
              variant="body1"
            >
              {note}
            </Typography>
            {showEdit && (
              <IconButton
                sx={{ color: 'primary.main', width: '24px', height: '24px' }}
                onClick={() => setEditNoteDialogOpen(true)}
              >
                <EditOutlinedIcon sx={{ width: '24px', height: '24px' }} />
              </IconButton>
            )}
          </>
        )}
      </Box>
      <Box display="flex" justifyContent="space-between">
        <Typography
          sx={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
            color: theme.palette.secondary.light,
            mt: `${note !== '' ? '13px' : '0'}`,
          }}
          variant="body2"
        >
          {note === '' && 'note removed '}
          {dtAdded}
        </Typography>
        {note === '' && showEdit && (
          <IconButton
            sx={{ color: 'primary.main', width: '24px', height: '24px' }}
            onClick={() => setEditNoteDialogOpen(true)}
          >
            <EditOutlinedIcon sx={{ width: '24px', height: '24px' }} />
          </IconButton>
        )}
      </Box>
    </>
  );

  const { curNote, notesHistory } = useMemo(() => {
    const curNoteAndHistoryCopy = [...(curNoteAndHistory || [])];
    const curNote = curNoteAndHistoryCopy?.shift();
    const notesHistory = curNoteAndHistoryCopy;
    return { curNote, notesHistory };
  }, [curNoteAndHistory]);

  // for historical notes (not sure if needed)
  if (noteLastModified && appointment?.comment) {
    return (
      <Paper
        sx={{
          marginTop: 2,
          padding: 3,
        }}
      >
        <Typography variant="h4" color="primary.dark">
          Current tracking board note
        </Typography>
        {noteBlock(appointment.comment, noteLastModified, true)}
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        marginTop: 2,
        padding: 3,
      }}
    >
      <Typography variant="h4" color="primary.dark">
        Current tracking board note
      </Typography>

      {curNoteAndHistory ? (
        <>
          {curNote && (
            <Table size="small" style={{ tableLayout: 'fixed' }}>
              <TableBody>
                <TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell
                    sx={{
                      width: '50%',
                      color: theme.palette.primary.dark,
                      padding: '0 8px 16px 0px',
                    }}
                  >
                    {noteBlock(curNote.note, curNote.noteAddedByAndWhen, true)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}

          {notesHistory.length > 0 && (
            <Typography variant="h4" color="primary.dark" sx={{ mt: 1 }}>
              History
            </Typography>
          )}

          <Table size="small" style={{ tableLayout: 'fixed' }}>
            <TableBody>
              {notesHistory?.map((note, idx) => (
                <TableRow key={idx} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell
                    sx={{
                      width: '50%',
                      color: theme.palette.primary.dark,
                      padding: '0 8px 16px 0px',
                    }}
                  >
                    {noteBlock(note.note, note.noteAddedByAndWhen, false)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : (
        <CircularProgress size="20px" sx={{ marginTop: 2.8, marginLeft: 1 }} />
      )}

      <EditPatientInfoDialog
        title="Update current tracking board note"
        modalOpen={editNoteDialogOpen}
        onClose={() => {
          setEditNoteDialogOpen(false);
          setNoteEdit(appointment?.comment || '');
        }}
        input={
          <>
            <TextField
              multiline
              label="Note"
              required
              fullWidth
              value={noteEdit}
              onChange={(e) => setNoteEdit(e.target.value.trimStart())}
              disabled={updateAppointmentNoteMutation.isPending}
              inputProps={{ maxLength: 160 }}
            />
          </>
        }
        onSubmit={handleNoteUpdate}
        submitButtonName="Update note"
        loading={updateAppointmentNoteMutation.isPending}
        error={updateAppointmentNoteMutation.isError}
        errorMessage="Failed to update note"
      />
    </Paper>
  );
}
