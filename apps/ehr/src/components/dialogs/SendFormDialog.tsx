import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SendIcon from '@mui/icons-material/Send';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { listPracticeManagedQuestionnaires } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';

interface SendFormDialogProps {
  open: boolean;
  onClose: () => void;
  /** Appointment-scoped send: link is tied to an encounter. */
  appointmentId?: string;
  /** Patient-scoped send (no encounter): link is tied to the patient record only. */
  patientId?: string;
}

const SEND_FORM_ZAMBDA = 'send-patient-form';
const PATIENT_APP_URL = import.meta.env.VITE_APP_PATIENT_APP_URL || '';

export const SendFormDialog: FC<SendFormDialogProps> = ({ open, onClose, appointmentId, patientId }) => {
  const { oystehrZambda } = useApiClients();
  const [selectedId, setSelectedId] = useState('');
  const [sending, setSending] = useState(false);
  const [questionnaires, setQuestionnaires] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !oystehrZambda) return;
    setLoading(true);
    listPracticeManagedQuestionnaires(oystehrZambda)
      .then((result) => {
        setQuestionnaires(
          (result.questionnaires || [])
            .filter((q: any) => q.status === 'active')
            .map((q: any) => ({ id: q.id, title: q.title || q.name || 'Untitled' }))
        );
      })
      .catch((err) => {
        console.error('Failed to load questionnaires:', err);
      })
      .finally(() => setLoading(false));
  }, [open, oystehrZambda]);

  const formUrl = useMemo(() => {
    if (!selectedId || !PATIENT_APP_URL) return '';
    if (appointmentId) return `${PATIENT_APP_URL}/forms/${appointmentId}/${selectedId}`;
    if (patientId) return `${PATIENT_APP_URL}/forms/patient/${patientId}/${selectedId}`;
    return '';
  }, [selectedId, appointmentId, patientId]);

  const handleCopyUrl = useCallback(() => {
    if (!formUrl) return;
    void navigator.clipboard.writeText(formUrl).then(() => {
      enqueueSnackbar('Form URL copied to clipboard', { variant: 'success' });
    });
  }, [formUrl]);

  const handleSend = useCallback(async () => {
    if (!oystehrZambda || !selectedId) return;

    const selected = questionnaires.find((q) => q.id === selectedId);
    if (!selected) return;

    setSending(true);
    try {
      await oystehrZambda.zambda.execute({
        id: SEND_FORM_ZAMBDA,
        ...(appointmentId ? { appointmentId } : { patientId }),
        questionnaireId: selectedId,
        questionnaireName: selected.title,
      } as any);
      enqueueSnackbar('Form link sent to patient', { variant: 'success' });
      onClose();
      setSelectedId('');
    } catch (err) {
      console.error('Failed to send form:', err);
      enqueueSnackbar('Failed to send form link', { variant: 'error' });
    } finally {
      setSending(false);
    }
  }, [oystehrZambda, selectedId, appointmentId, patientId, questionnaires, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Send Form to Patient</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select a form to send to the patient via SMS, or copy the link to share directly.
        </Typography>
        {loading ? (
          <CircularProgress size={24} />
        ) : questionnaires.length === 0 ? (
          <Typography color="text.secondary">No practice-managed questionnaires available.</Typography>
        ) : (
          <>
            <FormControl fullWidth size="small">
              <InputLabel>Form</InputLabel>
              <Select
                value={selectedId}
                label="Form"
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={sending}
              >
                {questionnaires.map((q) => (
                  <MenuItem key={q.id} value={q.id}>
                    {q.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
