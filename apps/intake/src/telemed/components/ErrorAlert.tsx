import { Alert, Snackbar } from '@mui/material';
import { FC } from 'react';
import { useIntakeCommonStore } from '../features/common';

export const ErrorAlert: FC = () => {
  const error = useIntakeCommonStore((state) => state.error);

  return (
    <Snackbar
      open={!!error}
      autoHideDuration={6000}
      onClose={() => useIntakeCommonStore.setState({ error: '' })}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        onClose={() => useIntakeCommonStore.setState({ error: '' })}
        severity="error"
        variant="filled"
        sx={{ width: '100%' }}
      >
        {error}
      </Alert>
    </Snackbar>
  );
};
