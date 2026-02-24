import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { FC, useEffect, useState } from 'react';

type Props = {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSubmit: (newName: string) => Promise<void>;
};

export const RenameDocumentModal: FC<Props> = ({ open, initialName, onClose, onSubmit }) => {
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(initialName);
  }, [initialName, open]);

  const handleSubmit = async (): Promise<void> => {
    if (!name.trim()) return;
    setLoading(true);
    await onSubmit(name.trim());
    setLoading(false);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Rename document</DialogTitle>

      <DialogContent>
        <TextField autoFocus fullWidth label="Document name *" value={name} onChange={(e) => setName(e.target.value)} />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!name.trim() || loading} onClick={handleSubmit}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
