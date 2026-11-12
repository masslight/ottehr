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
import { ReactElement, useEffect, useState } from 'react';

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
  /** A read-only line under the name on what else is saved ("Saved by weight: …"). */
  details?: string;
  /** The name field's hint. */
  placeholder?: string;
  /** Why the name can't be saved, under the name field. */
  nameError?: string;
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
  details,
  placeholder = 'Enter a name or select an existing quick pick',
  nameError,
}: QuickPickSaveDialogsProps<T>): ReactElement => {
  const [overwriteTarget, setOverwriteTarget] = useState<T | null>(null);
  // The pick chosen from the dropdown, so Replace targets it by id even when two picks share a name.
  const [selected, setSelected] = useState<T | null>(null);

  useEffect(() => {
    if (open) setSelected(null);
  }, [open]);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={titleSx}>Add to Quick Picks</DialogTitle>
        <DialogContent>
          <Autocomplete<T, false, false, true>
            freeSolo
            options={existingQuickPicks}
            getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
            getOptionKey={(option) => (typeof option === 'string' ? option : option.id ?? option.name)}
            value={selected ?? name}
            inputValue={name}
            onChange={(_e, newValue) => {
              if (typeof newValue === 'string' || newValue == null) {
                setSelected(null);
                onNameChange(newValue ?? '');
              } else {
                setSelected(newValue);
                onNameChange(newValue.name);
              }
            }}
            onInputChange={(_e, newInputValue, reason) => {
              if (reason === 'reset') return;
              setSelected(null);
              onNameChange(newInputValue);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Quick Pick Name"
                fullWidth
                sx={{ mt: 1 }}
                autoFocus
                placeholder={placeholder}
                error={!!nameError}
                helperText={nameError}
              />
            )}
          />
          {details && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }} data-testid="quick-pick-details">
              {details}
            </Typography>
          )}
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
              const typed = name.trim().toLowerCase();
              const existing =
                selected?.name.toLowerCase() === typed
                  ? selected
                  : existingQuickPicks.find((quickPick) => quickPick.name.toLowerCase() === typed);
              if (existing?.id) {
                // Replacing keeps the existing pick's name, not the case/whitespace variant typed.
                onNameChange(existing.name);
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
