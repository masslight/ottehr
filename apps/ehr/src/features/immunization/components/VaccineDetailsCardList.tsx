import { Box, Stack, Typography } from '@mui/material';
import React, { useLayoutEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useGetImmunizationOrders } from '../../visits/in-person/hooks/useImmunization';
import { ordersRecentFirstComparator } from '../common';
import { VaccineDetailsCard } from './VaccineDetailsCard';

export const VaccineDetailsCardList: React.FC = () => {
  const { id: appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const scrollTo = searchParams.get('scrollTo');

  const { encounter } = useAppointmentData(appointmentId);

  const { data: ordersResponse } = useGetImmunizationOrders({
    encounterIds: [encounter.id!],
  });

  const allOrders = (ordersResponse?.orders ?? []).sort(ordersRecentFirstComparator);

  useLayoutEffect(() => {
    if (scrollTo && allOrders.length > 0) {
      requestAnimationFrame(() => {
        const element = document.getElementById(`order-${scrollTo}`);
        element?.scrollIntoView?.({ behavior: 'auto', block: 'start', inline: 'nearest' });

        const url = new URL(window.location.href);
        url.searchParams.delete('scrollTo');
        window.history.replaceState({}, '', url.toString());
      });
    }
  }, [scrollTo, allOrders]);

  if (allOrders.length === 0) {
    return <Typography>No orders found.</Typography>;
  }

  return (
    <Stack spacing={2}>
      {allOrders.map((order) => (
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
    </Stack>
  );
};
