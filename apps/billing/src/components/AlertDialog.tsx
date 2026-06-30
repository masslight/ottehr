import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { ReactElement } from 'react';

interface Props {
  title: string;
  text: string;
  onClose: () => void;
}

export default function AlertDialog({ title, text, onClose }: Props): ReactElement {
  return (
    <Dialog open={true} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 680, maxWidth: '95vw' } }}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{text}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          Ok
        </Button>
      </DialogActions>
    </Dialog>
  );
}
