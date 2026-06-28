import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { ReactElement } from 'react';

interface UnauthorizedPageProps {
  onLogout: () => void;
}

export function UnauthorizedPage({ onLogout }: UnauthorizedPageProps): ReactElement {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper elevation={3} sx={{ maxWidth: 520, width: '100%', p: 4 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            Unauthorized
          </Typography>
          <Alert severity="warning">Your account does not have access to the Billing app.</Alert>
          <Typography variant="body2" color="text.secondary">
            Billing access is limited to users with the Administrator or Billing Admin role.
          </Typography>
          <Button variant="contained" onClick={onLogout}>
            Log out
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
