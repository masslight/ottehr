import { LoadingButton } from '@mui/lab';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useEffect, useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { DmeMenuItem } from 'utils/lib/types/api/dme.types';
import { useCreateDmeMenuItem, useUpdateDmeMenuItem } from '../dme.queries';
import { HcpcsCode, HcpcsCodesInput } from './HcpcsCodesInput';

interface DmeMenuItemDialogProps {
  open: boolean;
  item?: DmeMenuItem;
  onClose: () => void;
}

export function DmeMenuItemDialog({ open, item, onClose }: DmeMenuItemDialogProps): ReactElement {
  const createMutation = useCreateDmeMenuItem();
  const updateMutation = useUpdateDmeMenuItem();
  const { reset: resetCreate } = createMutation;
  const { reset: resetUpdate } = updateMutation;

  const isEditing = item !== undefined;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const saveError = isEditing ? updateMutation.error : createMutation.error;

  const [name, setName] = useState('');
  const [hcpcsCodes, setHcpcsCodes] = useState<HcpcsCode[]>([]);

  useEffect(() => {
    if (open) {
      setName(item?.name ?? '');
      setHcpcsCodes(item?.hcpcsCodes.map(({ code, display }) => ({ code, display })) ?? []);
      resetCreate();
      resetUpdate();
    }
  }, [open, item, resetCreate, resetUpdate]);

  const handleClose = (): void => {
    if (!isSaving) onClose();
  };

  const handleSave = (): void => {
    const input = { name: name.trim(), hcpcsCodes };
    if (!input.name) return;
    if (item) {
      updateMutation.mutate(
        { menuItemId: item.id, ...input },
        {
          onSuccess: () => {
            enqueueSnackbar('DME item updated', { variant: 'success' });
            onClose();
          },
        }
      );
    } else {
      createMutation.mutate(input, {
        onSuccess: () => {
          enqueueSnackbar('DME item added', { variant: 'success' });
          onClose();
        },
      });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth data-testid={dataTestIds.dmeMenu.dialog}>
      <DialogTitle>{isEditing ? 'Edit DME item' : 'Add DME item'}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Name"
            placeholder="e.g. Ankle Brace"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            fullWidth
            disabled={isSaving}
            inputProps={{ 'data-testid': dataTestIds.dmeMenu.nameField }}
          />
          <HcpcsCodesInput
            value={hcpcsCodes}
            onChange={setHcpcsCodes}
            disabled={isSaving}
            dataTestId={dataTestIds.dmeMenu.hcpcsField}
          />
          {saveError && (
            <Alert severity="error" data-testid={dataTestIds.dmeMenu.dialogError}>
              {saveError.message || 'Failed to save the DME item'}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSaving}>
          Cancel
        </Button>
        <LoadingButton
          loading={isSaving}
          onClick={handleSave}
          disabled={!name.trim()}
          variant="contained"
          data-testid={dataTestIds.dmeMenu.saveButton}
        >
          Save
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
}
