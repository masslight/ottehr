import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
import React, { useMemo, useState } from 'react';
import { Box, Paper, Typography, Button, CircularProgress, Collapse, IconButton, Divider } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { ButtonRounded } from 'src/features/css-module/components/RoundedButton';
import { OrderDetails } from '../components/details/OrderDetails';
import { getSelectors, NursingOrdersSearchBy } from 'utils';
import { History } from '../components/details/History';
import { BreadCrumbs } from '../components/BreadCrumbs';
import { useGetNursingOrders, useUpdateNursingOrder } from '../components/orders/useNursingOrders';
import { useAppointmentStore } from 'src/telemed';

export const NursingOrderDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { serviceRequestID } = useParams<{ serviceRequestID: string }>();

  const [showHistory, setShowHistory] = useState(true);
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);

  const searchBy: NursingOrdersSearchBy | undefined = useMemo(() => {
    if (!serviceRequestID) return undefined;

    return {
      field: 'serviceRequestId',
      value: serviceRequestID,
    };
  }, [serviceRequestID]);

  const { nursingOrders, loading, error } = useGetNursingOrders({
    encounterId: encounter.id || '',
    searchBy,
  });

  const order = nursingOrders.find((order) => order.serviceRequestId === serviceRequestID);

  const handleBack = (): void => {
    navigate(-1);
  };

  const handleToggleDetails = (): void => {
    setShowHistory(!showHistory);
  };

  const { updateNursingOrder } = useUpdateNursingOrder({
    serviceRequestId: serviceRequestID,
    action: 'COMPLETE ORDER',
  });

  const handleSubmit = async (): Promise<void> => {
    try {
      await updateNursingOrder();

      // Navigate back to the list view
      navigate(-1);
    } catch (error) {
      console.error('Error completing nursing order:', error);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Paper sx={{ mb: 2 }}>
        <Typography color="error" variant="body1" gutterBottom>
          {'Failed to fetch nursing order details. Please try again later.'}
        </Typography>
      </Paper>
    );
  }

  if (!order) {
    return (
      <Box>
        <Button variant="outlined" onClick={handleBack} sx={{ mb: 2, borderRadius: '50px', px: 4 }}>
          Back
        </Button>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error">
            Test details not found
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: '680px', width: '100%' }}>
        <BreadCrumbs />

        <OrderDetails orderDetails={order} onSubmit={handleSubmit} />

        <Paper>
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, backgroundColor: '#F4F6F8' }}>
            <IconButton onClick={handleToggleDetails} sx={{ mr: 0.75, p: 0 }}>
              <ArrowDropDownCircleOutlinedIcon
                color="primary"
                sx={{
                  rotate: showHistory ? '' : '180deg',
                }}
              ></ArrowDropDownCircleOutlinedIcon>
            </IconButton>
            <Typography variant="subtitle2" color="primary.dark" sx={{ fontSize: '14px' }}>
              Order History
            </Typography>
          </Box>
          <Divider />
          <Collapse in={showHistory}>
            <History orderHistory={order.history} />
          </Collapse>
        </Paper>

        <ButtonRounded
          variant="outlined"
          onClick={handleBack}
          sx={{ borderRadius: '50px', px: 4, alignSelf: 'flex-start' }}
        >
          Back
        </ButtonRounded>
      </Box>
    </Box>
  );
};
