import { Autocomplete, TextField } from '@mui/material';
import { FC, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { DmeQuickPickData } from 'utils/lib/types/api/quick-picks.types';

interface DmeQuickPickDialogsProps {
  open: boolean;
  name: string;
  onNameChange: (name: string) => void;
  existingQuickPicks: DmeQuickPickData[];
  saving: boolean;
  onClose: () => void;
  onSave: (overwriteId?: string) => void;
}

export const DmeQuickPickDialogs: FC<DmeQuickPickDialogsProps> = ({
  open,
  name,
  onNameChange,
  existingQuickPicks,
  saving,
  onClose,
  onSave,
}) => {
  const [overwriteTarget, setOverwriteTarget] = useState<DmeQuickPickData | null>(null);

  return (
    <>
      <AppDialog
        variant="form"
        size="s"
        open={open}
        onClose={onClose}
        title="Add to Quick Picks"
        primary={{
          label: 'Save Quick Pick',
          disabled: !name.trim(),
          loading: saving,
          onClick: () => {
            const existing = existingQuickPicks.find(
              (quickPick) => quickPick.name.toLowerCase() === name.trim().toLowerCase()
            );
            if (existing?.id) {
              setOverwriteTarget(existing);
            } else {
              onSave();
            }
          },
        }}
      >
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
      </AppDialog>

      <AppDialog
        variant="confirm"
        open={overwriteTarget != null}
        onClose={() => setOverwriteTarget(null)}
        title="Update Existing Quick Pick?"
        primary={{
          label: 'Replace',
          onClick: () => {
            const targetId = overwriteTarget?.id;
            setOverwriteTarget(null);
            if (targetId) onSave(targetId);
          },
        }}
      >
        A quick pick named &ldquo;{overwriteTarget?.name}&rdquo; already exists. Do you want to replace it with the
        current DME order data?
      </AppDialog>
    </>
  );
};
