import { Close as CloseIcon } from '@mui/icons-material';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField } from '@mui/material';
import { ReactElement, useState } from 'react';
import { getApiError } from 'utils';
import { importEra } from '../api/api';
import { useApiClients } from '../hooks/useAppClients';

interface Props {
  onClose: () => void;
}

export function ImportEraDialog({ onClose }: Props): ReactElement {
  const { oystehrZambda } = useApiClients();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [eraX12, setEraX12] = useState<string>('');

  const handleImport = async (): Promise<void> => {
    if (!oystehrZambda) return;
    setSaving(true);
    setError(null);
    try {
      const _data = await importEra(oystehrZambda, {
        era: eraX12,
      });
      onClose();
    } catch (err) {
      setError(getApiError({ error: err, defaultError: 'Failed to import ERA' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 680, maxWidth: '95vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Import ERA
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 0 }}>
        <TextField
          size="small"
          fullWidth
          multiline
          placeholder="ERA in X12 format"
          value={eraX12}
          minRows={20}
          onChange={(e) => setEraX12(e.target.value)}
        />
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={() => void handleImport()} disabled={saving}>
          {saving ? 'Importing...' : 'Import'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
