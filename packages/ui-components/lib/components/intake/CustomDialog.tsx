import CloseIcon from '@mui/icons-material/Close';
import { Dialog, DialogProps, IconButton, Paper } from '@mui/material';
import { FC } from 'react';

export const CustomDialog: FC<DialogProps> = (props) => {
  return (
    <Dialog maxWidth="xs" fullWidth {...props}>
      <Paper sx={{ p: { xs: 2.5, md: 5 }, position: 'relative' }}>
        {props.children}
        <IconButton
          onClick={(e) => props.onClose && props.onClose(e, 'backdropClick')}
          size="small"
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon fontSize="small" sx={{ color: '#938B7D' }} />
        </IconButton>
      </Paper>
    </Dialog>
  );
};
