import SendIcon from '@mui/icons-material/Send';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';

interface SendFormDialogProps {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  questionnaires: { id: string; title: string }[];
}

const SEND_FORM_ZAMBDA = 'send-patient-form';

export const SendFormDialog: FC<SendFormDialogProps> = ({ open, onClose, appointmentId, questionnaires }) => {
  const { oystehrZambda } = useApiClients();
  const [selectedId, setSelectedId] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {
    if (!oystehrZambda || !selectedId) return;

    const selected = questionnaires.find((q) => q.id === selectedId);
    if (!selected) return;

    setSending(true);
    try {
      await oystehrZambda.zambda.execute({
        id: SEND_FORM_ZAMBDA,
        appointmentId,
        questionnaireId: selectedId,
        questionnaireName: selected.title,
      });
      enqueueSnackbar(`Form link sent to patient`, { variant: 'success' });
      onClose();
      setSelectedId('');
    } catch (err) {
      console.error('Failed to send form:', err);
      enqueueSnackbar('Failed to send form link', { variant: 'error' });
    } finally {
      setSending(false);
    }
  }, [oystehrZambda, selectedId, appointmentId, questionnaires, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Send Form to Patient</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select a form to send to the patient via SMS. They will receive a link to complete the form.
        </Typography>
        {questionnaires.length === 0 ? (
          <Typography color="text.secondary">No practice-managed questionnaires available.</Typography>
        ) : (
          <FormControl fullWidth size="small">
            <InputLabel>Form</InputLabel>
            <Select value={selectedId} label="Form" onChange={(e) => setSelectedId(e.target.value)} disabled={sending}>
              {questionnaires.map((q) => (
                <MenuItem key={q.id} value={q.id}>
                  {q.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={!selectedId || sending}
          startIcon={sending ? <CircularProgress size={16} /> : <SendIcon />}
        >
          Send
        </Button>
      </DialogActions>
    </Dialog>
  );
};
