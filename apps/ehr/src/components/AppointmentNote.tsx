import EditNoteIcon from '@mui/icons-material/EditNote';
import { LoadingButton } from '@mui/lab';
import { Input, InputAdornment, useTheme } from '@mui/material';
import Oystehr from '@oystehr/sdk';
import { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InPersonAppointmentInformation } from 'utils';
import { patchAppointmentComment } from '../helpers';
import { EvolveUser } from '../hooks/useEvolveUser';
import { GenericToolTip } from './GenericToolTip';

interface AppointmentNoteProps {
  appointment: InPersonAppointmentInformation;
  oystehr: Oystehr | undefined;
  user: EvolveUser | undefined;
  updateAppointments: () => void;
  setEditingComment: (editingComment: boolean) => void;
}

const AppointmentNote = ({
  appointment,
  oystehr,
  user,
  updateAppointments,
  setEditingComment,
}: AppointmentNoteProps): ReactElement => {
  const theme = useTheme();
  const [apptComment, setApptComment] = useState<string>(appointment.comment || '');
  const [noteSaving, setNoteSaving] = useState<boolean>(false);
  const [editingRow, setEditingRow] = useState<boolean>(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const inputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (inputRef.current && !editingRow) {
      const isOverflow = inputRef.current.scrollHeight > inputRef.current.clientHeight;
      setIsOverflowing(isOverflow);
    }
  }, [apptComment, editingRow]);

  const saveNote = useCallback(
    async (_event: React.MouseEvent<HTMLElement>): Promise<void> => {
      if (!oystehr) {
        throw new Error('error getting oystehr client');
      }
      if (!appointment.id) {
        throw new Error('error getting appointment id');
      }
      try {
        setNoteSaving(true);
        await patchAppointmentComment(appointment, apptComment, user, oystehr);
      } catch (error: unknown) {
        // todo tell the user there was an error
        console.log('error adding comment: ', error);
        setApptComment(appointment.comment || '');
      }
      setNoteSaving(false);
      setEditingRow(false);
      setEditingComment(false);
      await updateAppointments();
    },
    [oystehr, appointment, setEditingComment, updateAppointments, apptComment, user]
  );

  const inputComponent = useMemo(
    () => (
      <>
        <Input
          inputRef={inputRef}
          placeholder={'Add internal note...'}
          value={apptComment}
          onChange={(e) => setApptComment(e.target.value)}
          multiline
          disableUnderline={!editingRow}
          inputProps={{
            maxLength: 160,
            style: editingRow
              ? {}
              : {
                  display: '-webkit-box',
                  overflow: 'hidden',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  height: '3em', // Approximate height for 2 lines of text
                },
          }}
          onClick={(_event) => {
            setEditingRow(true);
          }}
          fullWidth
          sx={{ alignItems: 'baseline' }}
          startAdornment={
            <InputAdornment position="start">
              <EditNoteIcon sx={{ fill: theme.palette.text.disabled }} />
            </InputAdornment>
          }
        />
        {editingRow && (
          <LoadingButton loading={noteSaving} sx={{ marginTop: '8px', padding: '5px' }} onClick={saveNote}>
            Save
          </LoadingButton>
        )}
      </>
    ),
    [apptComment, editingRow, noteSaving, saveNote, theme.palette.text.disabled]
  );

  return isOverflowing && !editingRow ? (
    <GenericToolTip title={apptComment}>
      <span style={{ display: 'inline-block', width: '100%' }}>{inputComponent}</span>
    </GenericToolTip>
  ) : (
    inputComponent
  );
};

export default AppointmentNote;
