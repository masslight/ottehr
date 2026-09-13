import { ArrowForward as ArrowForwardIcon, Close as CloseIcon } from '@mui/icons-material';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import { ReactElement, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { emptyRemitForm, isRemitFormComplete, RemitFields, RemitForm } from './RemitFields';

interface Props {
  onClose: () => void;
}

// UI-only prototype: collects the remit header and hands it to the RemitDetail screen via
// location.state — nothing is persisted.
export function EnterRemitDialog({ onClose }: Props): ReactElement {
  const navigate = useNavigate();
  const [form, setForm] = useState<RemitForm>(emptyRemitForm);

  const handleContinue = (): void => {
    navigate('/remits/new', { state: { form } });
  };

  return (
    <Dialog open onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 720, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Enter Remit Manually</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Key in the details from a paper or PDF remittance advice. You will be able to attach scans and associate
          claims on the next screen.
        </Typography>
        <RemitFields form={form} onChange={setForm} />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon fontSize="small" />}
          onClick={handleContinue}
          disabled={!isRemitFormComplete(form)}
        >
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
}
