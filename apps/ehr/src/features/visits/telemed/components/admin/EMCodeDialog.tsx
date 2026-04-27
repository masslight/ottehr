import { LoadingButton } from '@mui/lab';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { CPTCodeOption } from 'utils';
import { useAdminCreateEmCodeMutation, useAdminUpdateEmCodeMutation } from './admin.queries';

interface EMCodeDialogProps {
  open: boolean;
  onClose: () => void;
  existingCode?: CPTCodeOption;
}

export default function EMCodeDialog({ open, onClose, existingCode }: EMCodeDialogProps): ReactElement {
  const createMutation = useAdminCreateEmCodeMutation();
  const updateMutation = useAdminUpdateEmCodeMutation();

  const isEditing = existingCode !== undefined;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const [codeInput, setCodeInput] = useState('');
  const [displayInput, setDisplayInput] = useState('');

  useEffect(() => {
    if (open) {
      setCodeInput(existingCode?.code ?? '');
      setDisplayInput(existingCode?.display ?? '');
    }
  }, [open, existingCode]);

  const handleSave = (): void => {
    if (!codeInput.trim() || !displayInput.trim()) return;
    const mutation = isEditing ? updateMutation : createMutation;
    mutation.mutate({ code: codeInput.trim(), display: displayInput.trim() }, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth data-testid={dataTestIds.emCodesAdminPage.dialog}>
      <DialogTitle>{isEditing ? 'Edit E&M Code' : 'Add E&M Code'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Code"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            disabled={isEditing}
            fullWidth
            inputProps={{ 'data-testid': dataTestIds.emCodesAdminPage.codeField }}
          />
          <TextField
            label="Display"
            value={displayInput}
            onChange={(e) => setDisplayInput(e.target.value)}
            fullWidth
            inputProps={{ 'data-testid': dataTestIds.emCodesAdminPage.displayField }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <LoadingButton
          loading={isSaving}
          onClick={handleSave}
          disabled={!codeInput.trim() || !displayInput.trim()}
          variant="contained"
          data-testid={dataTestIds.emCodesAdminPage.saveButton}
        >
          Save
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
