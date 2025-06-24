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
import { Appointment, Location } from 'fhir/r4b';
import { ReactElement, useMemo, useState } from 'react';
import { formatLastModifiedTag } from '../helpers';
import { patchAppointmentComment } from '../helpers';
import { NoteHistory } from '../helpers/activityLogsUtils';
import { EvolveUser } from '../hooks/useEvolveUser';
import { EditPatientInfoDialog } from './dialogs';

interface AppointmentNotesHistoryProps {
  appointment: Appointment | undefined;
  location: Location;
  curNoteAndHistory: NoteHistory[] | undefined;
  user: EvolveUser | undefined;
  oystehr: Oystehr | undefined;
  setAppointment: (value: React.SetStateAction<Appointment | undefined>) => void;
  getAndSetHistoricResources: ({ logs, notes }: { logs?: boolean; notes?: boolean }) => Promise<void>;
}

export default function AppointmentNotesHistory({
  appointment,
  location,
  curNoteAndHistory,
  user,
  oystehr,
  setAppointment,
  getAndSetHistoricResources,
}: AppointmentNotesHistoryProps): ReactElement {
  const theme = useTheme();
  // for historical notes (not sure if needed)
  const noteLastModified = formatLastModifiedTag('comment', appointment, location);
  const [noteEdit, setNoteEdit] = useState<string>(appointment?.comment || '');
  const [editNoteDialogOpen, setEditNoteDialogOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  const handleNoteUpdate = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    if (!appointment || !oystehr) {
      setError(true);
    } else {
      try {
        const updatedAppointment = await patchAppointmentComment(appointment, noteEdit, user, oystehr);
        console.log('updatedAppointment', updatedAppointment);
        setAppointment(updatedAppointment);
        await getAndSetHistoricResources({ notes: true });
        setEditNoteDialogOpen(false);
      } catch (e) {
        console.log('error updating appointment', e);
        setError(true);
      }
    }
    setLoading(false);
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
          {note === '' && `note removed `}
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
              sx={{ width: '500px' }}
              value={noteEdit}
              onChange={(e) => setNoteEdit(e.target.value.trimStart())}
              inputProps={{ maxLength: 160 }}
            />
          </>
        }
        onSubmit={handleNoteUpdate}
        submitButtonName="Update note"
        loading={loading}
        error={error}
        errorMessage="Failed to update note"
      />
    </Paper>
  );
}
