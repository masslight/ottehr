import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { EMPTY_PAGINATION, LabOrderDTO, Pagination } from 'utils';
import { Box, Button, Paper, Typography, useTheme, CircularProgress, Stack } from '@mui/material';
import { useApiClients } from '../../../hooks/useAppClients';
import { getLabOrders } from '../../../api/api';
import { useAppointmentStore } from '../../../telemed/state/appointment/appointment.store';
import { LabsTable, LabsTableColumn } from '../components/labs-order-table/LabsTable';

interface ExternalLabOrdersListPageProps {
  appointmentID?: string;
  encounterId?: string;
}

interface PaginatedLabOrderResponse {
  data: LabOrderDTO[];
  pagination: Pagination;
}

const externalLabsColumns: LabsTableColumn[] = ['testType', 'orderAdded', 'provider', 'dx', 'status', 'actions'];

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

  // todo: use this hook everywhere
  // const { fetchLabOrders, loading: labOrdersLoading, error: labOrdersError } = usePatientLabOrders();

  const fetchLabOrders = useCallback(
    async (params?: any): Promise<PaginatedLabOrderResponse> => {
      if (!oystehrZambda) {
        setLoading(false);
        return {
          data: [],
          pagination: EMPTY_PAGINATION,
        };
      }

      setLoading(true);
      setError(null);

      try {
        if (!encounterId && !params?.encounterId) {
          setError('encounter ID is required to fetch lab orders');
          setLoading(false);
          return { data: [], pagination: EMPTY_PAGINATION };
        }

        const requestParams = {
          encounterId: params?.encounterId || encounterId,
          ...params,
        };

        const response = await getLabOrders(oystehrZambda, requestParams);

        console.log('Lab orders fetched successfully:', response);

        if (response?.data) {
          setLabOrders(response.data);
        } else {
          setLabOrders([]);
        }

        return response;
      } catch (error) {
        console.error('Error fetching lab orders:', error);
        setError('Failed to fetch lab orders. Please try again later.');
        setLabOrders([]);
        return { data: [], pagination: EMPTY_PAGINATION };
      } finally {
        setLoading(false);
      }
    },
    [oystehrZambda, encounterId]
  );

  useEffect(() => {
    void fetchLabOrders();
  }, [oystehrZambda, encounterId, fetchLabOrders]);

  useEffect(() => {
    if (!loading && labOrders.length === 0 && !error) {
      handleCreateOrder();
    }
  }, [loading, labOrders, handleCreateOrder, error]);

  if (loading && labOrders.length === 0) {
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
        <LabsTable
          labOrders={labOrders}
          fetchLabOrders={fetchLabOrders}
          encounterId={encounterId}
          columns={externalLabsColumns}
          showFilters={false}
          allowDelete={true}
          initialLoading={loading}
        />
      </Paper>
    </Box>
  );
};
