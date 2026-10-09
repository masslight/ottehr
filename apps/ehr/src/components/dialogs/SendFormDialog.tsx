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
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useMemo, useState } from 'react';
import { sendPatientForm } from 'src/api/api';
import { usePracticeManagedQuestionnaires } from 'src/features/visits/telemed/hooks/usePracticeManagedQuestionnaires';
import { useApiClients } from 'src/hooks/useAppClients';
import {
  FORM_PLACEMENT_LABELS,
  FORM_PLACEMENTS,
  FormPlacement,
} from 'utils/lib/helpers/practice-managed-questionnaires';

interface SendFormDialogProps {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  /** The encounter on screen (a follow-up note has its own); the visit's main encounter when omitted. */
  encounterId?: string;
  /** The form type selected when the dialog opens: the page's own type. */
  placement: FormPlacement;
  /** Called after the link is sent, so the caller can refresh its list. */
  onSent?: () => void;
  /** When given, the dialog also offers filling the chosen form out now instead of sending it. */
  onFillOut?: (questionnaireId: string, placement: FormPlacement) => void;
}

const PATIENT_APP_URL = import.meta.env.VITE_APP_PATIENT_APP_URL || '';

export const SendFormDialog: FC<SendFormDialogProps> = ({
  open,
  onClose,
  appointmentId,
  encounterId,
  placement,
  onSent,
  onFillOut,
}) => {
  const { oystehrZambda } = useApiClients();
  const [selectedId, setSelectedId] = useState('');
  const [questionnaireResponseId, setQuestionnaireResponseId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);

  const { active, isLoading: loading, error: loadError } = usePracticeManagedQuestionnaires();
  const [formType, setFormType] = useState<FormPlacement>(placement);
  const questionnaires = active.filter((q) => q.placement === formType);

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
      const response = await sendPatientForm(oystehrZambda, {
        appointmentId,
        encounterId,
        questionnaireId: selectedId,
      });
      enqueueSnackbar('Form link sent to patient', { variant: 'success' });
      setQuestionnaireResponseId(response.questionnaireResponseId);
      onSent?.();
    } catch (err) {
      console.error('Failed to send form:', err);
      enqueueSnackbar('Failed to send form link', { variant: 'error' });
    } finally {
      setSending(false);
    }
  }, [oystehrZambda, selectedId, appointmentId, encounterId, onSent]);

  const handleClose = (): void => {
    onClose();
    setSelectedId('');
    setQuestionnaireResponseId(undefined);
    setFormType(placement);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{onFillOut ? 'Add Form' : 'Send Form to Patient'}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {onFillOut
            ? 'Select a form to fill out now, or to send to the patient via SMS.'
            : 'Select a form to send to the patient via SMS.'}
        </Typography>
        <TextField
          select
          size="small"
          fullWidth
          label="Form type"
          value={formType}
          onChange={(e) => {
            setFormType(e.target.value as FormPlacement);
            setSelectedId('');
          }}
          disabled={sending}
          sx={{ mb: 2 }}
        >
          {FORM_PLACEMENTS.map((value) => (
            <MenuItem key={value} value={value}>
              {FORM_PLACEMENT_LABELS[value]}
            </MenuItem>
          ))}
        </TextField>
        {loading ? (
          <CircularProgress size={24} />
        ) : loadError ? (
          <Typography color="error">Could not load forms. Close and reopen to retry.</Typography>
        ) : questionnaires.length === 0 ? (
          <Typography color="text.secondary">No forms of this type yet.</Typography>
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
            {onFillOut && (
              <Button
                variant="outlined"
                onClick={() => {
                  onFillOut(selectedId, formType);
                  handleClose();
                }}
                disabled={!selectedId || sending || loading}
                sx={{ mr: 1 }}
              >
                Fill out now
              </Button>
            )}
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
