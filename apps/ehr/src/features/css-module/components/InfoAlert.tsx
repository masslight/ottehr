import { Alert, Typography } from '@mui/material';
import { FC, useState } from 'react';

type InfoAlertProps = {
  text: string;
  persistent?: boolean;
};

export const InfoAlert: FC<InfoAlertProps> = ({ text, persistent }) => {
  const [open, setOpen] = useState(true);

  if (!open) {
    return null;
  }

  return (
    <Alert
      severity="info"
      onClose={persistent ? undefined : () => setOpen(false)}
      sx={{
        backgroundColor: '#e6f3fa',
      }}
    >
      <Typography color="primary.dark">{text}</Typography>
    </Alert>
  );
};
