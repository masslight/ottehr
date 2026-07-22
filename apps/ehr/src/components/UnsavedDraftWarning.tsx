import { Alert, Button, Typography } from '@mui/material';
import { FC } from 'react';

interface UnsavedDraftWarningProps {
  message: string;
  onClearAll?: () => void;
}

export const UnsavedDraftWarning: FC<UnsavedDraftWarningProps> = ({ message, onClearAll }) => {
  return (
    <Alert
      severity="warning"
      sx={{ mt: 1 }}
      action={
        onClearAll ? (
          <Button color="inherit" size="small" onClick={onClearAll}>
            Clear all
          </Button>
        ) : undefined
      }
    >
      <Typography variant="body2">{message}</Typography>
    </Alert>
  );
};
