import React from 'react';
import { Stack, Box, Typography, Divider } from '@mui/material';
import { Link } from 'react-router-dom';
import { OrderToolTipConfig } from 'utils';

export const OrdersToolTip: React.FC<{
  orderConfigs: OrderToolTipConfig[];
}> = ({ orderConfigs }) => {
  return (
    <Stack
      spacing={1}
      sx={{
        width: '380px',
        padding: '16px',
      }}
      divider={<Divider orientation="horizontal" />}
    >
      {orderConfigs.map((config) => (
        <>
          <Box display="flex" alignItems="center">
            <Box
              sx={{
                width: '32px',
                height: '32px',
                backgroundColor: '#E3F2FD',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px',
              }}
            >
              {config.icon}
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: '500 !important' }}>
                {config.title}
              </Typography>
              <Typography variant="caption">
                {config.orders.length} order{config.orders.length > 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
          {config.orders.map((order) => (
            <Link key={order.serviceRequestId} to={order.detailPageUrl} style={{ textDecoration: 'none' }}>
              <Box display="flex" alignItems="center" gap="8px" color="text.primary">
                <Typography variant="body2">{order.testItemName}</Typography>
                {order.statusChip}
              </Box>
            </Link>
          ))}
        </>
      ))}
    </Stack>
  );
};
