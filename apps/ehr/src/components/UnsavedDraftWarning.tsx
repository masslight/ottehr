import { Alert, Typography } from '@mui/material';
import { FC } from 'react';

interface UnsavedDraftWarningProps {
  message: string;
}

export const UnsavedDraftWarning: FC<UnsavedDraftWarningProps> = ({ message }) => {
  return (
    <Alert severity="warning" sx={{ mt: 1 }}>
      <Typography variant="body2">{message}</Typography>
    </Alert>
  );
};
