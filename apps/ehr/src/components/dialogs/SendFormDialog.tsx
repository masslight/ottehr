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
import { FC, useCallback, useMemo, useState } from 'react';
import { sendPatientForm } from 'src/api/api';
import { usePracticeManagedQuestionnaireList } from 'src/features/visits/telemed/components/admin/admin.queries';
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
  const [questionnaireResponseId, setQuestionnaireResponseId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);

  const { data, isLoading: loading, error: loadError } = usePracticeManagedQuestionnaireList();

  const questionnaires = (data?.practiceManagedQuestionnaires || [])
    .slice()
    .sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  const formUrl = useMemo(() => {
    if (!questionnaireResponseId || !PATIENT_APP_URL) return '';
    return `${PATIENT_APP_URL}/forms/${questionnaireResponseId}`;
  }, [questionnaireResponseId]);

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
      const response = await sendPatientForm(oystehrZambda, { appointmentId, questionnaireId: selectedId });
      enqueueSnackbar('Form link sent to patient', { variant: 'success' });
      setQuestionnaireResponseId(response.questionnaireResponseId);
    } catch (err) {
      console.error('Failed to send form:', err);
      enqueueSnackbar('Failed to send form link', { variant: 'error' });
    } finally {
      setSending(false);
    }
  }, [oystehrZambda, selectedId, appointmentId]);

  const handleClose = (): void => {
    onClose();
    setSelectedId('');
    setQuestionnaireResponseId(undefined);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Send Form to Patient</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select a form to send to the patient via SMS.
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
        {questionnaireResponseId ? (
          <Button onClick={handleClose}>Close</Button>
        ) : (
          <Box>
            <Button onClick={handleClose} disabled={sending}>
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
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
};
