import { Box, Divider, Stack, Typography } from '@mui/material';
import React from 'react';
import { Link } from 'react-router-dom';
import { OrderToolTipConfig } from 'utils';

export const OrdersToolTip: React.FC<{
  orderConfigs: OrderToolTipConfig[];
}> = ({ orderConfigs }) => {
  return (
    <Stack
      sx={{
        width: '380px',
        padding: '16px',
        maxHeight: '420px',
        overflowY: 'scroll',
        '&::-webkit-scrollbar': {
          width: '6px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: '#ccc',
          borderRadius: '4px',
          paddingY: '30px',
        },
      }}
      spacing={1}
      divider={<Divider orientation="horizontal" />}
    >
      {orderConfigs.map((config) => (
        <Stack spacing={1} key={`tooltip-orders-container-${config.title}`}>
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
            <Link
              key={`tooltip-test-item${order.serviceRequestId}`}
              to={order.detailPageUrl}
              style={{ textDecoration: 'none' }}
            >
              <Box display="flex" alignItems="center" gap="8px" color="text.primary">
                <Typography variant="body2">{order.itemDescription}</Typography>
                {order.statusChip}
              </Box>
            </Link>
          ))}
        </Stack>
      ))}
    </Stack>
  );
};
