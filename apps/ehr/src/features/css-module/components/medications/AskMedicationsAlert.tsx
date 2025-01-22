import CloseIcon from '@mui/icons-material/Close';
import { Alert, Collapse, IconButton, Typography } from '@mui/material';
import { FC, useState } from 'react';

export const AskMedicationsAlert: FC = () => {
  const [open, setOpen] = useState(true);

  return (
    <Collapse in={open}>
      <Alert
        severity="info"
        action={
          <IconButton color="inherit" size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="inherit" />
          </IconButton>
        }
        sx={{
          backgroundColor: '#e6f3fa',
        }}
      >
        <Typography color="primary.dark">
          Ask: Has the patient taken any medication in the last 24 hours? Are there any medications that they take every
          day?
        </Typography>
      </Alert>
    </Collapse>
  );
};
