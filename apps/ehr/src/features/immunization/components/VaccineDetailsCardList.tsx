import { Box, Stack, Typography } from '@mui/material';
import React, { useLayoutEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAppointmentData } from 'src/telemed';
import { useGetImmunizationOrders } from '../../css-module/hooks/useImmunization';
import { ordersRecentFirstComparator } from '../common';
import { VaccineDetailsCard } from './VaccineDetailsCard';

export const VaccineDetailsCardList: React.FC = () => {
  const { id: appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const scrollTo = searchParams.get('scrollTo');

  const {
    resources: { patient },
  } = useAppointmentData(appointmentId);

  const { data: ordersResponse } = useGetImmunizationOrders({
    patientId: patient?.id,
  });

  const pendingOrders = (ordersResponse?.orders ?? [])
    .sort(ordersRecentFirstComparator)
    .filter((order) => order.status === 'pending');

  useLayoutEffect(() => {
    if (scrollTo && pendingOrders.length > 0) {
      requestAnimationFrame(() => {
        const element = document.getElementById(`order-${scrollTo}`);
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
    <Stack spacing={2}>
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
    </Stack>
  );
};
