import { Box, Typography } from '@mui/material';
import React, { useLayoutEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { STUB_IMMUNIZATION_ORDERS } from '../ImmunizationOrder';
import { VaccineDetailsCard } from './VaccineDetailsCard';

export const VaccineDetailsCardList: React.FC = () => {
  const [searchParams] = useSearchParams();
  const scrollTo = searchParams.get('scrollTo');

  const immunizationOrders = STUB_IMMUNIZATION_ORDERS;

  const pendingOrders = useMemo(() => {
    return immunizationOrders.filter((order) => order.status === 'pending');
  }, [immunizationOrders]);

  useLayoutEffect(() => {
    if (scrollTo && pendingOrders.length > 0) {
      requestAnimationFrame(() => {
        const element = document.getElementById(`medication-${scrollTo}`);
        element?.scrollIntoView?.({ behavior: 'auto', block: 'start', inline: 'nearest' });

        const url = new URL(window.location.href);
        url.searchParams.delete('scrollTo');
        window.history.replaceState({}, '', url.toString());
      });
    }
  }, [scrollTo, pendingOrders]);

  if (pendingOrders.length === 0) {
    return <Typography>No orders found.</Typography>;
  }

  return (
    <Box>
      {pendingOrders.map((order) => (
        <Box
          sx={{
            scrollMarginTop: '48px',
          }}
          key={order.id}
          id={`order-${order.id}`}
        >
          <VaccineDetailsCard order={order} />
        </Box>
      ))}
    </Box>
  );
};
