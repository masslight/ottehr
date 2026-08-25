import ArrowDropDownCircleOutlinedIcon from '@mui/icons-material/ArrowDropDownCircleOutlined';
import { Box, Button, CircularProgress, Collapse, Divider, IconButton, Paper, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dataTestIds } from 'src/constants/data-test-ids';
import { ButtonRounded } from 'src/features/visits/in-person/components/RoundedButton';
import { BreadCrumbs } from '../components/BreadCrumbs';
import { History } from '../components/details/History';
import { OrderDetails } from '../components/details/OrderDetails';
import { useGetNursingOrders, useUpdateNursingOrder } from '../components/orders/useNursingOrders';

interface NursingOrderDetailsPageProps {
  // 'inline' takes the order id from props instead of the URL, drops the breadcrumbs and
  // leaves via onBack — used by the Review & Sign inline edit flow
  variant?: 'page' | 'inline';
  serviceRequestId?: string;
  onBack?: () => void;
}

export const NursingOrderDetailsPage: React.FC<NursingOrderDetailsPageProps> = ({
  variant = 'page',
  serviceRequestId,
  onBack,
}) => {
  const navigate = useNavigate();
  const isInline = variant === 'inline';
  const { serviceRequestID: serviceRequestIdFromUrl } = useParams<{ serviceRequestID: string }>();
  const serviceRequestID = isInline ? serviceRequestId : serviceRequestIdFromUrl;

  const [showHistory, setShowHistory] = useState(true);

  const { nursingOrders, loading, error } = useGetNursingOrders({
    searchBy: { field: 'serviceRequestId', value: serviceRequestID || '' },
  });

  const order = nursingOrders.find((order) => order.serviceRequestId === serviceRequestID);

  const handleBack = (): void => {
    if (isInline) {
      onBack?.();
      return;
    }
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

      // Back to the list view
      handleBack();
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
        {!isInline && <BreadCrumbs />}

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
          <Collapse in={showHistory} data-testid={dataTestIds.nursingOrderDetailsPage.historyToggleButton}>
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
