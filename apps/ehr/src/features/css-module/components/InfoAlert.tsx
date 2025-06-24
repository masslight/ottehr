import { Alert, Typography } from '@mui/material';
import { FC, useState } from 'react';

type InfoAlertProps = {
  text: string;
};

export const InfoAlert: FC<InfoAlertProps> = ({ text }) => {
  const [open, setOpen] = useState(true);

  if (!open) {
    return null;
  }

  return (
    <Alert
      severity="info"
      onClose={() => setOpen(false)}
      sx={{
        backgroundColor: '#e6f3fa',
      }}
    >
      <Typography color="primary.dark">{text}</Typography>
    </Alert>
  );
};
