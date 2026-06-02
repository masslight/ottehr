import { LoadingButton } from '@mui/lab';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { ReactElement, useState } from 'react';
import { phoneRegex, standardizePhoneNumber } from 'utils';
import InputMask from './InputMask';

export interface EditSupportPhoneDialogProps {
  open: boolean;
  initialValue: string;
  bulkCount?: number;
  isSaving: boolean;
  onClose: () => void;
  onSave: (phoneNumber: string) => Promise<void>;
}

export const EditSupportPhoneDialog = ({
  open,
  initialValue,
  bulkCount,
  isSaving,
  onClose,
  onSave,
}: EditSupportPhoneDialogProps): ReactElement => {
  const [value, setValue] = useState(() => standardizePhoneNumber(initialValue) ?? initialValue);
  const canSave = value === '' || phoneRegex.test(value);

  const title = bulkCount ? `Update support phone for ${bulkCount} locations` : 'Update support phone';
  const helper = bulkCount
    ? `The same number will be applied to all ${bulkCount} selected locations. Leave blank to clear.`
    : 'Leave blank to clear the support phone for this location.';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {helper}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="Support phone number"
          type="tel"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={isSaving}
          inputProps={{ mask: '(000) 000-0000' }}
          InputProps={{
            inputComponent: InputMask as any,
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <LoadingButton variant="contained" loading={isSaving} disabled={!canSave} onClick={() => onSave(value)}>
          Save
        </LoadingButton>
      </DialogActions>
    </Dialog>
  );
};
