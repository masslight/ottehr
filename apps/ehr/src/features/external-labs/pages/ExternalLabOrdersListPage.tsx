import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LabOrderDTO } from 'utils';
import { Box, Button, Paper, Typography, useTheme, CircularProgress, Stack } from '@mui/material';
import ExternalLabsTable from '../components/ExternalLabsTable';
import { useApiClients } from '../../../hooks/useAppClients';
import { getLabOrders } from '../../../api/api';
import { useAppointmentStore } from '../../../telemed/state/appointment/appointment.store';

interface ExternalLabOrdersListPageProps {
  appointmentID?: string;
  encounterId?: string;
}

export const ExternalLabOrdersListPage: React.FC<ExternalLabOrdersListPageProps> = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { oystehrZambda } = useApiClients();
  const [labOrders, setLabOrders] = useState<LabOrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const encounterId = useAppointmentStore((state) => state.encounter?.id);

  const handleCreateOrder = useCallback((): void => {
    navigate('create');
  }, [navigate]);

  useEffect(() => {
    const fetchLabOrders = async (): Promise<void> => {
      if (!oystehrZambda) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (!encounterId) {
          setError('encounter ID is required to fetch lab orders');
          setLoading(false);
          return;
        }

        const params = {
          encounterId,
        };

        const response = await getLabOrders(oystehrZambda, params);

        console.log('Lab orders fetched successfully:', response);
        setLabOrders(response);
      } catch (error) {
        console.error('Error fetching lab orders:', error);
        setError('Failed to fetch lab orders. Please try again later.');
        setLabOrders([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchLabOrders();
  }, [oystehrZambda, encounterId]);

  useEffect(() => {
    if (!loading && labOrders.length === 0 && !error) {
      handleCreateOrder();
    }
  }, [loading, labOrders, handleCreateOrder, error]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ padding: 4 }}>
        <Typography color="error" variant="h6" gutterBottom>
          {error}
        </Typography>
        <Button variant="contained" onClick={handleCreateOrder} sx={{ mt: 2 }}>
          Create New Lab Order
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ padding: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h2" gutterBottom sx={{ flexGrow: 1, color: theme.palette.primary.dark }}>
          Labs
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
      <Paper>
        <ExternalLabsTable labOrders={labOrders} />
      </Paper>
    </Box>
  );
};
