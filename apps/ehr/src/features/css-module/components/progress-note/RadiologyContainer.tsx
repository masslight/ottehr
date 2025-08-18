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
    encounterIds: encounter.id,
  });

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
    return (
      <Stack key={order.serviceRequestId} spacing={1} sx={{ mb: 2 }}>
        <Typography sx={{ color: '#0F347C', fontWeight: '500' }}>
          {order.studyType}
        </Typography>
        {renderProperty('Diagnosis', order.diagnosis)}
        {renderProperty('Clinical History', order.clinicalHistory)}
        {order.history && order.history.length > 0 && (
          <>
            {order.history
              .filter(h => h.status === 'preliminary')
              .map((h, idx) => (
                <Box key={`preliminary-${idx}`}>
                  <Typography component="span" sx={{ fontWeight: '500' }}>
                    Preliminary Read:
                  </Typography>{' '}
                  {order.result || 'See AdvaPACS'}
                </Box>
              ))}
            {order.history
              .filter(h => h.status === 'final')
              .map((h, idx) => (
                <Box key={`final-${idx}`}>
                  <Typography component="span" sx={{ fontWeight: '500' }}>
                    Final Read:
                  </Typography>{' '}
                  {order.result || 'See AdvaPACS'}
                </Box>
              ))}
          </>
        )}
        {renderProperty('Result', order.result)}
        {order.result && (
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