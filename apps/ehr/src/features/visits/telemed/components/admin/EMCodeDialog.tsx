import { Box, TextField } from '@mui/material';
import { ReactElement, useEffect, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { dataTestIds } from 'src/constants/data-test-ids';
import { EmCodeOption } from 'utils/lib/types/api/config/em-codes';
import { useAdminCreateEmCodeMutation, useAdminUpdateEmCodeMutation } from './admin.queries';

interface EMCodeDialogProps {
  open: boolean;
  onClose: () => void;
  existingCode?: EmCodeOption;
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
    <AppDialog
      variant="form"
      size="s"
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit E&M Code' : 'Add E&M Code'}
      data-testid={dataTestIds.emCodesAdminPage.dialog}
      primary={{
        label: 'Save',
        onClick: handleSave,
        loading: isSaving,
        disabled: !codeInput.trim() || !displayInput.trim(),
        'data-testid': dataTestIds.emCodesAdminPage.saveButton,
      }}
      dismiss={{}}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
    </AppDialog>
  );
}
