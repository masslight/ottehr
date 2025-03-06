import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Paper,
  Typography,
  useTheme,
  CircularProgress,
  Stack,
  Switch,
  FormControlLabel,
} from '@mui/material';
import ExternalLabsTable from '../components/ExternalLabsTable';
import { useApiClients } from '../../../hooks/useAppClients';
import { LabOrderDTO, mockLabOrders } from '../helpers/types';

interface ExternalLabOrdersListPageProps {
  appointmentID?: string;
  encounterId?: string;
}

export const ExternalLabOrdersListPage: React.FC<ExternalLabOrdersListPageProps> = ({ appointmentID, encounterId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const { oystehr } = useApiClients();
  const [labOrders, setLabOrders] = useState<LabOrderDTO[]>([]);
  const [loading, setLoading] = useState(true);

  // todo: temporary solution to check for useMockData in URL query params
  const queryParams = new URLSearchParams(location.search);

  // todo: temporary solution to remove, it's only for showing page with a mock data because by default we redirected to create page if no orders are available
  const forceStayOnListTable = queryParams.get('useMockData') === 'true';

  // Use appointmentID from props or from URL params
  const currentAppointmentId = appointmentID || params.appointmentId;
  const currentEncounterId = encounterId || params.encounterId;

  const handleCreateOrder = useCallback((): void => {
    navigate('create', {
      state: {
        appointmentId: currentAppointmentId,
        encounterId: currentEncounterId,
      },
    });
  }, [navigate, currentAppointmentId, currentEncounterId]);

  const loadMockData = useCallback((): void => {
    try {
      if (Array.isArray(mockLabOrders) && mockLabOrders.length > 0) {
        console.log('Mock data loaded successfully:', mockLabOrders);
        setLabOrders(mockLabOrders);
      } else {
        console.error('Mock data is not an array or is empty');
      }
    } catch (error) {
      console.error('Error loading mock data:', error);
    }
  }, []);

  useEffect(() => {
    // todo: temporary demo implementations
    const fetchLabOrders = async (): Promise<void> => {
      if (!oystehr || !currentEncounterId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      // todo: temporary solution to load mock data
      if (forceStayOnListTable) {
        console.log('Using mock data, calling loadMockData()');
        loadMockData();
        return;
      }

      try {
        // todo: implement the real API call
        // example:
        // const response = await getLabOrdersForEncounter(oystehr, { encounterId: currentEncounterId });
        // setLabOrders(response.labOrders);

        setLabOrders([]);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching lab orders:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchLabOrders();
  }, [oystehr, currentEncounterId, forceStayOnListTable, loadMockData]);

  useEffect(() => {
    if (!loading && labOrders.length === 0 && !forceStayOnListTable) {
      handleCreateOrder();
    }
  }, [loading, labOrders, handleCreateOrder, forceStayOnListTable]);

  const handleToggleMockData = (): void => {
    if (labOrders.length === 0) {
      setLabOrders(mockLabOrders);
    } else {
      setLabOrders([]);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: 4 }}>
        <CircularProgress />
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
          <FormControlLabel
            control={<Switch checked={labOrders.length !== 0} onChange={handleToggleMockData} color="primary" />}
            label="Use mock data"
          />
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
