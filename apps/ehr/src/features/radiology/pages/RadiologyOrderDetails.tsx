import { Button, Typography } from '@mui/material';
import { Box, Stack } from '@mui/system';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CSSPageTitle } from '../../../telemed/components/PageTitle';
import radiologyIcon from '../../../themes/ottehr/icons/mui-radiology.svg';
import { LabOrderLoading } from '../components/labs-orders/LabOrderLoading';
import { WithRadiologyBreadcrumbs } from '../components/labs-orders/RadiologyBreadcrumbs';
import { RadiologyOrderHistoryCard } from '../components/labs-orders/RadiologyOrderHistoryCard';
import { RadiologyTableStatusChip } from '../components/labs-orders/RadiologyTableStatusChip';
import { usePatientRadiologyOrders } from '../components/labs-orders/usePatientRadiologyOrders';

export const RadiologyOrderDetailsPage: React.FC = () => {
  const urlParams = useParams();
  const serviceRequestId = urlParams.serviceRequestID as string;
  const navigate = useNavigate();

  const { orders, loading } = usePatientRadiologyOrders({
    serviceRequestId,
  });

  const handleBack = (): void => {
    navigate(-1);
  };

  const order = orders.find((order) => order.serviceRequestId === serviceRequestId);

  if (loading || !order) {
    return <LabOrderLoading />;
  }

  return (
    <WithRadiologyBreadcrumbs sectionName={order.studyType}>
      <div style={{ maxWidth: '714px', margin: '0 auto' }}>
        <Stack spacing={2} sx={{ p: 3 }}>
          <CSSPageTitle>{`Radiology: ${order.studyType}`}</CSSPageTitle>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexDirection: 'row',
                fontWeight: 'bold',
              }}
            >
              <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                {order.diagnosis}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexDirection: 'row' }}>
              <RadiologyTableStatusChip status={order.status} />
            </Box>
          </Box>

          <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff' }}>
            <Box sx={{ padding: 2 }}>
              <Button
                variant="outlined"
                startIcon={
                  <Box
                    sx={{
                      fill: 'gray',
                    }}
                    component="img"
                    src={radiologyIcon}
                    style={{ width: '30px', marginRight: '8px' }}
                  />
                }
                onClick={() => null} // todo: will be released in the future
                sx={{ borderRadius: '50px', textTransform: 'none' }}
                disabled={order.status === 'pending'}
              >
                View Image
              </Button>
              {order.result != null ? (
                <Typography sx={{ mt: 2 }} variant="body2">
                  <div dangerouslySetInnerHTML={{ __html: atob(order.result) }} />
                </Typography>
              ) : (
                <div />
              )}
            </Box>
          </Box>

          <RadiologyOrderHistoryCard orderHistory={order.history} />

          <Button
            variant="outlined"
            color="primary"
            sx={{
              borderRadius: 28,
              padding: '8px 22px',
              alignSelf: 'flex-start',
              marginTop: 2,
              textTransform: 'none',
            }}
            onClick={handleBack}
          >
            Back
          </Button>
        </Stack>
      </div>
    </WithRadiologyBreadcrumbs>
  );

  return <Box>TODO</Box>;
};
