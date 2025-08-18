import { Box, Link, Stack, Typography, useTheme } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import { FC, ReactElement } from 'react';
import { GetRadiologyOrderListZambdaOrder } from 'utils';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../telemed';
import { usePatientRadiologyOrders } from '../../../radiology/components/usePatientRadiologyOrders';

export const RadiologyContainer: FC = () => {
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);
  const theme = useTheme();

  const { orders, loading } = usePatientRadiologyOrders({
    encounterIds: encounter?.id ? [encounter.id] : undefined,
  });

  // Don't render anything if there are no orders and not loading
  if (!loading && (!orders || orders.length === 0)) {
    return null;
  }

  const renderProperty = (label: string, value: string | undefined): ReactElement | undefined => {
    if (value == null || value === '') {
      return undefined;
    }
    return (
      <Box>
        <Typography component="span" sx={{ fontWeight: '500' }}>
          {label}:
        </Typography>{' '}
        {value}
      </Box>
    );
  };

  const renderRadiologyOrder = (order: GetRadiologyOrderListZambdaOrder): ReactElement => {
    // Extract read information from history
    const preliminaryRead = order.history?.find(h => h.status === 'preliminary');
    const finalRead = order.history?.find(h => h.status === 'final');
    
    return (
      <Stack key={order.serviceRequestId} spacing={1} sx={{ mb: 2 }}>
        <Typography sx={{ color: '#0F347C', fontWeight: '500' }}>
          {order.studyType}
        </Typography>
        {renderProperty('Diagnosis', order.diagnosis)}
        {renderProperty('Clinical History', order.clinicalHistory)}
        
        {preliminaryRead && renderProperty('Preliminary Read', order.result || 'See AdvaPACS')}
        {finalRead && renderProperty('Final Read', order.result || 'See AdvaPACS')}
        {renderProperty('Result', order.result)}
        
        {(order.result || preliminaryRead || finalRead) && (
          <Link
            href="#"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              color: theme.palette.primary.main,
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            <ImageIcon fontSize="small" />
            View Image
          </Link>
        )}
      </Stack>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
        <Typography variant="h5" color="primary.dark">
          Radiology
        </Typography>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, width: '100%' }}>
      <Typography variant="h5" color="primary.dark">
        Radiology
      </Typography>
      {orders?.length ? (
        orders.map(renderRadiologyOrder)
      ) : (
        <Typography color={theme.palette.text.secondary}>No radiology orders</Typography>
      )}
    </Box>
  );
};