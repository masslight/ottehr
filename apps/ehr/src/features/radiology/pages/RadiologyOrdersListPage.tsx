import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, useTheme, Stack } from '@mui/material';
import { useAppointmentStore } from '../../../telemed/state/appointment/appointment.store';
import { RadiologyTable, RadiologyTableColumn } from '../components/labs-orders/RadiologyTable';

const radiologyColumns: RadiologyTableColumn[] = ['testType', 'orderAdded', 'provider', 'dx', 'status', 'actions'];

export const RadiologyOrdersListPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const encounterId = useAppointmentStore((state) => state.encounter?.id);

  const handleCreateOrder = useCallback((): void => {
    navigate('create');
  }, [navigate]);

  return (
    <Box sx={{ padding: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h2" gutterBottom sx={{ flexGrow: 1, color: theme.palette.primary.dark }}>
          Radiology
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            onClick={handleCreateOrder}
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
        </Stack>
      </Box>
      <RadiologyTable
        encounterId={encounterId}
        columns={radiologyColumns}
        showFilters={false}
        allowDelete={true}
        redirectToOrderCreateIfOrdersEmpty={true}
        onCreateOrder={handleCreateOrder}
      />
    </Box>
  );
};
