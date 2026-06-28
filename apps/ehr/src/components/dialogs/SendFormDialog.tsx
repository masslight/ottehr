import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { managedQuestionnaireList, sendPatientForm } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';

interface SendFormDialogProps {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
}

const PATIENT_APP_URL = import.meta.env.VITE_APP_PATIENT_APP_URL || '';

export const SendFormDialog: FC<SendFormDialogProps> = ({ open, onClose, appointmentId }) => {
  const { oystehrZambda } = useApiClients();
  const [selectedId, setSelectedId] = useState('');
  const [sending, setSending] = useState(false);
  const [questionnaires, setQuestionnaires] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!open || !oystehrZambda) return;
    // Guard against out-of-order results from rapid close/reopen.
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    managedQuestionnaireList(oystehrZambda)
      .then((result) => {
        if (cancelled) return;
        setQuestionnaires(
          (result.managedQuestionnaires || [])
            .filter((q: any) => q.status === 'active')
            .map((q: any) => ({ id: q.id, title: q.title || q.name || 'Untitled' }))
            .sort((a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title))
        );
      })
      .catch((err) => {
        if (cancelled) return;
        // A failed fetch must not masquerade as "no questionnaires available".
        console.error('Failed to load questionnaires:', err);
        setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, oystehrZambda]);

  const formUrl = useMemo(() => {
    if (!selectedId || !PATIENT_APP_URL) return '';
    if (appointmentId) return `${PATIENT_APP_URL}/forms/${appointmentId}/${selectedId}`;
    return '';
  }, [selectedId, appointmentId]);

  const handleCopyUrl = useCallback(() => {
    if (!formUrl) return;
    void navigator.clipboard.writeText(formUrl).then(() => {
      enqueueSnackbar('Form URL copied to clipboard', { variant: 'success' });
    });
  }, [formUrl]);

  const handleSend = useCallback(async () => {
    if (!oystehrZambda || !selectedId) return;

    setSending(true);
    try {
      await sendPatientForm(oystehrZambda, { appointmentId, questionnaireId: selectedId });
      enqueueSnackbar('Form link sent to patient', { variant: 'success' });
      onClose();
      setSelectedId('');
    } catch (err) {
      console.error('Failed to send form:', err);
      enqueueSnackbar('Failed to send form link', { variant: 'error' });
    } finally {
      setSending(false);
    }
  }, [oystehrZambda, selectedId, appointmentId, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Send Form to Patient</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select a form to send to the patient via SMS, or copy the link to share directly.
        </Typography>
        {loading ? (
          <CircularProgress size={24} />
        ) : loadError ? (
          <Typography color="error">Could not load forms. Close and reopen to retry.</Typography>
        ) : questionnaires.length === 0 ? (
          <Typography color="text.secondary">No practice-managed questionnaires available.</Typography>
        ) : (
          <>
            <Autocomplete
              size="small"
              options={questionnaires}
              getOptionLabel={(opt) => opt.title}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              value={questionnaires.find((q) => q.id === selectedId) || null}
              onChange={(_, value) => setSelectedId(value?.id || '')}
              disabled={sending}
              autoHighlight
              renderInput={(params) => <TextField {...params} label="Form" placeholder="Type to filter…" />}
            />
            {formUrl && (
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  size="small"
                  fullWidth
                  value={formUrl}
                  InputProps={{
                    readOnly: true,
                    sx: { fontSize: 12, fontFamily: 'monospace' },
                  }}
                />
                <Tooltip title="Copy URL">
                  <IconButton size="small" onClick={handleCopyUrl}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={!selectedId || sending || loading}
          startIcon={sending ? <CircularProgress size={16} /> : <SendIcon />}
        >
          Send via SMS
        </Button>
      </DialogActions>
    </Dialog>
  );
};
