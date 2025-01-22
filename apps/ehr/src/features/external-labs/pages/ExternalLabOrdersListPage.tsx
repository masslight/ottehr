import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Button, Paper, Typography, useTheme } from '@mui/material';
import ExternalLabsTable from '../components/ExternalLabsTable';

interface ExternalLabOrdersListPageProps {
  appointmentID?: string;
}

export const ExternalLabOrdersListPage: React.FC<ExternalLabOrdersListPageProps> = () => {
  const theme = useTheme();
  return (
    <Box sx={{ padding: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h2" gutterBottom sx={{ flexGrow: 1, color: theme.palette.primary.dark }}>
          Send Out Labs
        </Typography>
        <Button
          component={Link}
          to="create"
          variant="contained"
          sx={{
            textTransform: 'none',
            borderRadius: 28,
            fontWeight: 'bold',
            width: 120,
          }}
        >
          Order
        </Button>
      </Box>
      <Paper>
        <ExternalLabsTable></ExternalLabsTable>
      </Paper>
    </Box>
  );
};
