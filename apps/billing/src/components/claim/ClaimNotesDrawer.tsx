import { Alert, Box, Button, CircularProgress, TextField, Typography } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useEffect, useState } from 'react';
import { CLAIM_NOTE_MAX_LENGTH, ClaimHistoryEntry, getApiError } from 'utils';
import { addBillingClaimNote, getBillingClaimHistory } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { otherColors } from '../../themes/ottehr/colors';
import { formatDateTime } from '../../utils/format';
import { SideDrawer } from '../SideDrawer';

interface ClaimNotesDrawerProps {
  open: boolean;
  onClose: () => void;
  claimId: string;
  onNoteAdded: () => void;
}

export function ClaimNotesDrawer({ open, onClose, claimId, onNoteAdded }: ClaimNotesDrawerProps): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [notes, setNotes] = useState<ClaimHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!oystehrZambda || !claimId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getBillingClaimHistory(oystehrZambda, { claimId });
      setNotes(data.entries.filter((entry) => entry.message));
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to load notes' }));
    } finally {
      setLoading(false);
    }
  }, [oystehrZambda, claimId]);

  useEffect(() => {
    if (open) void fetchNotes();
  }, [open, fetchNotes]);

  const trimmedMessage = message.trim();

  const handleAdd = async (): Promise<void> => {
    if (!oystehrZambda || !trimmedMessage) return;
    setSaving(true);
    try {
      await addBillingClaimNote(oystehrZambda, { claimId, message: trimmedMessage });
      setMessage('');
      await fetchNotes();
      onNoteAdded();
    } catch (err) {
      enqueueSnackbar(getApiError({ error: err, defaultError: 'Failed to add note' }), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  let list: ReactElement;
  if (loading) {
    list = (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  } else if (error) {
    list = <Alert severity="error">{error}</Alert>;
  } else if (!notes || notes.length === 0) {
    list = (
      <Typography variant="body2" color="text.secondary">
        No notes on this claim yet.
      </Typography>
    );
  } else {
    list = (
      <>
        {notes.map((note, index) => (
          <Box
            key={note.id}
            sx={{
              py: 1.5,
              borderTop: index === 0 ? undefined : `1px solid ${otherColors.lightDivider}`,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 1,
                mb: 0.5,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                {note.actor.display}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDateTime(note.recorded)}
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {note.message}
            </Typography>
          </Box>
        ))}
      </>
    );
  }

  return (
    <SideDrawer open={open} onClose={onClose} title="Notes">
      <TextField
        label="Add a note"
        multiline
        fullWidth
        minRows={3}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        disabled={saving}
        inputProps={{ maxLength: CLAIM_NOTE_MAX_LENGTH }}
      />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'flex-end',
          mt: 1.5,
          mb: 1,
        }}
      >
        <Button variant="contained" size="small" onClick={() => void handleAdd()} disabled={!trimmedMessage || saving}>
          {saving ? 'Adding...' : 'Add'}
        </Button>
      </Box>
      {list}
    </SideDrawer>
  );
}
