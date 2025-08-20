import { Box, Stack, Typography } from '@mui/material';
import React, { useLayoutEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAppointment } from 'src/features/css-module/hooks/useAppointment';
import { useGetImmunizationOrders } from '../useImmunizationOrders';
import { VaccineDetailsCard } from './VaccineDetailsCard';

export const VaccineDetailsCardList: React.FC = () => {
  const { id: appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const scrollTo = searchParams.get('scrollTo');

  const {
    resources: { patient },
  } = useAppointment(appointmentId);

  const { immunizationOrders } = useGetImmunizationOrders({ patientId: patient?.id ?? '' });

  const pendingOrders = useMemo(() => {
    return immunizationOrders.filter((order) => order.status === 'pending');
  }, [immunizationOrders]);

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
