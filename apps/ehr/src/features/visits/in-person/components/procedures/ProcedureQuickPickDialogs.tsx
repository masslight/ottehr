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
import { FC, useState } from 'react';
import { ProcedureQuickPickData } from 'utils';

interface ProcedureQuickPickDialogsProps {
  open: boolean;
  name: string;
  onNameChange: (name: string) => void;
  existingQuickPicks: ProcedureQuickPickData[];
  saving: boolean;
  onClose: () => void;
  onSave: (overwriteId?: string) => void;
}

export const ProcedureQuickPickDialogs: FC<ProcedureQuickPickDialogsProps> = ({
  open,
  name,
  onNameChange,
  existingQuickPicks,
  saving,
  onClose,
  onSave,
}) => {
  const [overwriteTarget, setOverwriteTarget] = useState<ProcedureQuickPickData | null>(null);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add to Quick Picks</DialogTitle>
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
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!name.trim() || saving}
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
        <DialogTitle>Update Existing Quick Pick?</DialogTitle>
        <DialogContent>
          <Typography>
            A quick pick named &ldquo;{overwriteTarget?.name}&rdquo; already exists. Do you want to replace it with the
            current procedure data?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOverwriteTarget(null)}>Back</Button>
          <Button
            variant="contained"
            onClick={() => {
              const targetId = overwriteTarget?.id;
              setOverwriteTarget(null);
              if (targetId) {
                onSave(targetId);
              }
            }}
          >
            Replace
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
