import { Autocomplete, TextField } from '@mui/material';
import { FC, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { ProcedureQuickPickData } from 'utils/lib/types/api/quick-picks.types';

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
      <AppDialog
        variant="form"
        size="s"
        open={open}
        onClose={onClose}
        title="Add to Quick Picks"
        primary={{
          label: 'Save Quick Pick',
          loading: saving,
          disabled: !name.trim(),
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
            if (targetId) {
              onSave(targetId);
            }
          },
        }}
      >
        A quick pick named &ldquo;{overwriteTarget?.name}&rdquo; already exists. Do you want to replace it with the
        current procedure data?
      </AppDialog>
    </>
  );
};
