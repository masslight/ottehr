import {
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';

const buttonSx = { borderRadius: 25, textTransform: 'none', fontWeight: 'bold' } as const;
const titleSx = { color: 'primary.dark', fontWeight: 600 } as const;

interface QuickPickSaveDialogsProps<T extends { id?: string; name: string }> {
  open: boolean;
  name: string;
  onNameChange: (name: string) => void;
  existingQuickPicks: T[];
  saving: boolean;
  onClose: () => void;
  onSave: (overwriteId?: string) => void;
  /** Used in the replace confirmation, e.g. "procedure" or "radiology order". */
  entityLabel: string;
}

export const QuickPickSaveDialogs = <T extends { id?: string; name: string }>({
  open,
  name,
  onNameChange,
  existingQuickPicks,
  saving,
  onClose,
  onSave,
  entityLabel,
}: QuickPickSaveDialogsProps<T>): ReactElement => {
  const [overwriteTarget, setOverwriteTarget] = useState<T | null>(null);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={titleSx}>Add to Quick Picks</DialogTitle>
        <DialogContent>
          <Autocomplete
            freeSolo
            options={existingQuickPicks.map((quickPick) => quickPick.name)}
            value={name}
            onChange={(_e, newValue) => onNameChange(newValue ?? '')}
            onInputChange={(_e, newInputValue) => onNameChange(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Quick Pick Name"
                fullWidth
                sx={{ mt: 1 }}
                autoFocus
                placeholder="Enter a name or select an existing quick pick"
              />
            )}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button variant="outlined" onClick={onClose} disabled={saving} sx={buttonSx}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!name.trim() || saving}
            sx={buttonSx}
            onClick={() => {
              const existing = existingQuickPicks.find(
                (quickPick) => quickPick.name.toLowerCase() === name.trim().toLowerCase()
              );
              if (existing?.id) {
                setOverwriteTarget(existing);
              } else {
                onSave();
              }
            }}
          >
            {saving ? <CircularProgress size={20} /> : 'Save Quick Pick'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={overwriteTarget != null} onClose={() => setOverwriteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={titleSx}>Update Existing Quick Pick?</DialogTitle>
        <DialogContent>
          <Typography>
            A quick pick named &ldquo;{overwriteTarget?.name}&rdquo; already exists. Do you want to replace it with the
            current {entityLabel} data?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
          <Button variant="outlined" onClick={() => setOverwriteTarget(null)} sx={buttonSx}>
            Back
          </Button>
          <Button
            variant="contained"
            sx={buttonSx}
            onClick={() => {
              const targetId = overwriteTarget?.id;
              setOverwriteTarget(null);
              if (targetId) onSave(targetId);
            }}
          >
            Replace
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
